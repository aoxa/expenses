import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import type { Expense, NewExpense } from '@/types/models';

const expensesCol = (calendarId: string) => collection(db, 'calendars', calendarId, 'expenses');

const toExpenses = (docs: { id: string; data(): unknown }[]) =>
  docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as Expense);

/** Expenses between two YYYY-MM-DD dates, inclusive. */
export function subscribeExpensesInRange(
  calendarId: string,
  from: string,
  to: string,
  cb: (expenses: Expense[]) => void,
) {
  const q = query(expensesCol(calendarId), where('date', '>=', from), where('date', '<=', to), orderBy('date'));
  return onSnapshot(q, (snap) => cb(toExpenses(snap.docs)), () => cb([]));
}

export function subscribeExpensesForDay(calendarId: string, date: string, cb: (expenses: Expense[]) => void) {
  return subscribeExpensesInRange(calendarId, date, date, cb);
}

export async function addExpense(
  calendarId: string,
  expense: NewExpense,
  author: { uid: string; displayName: string },
) {
  await addDoc(expensesCol(calendarId), {
    ...expense,
    createdBy: author.uid,
    createdByName: author.displayName,
    createdAt: serverTimestamp(),
  });
}

export async function deleteExpense(calendarId: string, expenseId: string) {
  await deleteDoc(doc(expensesCol(calendarId), expenseId));
}
