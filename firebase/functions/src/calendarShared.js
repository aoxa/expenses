// Pure logic for "a calendar was shared with you" notifications, kept free of
// Firebase imports so it can be unit-tested (see test/calendarShared.test.js).

const ROLE_LABELS = {
  read: 'puede ver los gastos',
  write: 'puede ver y agregar gastos',
};

/** Must match DEFAULT_CHANNEL_ID in src/services/notifications.ts. */
const ANDROID_CHANNEL_ID = 'default';

const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL ?? 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
const EXPO_BATCH_SIZE = 100;

/** uids present in `after` but not in `before`. */
export function addedMembers(before = [], after = []) {
  const previous = new Set(before);
  return after.filter((uid) => !previous.has(uid));
}

/** Builds the Expo push message for one device of a newly added member. */
export function buildSharedMessage({ token, calendarId, calendar, uid }) {
  const ownerName = calendar.memberNames?.[calendar.ownerId] ?? 'Alguien';
  const role = ROLE_LABELS[calendar.members?.[uid]];
  return {
    to: token,
    title: 'Te compartieron un calendario',
    body: `${ownerName} compartió "${calendar.name}" con vos` + (role ? ` y ${role}.` : '.'),
    data: { type: 'calendar_shared', calendarId },
    channelId: ANDROID_CHANNEL_ID,
    sound: 'default',
  };
}

/**
 * Sends messages through the Expo push service.
 * Returns the tokens Expo reports as no longer registered, so they can be deleted.
 */
export async function sendExpoPush(messages, { fetchFn = fetch, accessToken = process.env.EXPO_ACCESS_TOKEN } = {}) {
  const invalidTokens = [];

  for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_BATCH_SIZE);
    const res = await fetchFn(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Expo push request failed: ${res.status} ${await res.text()}`);

    // Tickets come back in the same order as the messages.
    const { data: tickets = [] } = await res.json();
    tickets.forEach((ticket, j) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(batch[j].to);
      }
    });
  }

  return invalidTokens;
}
