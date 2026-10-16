import type { NotificationResponse } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { isCalendarSharedData, loadNotifications, registerForPushNotifications } from '@/services/notifications';

type NotificationsModule = NonNullable<Awaited<ReturnType<typeof loadNotifications>>>;

function openFromNotification(Notifications: NotificationsModule, response: NotificationResponse) {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const data = response.notification.request.content.data;
  if (isCalendarSharedData(data)) {
    router.push({ pathname: '/calendar/[id]', params: { id: data.calendarId } });
  }
  Notifications.clearLastNotificationResponse();
}

/**
 * Registers the device for pushes once the user is signed in and the app is
 * unlocked, and opens the shared calendar when a notification is tapped.
 */
export function usePushNotifications(uid: string | null, ready: boolean) {
  useEffect(() => {
    if (!uid || !ready) return;
    registerForPushNotifications(uid).catch((e) => console.warn('[notifications] Registration failed', e));
  }, [uid, ready]);

  useEffect(() => {
    if (!uid || !ready) return;
    let cancelled = false;
    let subscription: { remove(): void } | undefined;

    loadNotifications().then((Notifications) => {
      if (!Notifications || cancelled) return;
      const open = (response: NotificationResponse) => openFromNotification(Notifications, response);

      // Tapped while the app was closed: handle it once the navigator is mounted.
      const last = Notifications.getLastNotificationResponse();
      if (last) open(last);

      subscription = Notifications.addNotificationResponseReceivedListener(open);
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [uid, ready]);
}
