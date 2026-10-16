import AsyncStorage from '@react-native-async-storage/async-storage';
import { authenticateAsync, hasHardwareAsync, isEnrolledAsync } from 'expo-local-authentication';

/** True if the device has a fingerprint (or other biometric) sensor with at least one enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    return (await hasHardwareAsync()) && (await isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function authenticate(promptMessage: string): Promise<boolean> {
  const result = await authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancelar',
    // Only Class 3 biometrics (fingerprint). After repeated failures Android
    // offers the device PIN/pattern, so the user can't get locked out.
    biometricsSecurityLevel: 'strong',
  });
  return result.success;
}

// The preference is stored per user, so another account signing in on the
// same device doesn't inherit it.
const lockKey = (uid: string) => `biometricLock:${uid}`;

export async function isBiometricLockEnabled(uid: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(lockKey(uid))) === 'true';
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(uid: string, enabled: boolean): Promise<void> {
  if (enabled) await AsyncStorage.setItem(lockKey(uid), 'true');
  else await AsyncStorage.removeItem(lockKey(uid));
}
