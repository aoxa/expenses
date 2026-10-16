import type { ExpenseCalendar, Role } from '@/types/models';

// Client-side checks only drive the UI. The real enforcement lives in
// firestore.rules — keep both in sync.

export function getRole(calendar: ExpenseCalendar | null | undefined, uid: string | undefined): Role | null {
  if (!calendar || !uid) return null;
  return calendar.members[uid] ?? null;
}

export function canRead(role: Role | null): boolean {
  return role !== null;
}

export function canWrite(role: Role | null): boolean {
  return role === 'owner' || role === 'write';
}

export function canManageSharing(role: Role | null): boolean {
  return role === 'owner';
}

export function canDeleteCalendar(role: Role | null): boolean {
  return role === 'owner';
}

/** Owners can delete anything; writers only what they created. */
export function canDeleteExpense(role: Role | null, uid: string | undefined, createdBy: string): boolean {
  if (role === 'owner') return true;
  return role === 'write' && uid === createdBy;
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propietario',
  read: 'Puede ver',
  write: 'Puede ver y agregar',
};
