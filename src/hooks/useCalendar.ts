import { useEffect, useState } from 'react';

import { useCurrentUser } from '@/context/AuthContext';
import { getRole } from '@/lib/permissions';
import { subscribeCalendar } from '@/services/calendars';
import type { ExpenseCalendar, Role } from '@/types/models';

/** Live calendar document plus the current user's role on it. */
export function useCalendar(calendarId: string) {
  const user = useCurrentUser();
  // Tagged with the id it belongs to, so switching calendars reads as loading
  // without resetting state inside the effect.
  const [snapshot, setSnapshot] = useState<{ id: string; calendar: ExpenseCalendar | null } | null>(null);

  useEffect(
    () => subscribeCalendar(calendarId, (calendar) => setSnapshot({ id: calendarId, calendar })),
    [calendarId],
  );

  const loading = snapshot?.id !== calendarId;
  const calendar = loading ? null : snapshot.calendar;
  const role: Role | null = getRole(calendar, user.uid);
  return { calendar, role, loading };
}
