import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { authenticate } from '@/lib/biometrics';
import { signOut } from '@/services/auth';
import { colors, spacing } from './theme';
import { Button } from './ui';

/** Shown on app start while biometric unlock is enabled. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const unlock = useCallback(async () => {
    setBusy(true);
    try {
      if (await authenticate('Desbloqueá Comprobantes')) onUnlock();
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [onUnlock]);

  // Prompt once on mount; the button is there if the user dismisses it.
  const prompted = useRef(false);
  useEffect(() => {
    if (prompted.current) return;
    prompted.current = true;
    unlock();
  }, [unlock]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon} accessibilityElementsHidden>
        🔒
      </Text>
      <Text style={styles.title}>Comprobantes</Text>
      <Text style={styles.subtitle}>
        {failed ? 'No se pudo verificar tu huella.' : 'Usá tu huella para ingresar.'}
      </Text>
      <Button title="Desbloquear con huella" onPress={unlock} loading={busy} />
      {/* Fallback: sign in again with email and password. */}
      <Button variant="secondary" title="Ingresar con contraseña" onPress={signOut} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  icon: { fontSize: 48, textAlign: 'center', marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
});
