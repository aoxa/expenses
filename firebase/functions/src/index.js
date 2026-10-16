import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';

import { addedMembers, buildSharedMessage, sendExpoPush } from './calendarShared.js';

initializeApp();

// Keep the function close to the Firestore database. If your database isn't
// in us-central1 (e.g. southamerica-east1 for Argentina), change this.
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

/** Sends a push to each user newly added to a calendar's members. */
export const notifyCalendarShared = onDocumentUpdated('calendars/{calendarId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  const added = addedMembers(before.memberIds, after.memberIds);
  if (added.length === 0) return;

  const { calendarId } = event.params;
  const db = getFirestore();
  const tokenRefs = new Map();
  const messages = [];

  for (const uid of added) {
    const tokens = await db.collection('users').doc(uid).collection('pushTokens').get();
    for (const tokenDoc of tokens.docs) {
      tokenRefs.set(tokenDoc.id, tokenDoc.ref);
      messages.push(buildSharedMessage({ token: tokenDoc.id, calendarId, calendar: after, uid }));
    }
  }

  if (messages.length === 0) {
    logger.info('No push tokens for new members', { calendarId, added });
    return;
  }

  const invalidTokens = await sendExpoPush(messages);
  await Promise.all(invalidTokens.map((token) => tokenRefs.get(token)?.delete()));
  logger.info('Sent calendar shared notifications', {
    calendarId,
    recipients: added.length,
    sent: messages.length,
    removedTokens: invalidTokens.length,
  });
});
