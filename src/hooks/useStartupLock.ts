import type { User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';

import { isBiometricAvailable, isBiometricLockEnabled } from '@/lib/biometrics';

type LockState = 'checking' | 'locked' | 'unlocked';

/**
 * Locks the app when it starts with a saved session and the user enabled
 * fingerprint unlock. Signing in with a password in this run doesn't lock.
 */
export function useStartupLock(user: User | null, initializing: boolean, isRestoredSession: boolean) {
  // Result of reading the preference for the restored user (null = not read yet).
  const [lockEnabled, setLockEnabled] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const restoredUid = isRestoredSession ? user?.uid : undefined;

  useEffect(() => {
    if (!restoredUid) return;
    (async () => {
      setLockEnabled((await isBiometricLockEnabled(restoredUid)) && (await isBiometricAvailable()));
    })();
  }, [restoredUid]);

  const unlock = useCallback(() => setUnlocked(true), []);

  let state: LockState;
  if (initializing) state = 'checking';
  // No saved session, or the user signed in/out interactively during this run.
  else if (!restoredUid || unlocked) state = 'unlocked';
  else if (lockEnabled === null) state = 'checking';
  else state = lockEnabled ? 'locked' : 'unlocked';

  return { state, unlock };
}
