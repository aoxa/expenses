import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { authenticate, isBiometricAvailable, isBiometricLockEnabled, setBiometricLockEnabled } from '@/lib/biometrics';
import { colors, spacing } from './theme';

/** "Unlock with fingerprint" switch. Renders nothing on devices without an enrolled fingerprint. */
export function BiometricToggle({ uid }: { uid: string }) {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setAvailable(await isBiometricAvailable());
      setEnabled(await isBiometricLockEnabled(uid));
    })();
  }, [uid]);

  if (!available) return null;

  const toggle = async (next: boolean) => {
    setBusy(true);
    try {
      // Confirm the fingerprint works before relying on it to open the app.
      if (next && !(await authenticate('Confirmá tu huella para activar el desbloqueo'))) return;
      await setBiometricLockEnabled(uid, next);
      setEnabled(next);
    } catch (e) {
      Alert.alert('No se pudo cambiar la configuración', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Desbloquear con huella</Text>
        <Text style={styles.subtitle}>Pedir la huella al abrir la app</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={toggle}
        disabled={busy}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
        accessibilityLabel="Desbloquear con huella"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  title: { fontSize: 16, color: colors.text },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
