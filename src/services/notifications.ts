import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';

import { db } from '@/lib/firebase';

/** Android channel used by the server when sending pushes (see firebase/functions). */
export const DEFAULT_CHANNEL_ID = 'default';

/** Payload the server attaches to a "calendar shared" push. */
export interface CalendarSharedData {
  type: 'calendar_shared';
  calendarId: string;
}

export function isCalendarSharedData(data: unknown): data is CalendarSharedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as CalendarSharedData).type === 'calendar_shared' &&
    typeof (data as CalendarSharedData).calendarId === 'string'
  );
}

type NotificationsModule = typeof import('expo-notifications');

/**
 * Expo Go on Android (and any build made before expo-notifications was added)
 * lacks its native modules, and merely importing the package there throws.
 * Remote push needs a development build anyway, so the package is only loaded
 * when its native side is actually present.
 */
export const pushSupported =
  !(Platform.OS === 'android' && isRunningInExpoGo()) &&
  requireOptionalNativeModule('ExpoPushTokenManager') != null &&
  (Platform.OS !== 'android' || requireOptionalNativeModule('ExpoTopicSubscriptionModule') != null);

let notificationsModule: Promise<NotificationsModule | null> | null = null;

/** Lazily loads expo-notifications, or resolves to null where it's unavailable. */
export function loadNotifications(): Promise<NotificationsModule | null> {
  notificationsModule ??= pushSupported
    ? import('expo-notifications')
        .then((Notifications) => {
          // Show pushes as a banner even while the app is in the foreground.
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            }),
          });
          return Notifications;
        })
        .catch((e) => {
          console.warn('[notifications] expo-notifications is unavailable', e);
          return null;
        })
    : Promise.resolve(null);
  return notificationsModule;
}

let registeredToken: string | null = null;

/**
 * Asks for notification permission, gets this device's Expo push token and
 * stores it under users/{uid}/pushTokens so the server can notify the user.
 * Returns null when push isn't possible (permission denied, Expo Go on
 * Android, missing EAS project id).
 */
export async function registerForPushNotifications(uid: string): Promise<string | null> {
  const Notifications = await loadNotifications();
  if (!Notifications) {
    console.info('[notifications] Push notifications need a development build, skipping in Expo Go.');
    return null;
  }

  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'Calendarios compartidos',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[notifications] No EAS projectId in app.json; run `npx eas-cli@latest init`.');
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  await setDoc(doc(db, 'users', uid, 'pushTokens', token), {
    platform: Platform.OS,
    updatedAt: serverTimestamp(),
  });
  registeredToken = token;
  return token;
}

/** Stops sending pushes to this device for the user. Call before signing out. */
export async function unregisterPushToken(uid: string): Promise<void> {
  if (!registeredToken) return;
  try {
    await deleteDoc(doc(db, 'users', uid, 'pushTokens', registeredToken));
  } finally {
    registeredToken = null;
  }
}
