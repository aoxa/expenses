// Verifies the calendar permission model in firestore.rules.
// Run with: npm run test:rules (starts the Firestore emulator).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';

import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const CAL = 'cal1';

let env;
const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();

const expense = (uid, extra = {}) => ({
  date: '2026-10-15',
  amountCents: 1250,
  description: 'Coffee',
  category: 'Food',
  createdBy: uid,
  createdByName: uid,
  createdAt: serverTimestamp(),
  ...extra,
});

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-comprobantes',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'calendars', CAL), {
      name: 'Household',
      currency: 'ARS',
      ownerId: 'owner',
      members: { owner: 'owner', reader: 'read', writer: 'write' },
      memberNames: { owner: 'Owner', reader: 'Reader', writer: 'Writer' },
      memberIds: ['owner', 'reader', 'writer'],
    });
    await setDoc(doc(db, 'calendars', CAL, 'expenses', 'byOwner'), expense('owner'));
    await setDoc(doc(db, 'calendars', CAL, 'expenses', 'byWriter'), expense('writer'));
  });
});

describe('reading', () => {
  test('every member can read the calendar and its expenses', async () => {
    for (const uid of ['owner', 'reader', 'writer']) {
      await assertSucceeds(getDoc(doc(as(uid), 'calendars', CAL)));
      await assertSucceeds(getDocs(collection(as(uid), 'calendars', CAL, 'expenses')));
    }
  });

  test('non-members cannot read anything', async () => {
    await assertFails(getDoc(doc(as('stranger'), 'calendars', CAL)));
    await assertFails(getDocs(collection(as('stranger'), 'calendars', CAL, 'expenses')));
  });

  test('"my calendars" query works for a shared user', async () => {
    const db = as('reader');
    await assertSucceeds(getDocs(query(collection(db, 'calendars'), where('memberIds', 'array-contains', 'reader'))));
  });
});

describe('adding expenses', () => {
  test('owner and write members can add', async () => {
    await assertSucceeds(addDoc(collection(as('owner'), 'calendars', CAL, 'expenses'), expense('owner')));
    await assertSucceeds(addDoc(collection(as('writer'), 'calendars', CAL, 'expenses'), expense('writer')));
  });

  test('read members cannot add', async () => {
    await assertFails(addDoc(collection(as('reader'), 'calendars', CAL, 'expenses'), expense('reader')));
  });

  test('cannot impersonate another author or send invalid data', async () => {
    const col = collection(as('writer'), 'calendars', CAL, 'expenses');
    await assertFails(addDoc(col, expense('owner')));
    await assertFails(addDoc(col, expense('writer', { amountCents: 0 })));
    await assertFails(addDoc(col, expense('writer', { amountCents: -5 })));
    await assertFails(addDoc(col, expense('writer', { amountCents: 12.5 })));
    await assertFails(addDoc(col, expense('writer', { date: '15/10/2026' })));
  });
});

describe('deleting expenses', () => {
  test('writer can delete own expense but not others', async () => {
    await assertSucceeds(deleteDoc(doc(as('writer'), 'calendars', CAL, 'expenses', 'byWriter')));
    await assertFails(deleteDoc(doc(as('writer'), 'calendars', CAL, 'expenses', 'byOwner')));
  });

  test('reader cannot delete; owner can delete anything', async () => {
    await assertFails(deleteDoc(doc(as('reader'), 'calendars', CAL, 'expenses', 'byWriter')));
    await assertSucceeds(deleteDoc(doc(as('owner'), 'calendars', CAL, 'expenses', 'byWriter')));
  });
});

describe('sharing', () => {
  const share = (db, uid, role) =>
    updateDoc(doc(db, 'calendars', CAL), {
      [`members.${uid}`]: role,
      [`memberNames.${uid}`]: uid,
      memberIds: arrayUnion(uid),
    });

  test('owner can share with read or write permission', async () => {
    await assertSucceeds(share(as('owner'), 'friend', 'read'));
    await assertSucceeds(share(as('owner'), 'friend', 'write'));
  });

  test('owner cannot grant ownership or invalid roles', async () => {
    await assertFails(share(as('owner'), 'friend', 'owner'));
    await assertFails(share(as('owner'), 'friend', 'admin'));
  });

  test('non-owners cannot share or escalate their own role', async () => {
    await assertFails(share(as('writer'), 'friend', 'read'));
    await assertFails(share(as('reader'), 'reader', 'write'));
  });

  test('owner can revoke access, after which the user cannot read', async () => {
    await assertSucceeds(
      updateDoc(doc(as('owner'), 'calendars', CAL), {
        'members.reader': deleteField(),
        'memberNames.reader': deleteField(),
        memberIds: arrayRemove('reader'),
      }),
    );
    await assertFails(getDoc(doc(as('reader'), 'calendars', CAL)));
    await assertFails(getDocs(collection(as('reader'), 'calendars', CAL, 'expenses')));
  });

  test('memberIds must mirror members', async () => {
    await assertFails(
      updateDoc(doc(as('owner'), 'calendars', CAL), { 'members.friend': 'read', 'memberNames.friend': 'Friend' }),
    );
  });
});

