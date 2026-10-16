import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Currency, ExpenseCalendar, SharePermission, UserProfile } from '@/types/models';

const calendarsCol = collection(db, 'calendars');

export async function createCalendar(params: {
  name: string;
  currency: Currency;
  ownerId: string;
  ownerName: string;
}): Promise<string> {
  const ref = await addDoc(calendarsCol, {
    name: params.name,
    currency: params.currency,
    ownerId: params.ownerId,
    members: { [params.ownerId]: 'owner' },
    memberNames: { [params.ownerId]: params.ownerName },
    memberIds: [params.ownerId],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Calendars the user owns or that were shared with them. */
export function subscribeMyCalendars(uid: string, cb: (calendars: ExpenseCalendar[]) => void) {
  const q = query(calendarsCol, where('memberIds', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExpenseCalendar));
  });
}

export function subscribeCalendar(calendarId: string, cb: (calendar: ExpenseCalendar | null) => void) {
  return onSnapshot(
    doc(calendarsCol, calendarId),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as ExpenseCalendar) : null),
    // Permission denied, e.g. access was revoked while viewing.
    () => cb(null),
  );
}

/** Grants or changes a user's permission. Only the owner can do this (enforced by rules). */
export async function shareCalendar(calendarId: string, user: Pick<UserProfile, 'uid' | 'displayName'>, permission: SharePermission) {
  await updateDoc(doc(calendarsCol, calendarId), {
    [`members.${user.uid}`]: permission,
    [`memberNames.${user.uid}`]: user.displayName,
    memberIds: arrayUnion(user.uid),
  });
}

/**
 * Deletes a calendar and all of its expenses. Only the owner can do this (enforced by rules).
 *
 * Firestore doesn't delete subcollections with their parent, so expenses go
 * first: the expense rules read the calendar doc to check the owner's role.
 * For very large calendars, consider a Cloud Function (recursiveDelete) instead.
 */
export async function deleteCalendar(calendarId: string) {
  const expenses = await getDocs(collection(db, 'calendars', calendarId, 'expenses'));
  const BATCH_LIMIT = 500;
  for (let i = 0; i < expenses.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    expenses.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await deleteDoc(doc(calendarsCol, calendarId));
}

export async function revokeAccess(calendarId: string, uid: string) {
  await updateDoc(doc(calendarsCol, calendarId), {
    [`members.${uid}`]: deleteField(),
    [`memberNames.${uid}`]: deleteField(),
    memberIds: arrayRemove(uid),
  });
}

/**
 * Finds a registered user matching one of a contact's emails or phones.
 * Firestore `in` / `array-contains-any` accept at most 30 values.
 */
export async function findUserByContact(emails: string[], phones: string[]): Promise<UserProfile | null> {
  const usersCol = collection(db, 'users');
  const toProfile = (d: { id: string; data(): unknown }) => ({ uid: d.id, ...(d.data() as object) }) as UserProfile;

  if (emails.length) {
    const snap = await getDocs(query(usersCol, where('emailLower', 'in', emails.slice(0, 30)), limit(1)));
    if (!snap.empty) return toProfile(snap.docs[0]);
  }
  if (phones.length) {
    const snap = await getDocs(query(usersCol, where('phones', 'array-contains-any', phones.slice(0, 30)), limit(1)));
    if (!snap.empty) return toProfile(snap.docs[0]);
  }
  return null;
}
