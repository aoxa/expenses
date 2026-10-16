import { onAuthStateChanged, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { auth } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  initializing: boolean;
  /**
   * True while the signed-in user is the session restored from storage at
   * startup. Becomes false for good once that user signs out or another signs in.
   */
  isRestoredSession: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, initializing: true, isRestoredSession: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: auth.currentUser, initializing: true, isRestoredSession: false });

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) =>
        setState((prev) => ({
          user,
          initializing: false,
          isRestoredSession: prev.initializing ? !!user : prev.isRestoredSession && user?.uid === prev.user?.uid,
        })),
      ),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/** For screens behind the auth guard, where a user is always present. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser called outside an authenticated route');
  return user;
}