describe('creating calendars', () => {
  test('a user can create a calendar they own', async () => {
    await assertSucceeds(
      addDoc(collection(as('alice'), 'calendars'), {
        name: 'Trip',
        currency: 'ARS',
        ownerId: 'alice',
        members: { alice: 'owner' },
        memberNames: { alice: 'Alice' },
        memberIds: ['alice'],
        createdAt: serverTimestamp(),
      }),
    );
  });

  test('only ARS and USD are accepted as currency', async () => {
    const calendar = (currency) => ({
      name: 'Trip',
      currency,
      ownerId: 'alice',
      members: { alice: 'owner' },
      memberNames: { alice: 'Alice' },
      memberIds: ['alice'],
    });
    await assertSucceeds(addDoc(collection(as('alice'), 'calendars'), calendar('USD')));
    await assertFails(addDoc(collection(as('alice'), 'calendars'), calendar('EUR')));
  });

  test('cannot create a calendar pre-shared or owned by someone else', async () => {
    await assertFails(
      addDoc(collection(as('alice'), 'calendars'), {
        name: 'Trip',
        ownerId: 'alice',
        members: { alice: 'owner', bob: 'write' },
        memberNames: { alice: 'Alice', bob: 'Bob' },
        memberIds: ['alice', 'bob'],
      }),
    );
    await assertFails(
      addDoc(collection(as('alice'), 'calendars'), {
        name: 'Trip',
        ownerId: 'bob',
        members: { bob: 'owner' },
        memberNames: { bob: 'Bob' },
        memberIds: ['bob'],
      }),
    );
  });
});

describe('deleting calendars', () => {
  test('owner can delete all expenses and then the calendar', async () => {
    const db = as('owner');
    const expenses = await getDocs(collection(db, 'calendars', CAL, 'expenses'));
    const batch = writeBatch(db);
    expenses.docs.forEach((d) => batch.delete(d.ref));
    await assertSucceeds(batch.commit());
    await assertSucceeds(deleteDoc(doc(db, 'calendars', CAL)));
  });

  test('read and write members cannot delete the calendar', async () => {
    await assertFails(deleteDoc(doc(as('writer'), 'calendars', CAL)));
    await assertFails(deleteDoc(doc(as('reader'), 'calendars', CAL)));
  });

  test('members lose access once the calendar is deleted', async () => {
    await deleteDoc(doc(as('owner'), 'calendars', CAL));
    await assertFails(getDoc(doc(as('reader'), 'calendars', CAL)));
    await assertFails(getDocs(collection(as('reader'), 'calendars', CAL, 'expenses')));
  });
});

describe('push tokens', () => {
  const TOKEN = 'ExponentPushToken[abc123]';
  const tokenDoc = (db, uid, token = TOKEN) => doc(db, 'users', uid, 'pushTokens', token);
  const data = { platform: 'android', updatedAt: serverTimestamp() };

  test('a user can save, read and delete their own token', async () => {
    const db = as('alice');
    await assertSucceeds(setDoc(tokenDoc(db, 'alice'), data));
    await assertSucceeds(getDoc(tokenDoc(db, 'alice')));
    await assertSucceeds(deleteDoc(tokenDoc(db, 'alice')));
  });

  test("other users cannot read or write someone's tokens", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(tokenDoc(ctx.firestore(), 'alice'), data));
    await assertFails(getDoc(tokenDoc(as('bob'), 'alice')));
    await assertFails(getDocs(collection(as('bob'), 'users', 'alice', 'pushTokens')));
    await assertFails(setDoc(tokenDoc(as('bob'), 'alice'), data));
    await assertFails(deleteDoc(tokenDoc(as('bob'), 'alice')));
  });

  test('rejects malformed tokens and extra fields', async () => {
    const db = as('alice');
    await assertFails(setDoc(tokenDoc(db, 'alice', 'not-a-token'), data));
    await assertFails(setDoc(tokenDoc(db, 'alice'), { ...data, extra: true }));
    await assertFails(setDoc(tokenDoc(db, 'alice'), { ...data, platform: 'web' }));
  });
});
