import type { Timestamp } from 'firebase/firestore';

/** Permission an owner can grant to someone they share a calendar with. */
export type SharePermission = 'read' | 'write';

/** Effective role of a user on a calendar. */
export type Role = 'owner' | SharePermission;

export const CURRENCIES = ['ARS', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface ExpenseCalendar {
  id: string;
  name: string;
  ownerId: string;
  currency: Currency;
  /** uid -> role. Source of truth for permissions (flat so firestore.rules can validate it). */
  members: Record<string, Role>;
  /** uid -> display name, for showing who has access. */
  memberNames: Record<string, string>;
  /** Mirror of Object.keys(members), needed for `array-contains` queries. */
  memberIds: string[];
  createdAt: Timestamp | null;
}

export interface Expense {
  id: string;
  /** Local calendar day, formatted YYYY-MM-DD. */
  date: string;
  /** Stored as integer cents to avoid floating point errors. */
  amountCents: number;
  description: string;
  category: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

export type NewExpense = Pick<Expense, 'date' | 'amountCents' | 'description' | 'category'>;

export interface UserProfile {
  uid: string;
  displayName: string;
  emailLower: string;
  /** Normalized phone numbers (see lib/phone.ts) used to match device contacts. */
  phones: string[];
}
