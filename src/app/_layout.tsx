import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { LockScreen } from '@/components/LockScreen';
import { Loading } from '@/components/ui';
import { colors } from '@/components/theme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useStartupLock } from '@/hooks/useStartupLock';

function RootNavigator() {
  const { user, initializing, isRestoredSession } = useAuth();
  const lock = useStartupLock(user, initializing, isRestoredSession);
  usePushNotifications(user?.uid ?? null, !initializing && lock.state === 'unlocked');

  if (initializing || lock.state === 'checking') return <Loading />;
  // The navigator isn't rendered while locked, so no data loads behind the lock screen.
  if (lock.state === 'locked') return <LockScreen onUnlock={lock.unlock} />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!!user}>
        <Stack.Screen name="index" options={{ title: 'Mis calendarios de gastos' }} />
        <Stack.Screen name="calendar/[id]/index" options={{ title: 'Calendario' }} />
        <Stack.Screen name="calendar/[id]/day/[date]" options={{ title: 'Día' }} />
        <Stack.Screen name="calendar/[id]/add-expense" options={{ title: 'Nuevo gasto', presentation: 'modal' }} />
        <Stack.Screen name="calendar/[id]/share" options={{ title: 'Compartir calendario' }} />
        <Stack.Screen name="calendar/[id]/access" options={{ title: 'Personas con acceso' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
