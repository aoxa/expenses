import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebase';
import { normalizePhone } from '@/lib/phone';
import { unregisterPushToken } from '@/services/notifications';
import type { UserProfile } from '@/types/models';

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUp(params: { email: string; password: string; displayName: string; phone: string }) {
  const { user } = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  await updateProfile(user, { displayName: params.displayName });

  // Public profile used to match the user from other people's contact lists.
  const profile: Omit<UserProfile, 'uid'> = {
    displayName: params.displayName,
    emailLower: params.email.trim().toLowerCase(),
    phones: params.phone ? [normalizePhone(params.phone)] : [],
  };
  await setDoc(doc(db, 'users', user.uid), profile);
}

export async function signOut() {
  // Remove this device's push token while still authenticated, so the user
  // stops getting notifications here. Never block signing out on it.
  const uid = auth.currentUser?.uid;
  if (uid) await unregisterPushToken(uid).catch(() => {});
  await fbSignOut(auth);
}
