// End-to-end: sharing a calendar in the Firestore emulator triggers the
// notifyCalendarShared function, which posts to a fake Expo push server.
// Run with: npm run test:e2e (sets EXPO_PUSH_URL to the fake server).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PORT = 9988;
const LIVE = 'ExponentPushToken[live]';
const DEAD = 'ExponentPushToken[dead]';

let env;
let server;
let received = [];
let waiters = [];

function nextPush(timeoutMs = 20000) {
  if (received.length) return Promise.resolve(received.shift());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No push received in time')), timeoutMs);
    waiters.push((msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
  });
}

before(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const messages = JSON.parse(body);
      const tickets = messages.map((m) =>
        m.to === DEAD ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'r1' },
      );
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: tickets }));
      const waiter = waiters.shift();
      if (waiter) waiter(messages);
      else received.push(messages);
    });
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  env = await initializeTestEnvironment({ projectId: 'demo-comprobantes' });
});

after(async () => {
  await env.cleanup();
  server.close();
});

beforeEach(async () => {
  received = [];
  waiters = [];
  await env.clearFirestore();
});

// withSecurityRulesDisabled resolves to void, so capture the callback's result.
async function admin(fn) {
  let result;
  await env.withSecurityRulesDisabled(async (ctx) => {
    result = await fn(ctx.firestore());
  });
  return result;
}

test('notifies a user when a calendar is shared with them, and drops dead tokens', async () => {
  await admin(async (db) => {
    await setDoc(doc(db, 'users', 'ana', 'pushTokens', LIVE), { platform: 'android' });
    await setDoc(doc(db, 'users', 'ana', 'pushTokens', DEAD), { platform: 'android' });
    await setDoc(doc(db, 'calendars', 'cal1'), {
      name: 'Casa',
      currency: 'ARS',
      ownerId: 'owner',
      members: { owner: 'owner' },
      memberNames: { owner: 'Pedro' },
      memberIds: ['owner'],
    });
  });

  await admin((db) =>
    updateDoc(doc(db, 'calendars', 'cal1'), {
      'members.ana': 'write',
      'memberNames.ana': 'Ana',
      memberIds: arrayUnion('ana'),
    }),
  );

  const messages = await nextPush();
  assert.deepEqual(messages.map((m) => m.to).sort(), [DEAD, LIVE]);
  assert.equal(messages[0].body, 'Pedro compartió "Casa" con vos y puede ver y agregar gastos.');
  assert.deepEqual(messages[0].data, { type: 'calendar_shared', calendarId: 'cal1' });

  // The function deletes the token Expo reported as unregistered.
  let deadExists = true;
  for (let i = 0; i < 40 && deadExists; i++) {
    await new Promise((r) => setTimeout(r, 250));
    deadExists = await admin(async (db) => (await getDoc(doc(db, 'users', 'ana', 'pushTokens', DEAD))).exists());
  }
  assert.equal(deadExists, false, 'dead token should be removed');
  const liveExists = await admin(async (db) => (await getDoc(doc(db, 'users', 'ana', 'pushTokens', LIVE))).exists());
  assert.equal(liveExists, true);
});

test('does not notify on permission changes', async () => {
  await admin(async (db) => {
    await setDoc(doc(db, 'users', 'ana', 'pushTokens', LIVE), { platform: 'android' });
    await setDoc(doc(db, 'calendars', 'cal2'), {
      name: 'Viaje',
      currency: 'USD',
      ownerId: 'owner',
      members: { owner: 'owner', ana: 'read' },
      memberNames: { owner: 'Pedro', ana: 'Ana' },
      memberIds: ['owner', 'ana'],
    });
  });

  await admin((db) => updateDoc(doc(db, 'calendars', 'cal2'), { 'members.ana': 'write' }));
  await assert.rejects(nextPush(5000), /No push received/);
});
