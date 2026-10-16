import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '@/components/theme';
import { Button, Field } from '@/components/ui';
import {
  authErrorMessage,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
} from '@/lib/validation';
import { signIn, signUp } from '@/services/auth';

type FieldName = 'email' | 'password' | 'displayName' | 'phone';
type Errors = Partial<Record<FieldName, string | null>>;

export default function SignInScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'signUp';

  const validate = (): Errors => ({
    email: validateEmail(email),
    password: validatePassword(password, { isNew: isSignUp }),
    ...(isSignUp && { displayName: validateName(displayName), phone: validatePhone(phone) }),
  });

  /** Updates a field and clears its error once the user edits it. */
  const onChange = (field: FieldName, setter: (v: string) => void) => (value: string) => {
    setter(value);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    setFormError(null);
  };

  const submit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    setBusy(true);
    setFormError(null);
    try {
      if (isSignUp) await signUp({ email, password, displayName: displayName.trim(), phone });
      else await signIn(email, password);
      // The auth guard in _layout.tsx redirects once the user is set.
    } catch (e) {
      setFormError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isSignUp ? 'signIn' : 'signUp');
    setErrors({});
    setFormError(null);
  };

  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Comprobantes</Text>
        <Text style={styles.subtitle}>Registrá tus gastos día a día y compartilos con quien quieras.</Text>

        {isSignUp && (
          <>
            <Field
              label="Nombre"
              value={displayName}
              onChangeText={onChange('displayName', setDisplayName)}
              autoComplete="name"
              error={errors.displayName}
            />
            <Field
              label="Teléfono (opcional, para que tus contactos te encuentren)"
              value={phone}
              onChangeText={onChange('phone', setPhone)}
              keyboardType="phone-pad"
              autoComplete="tel"
              error={errors.phone}
            />
          </>
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={onChange('email', setEmail)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={onChange('password', setPassword)}
          secureTextEntry
          autoComplete={isSignUp ? 'new-password' : 'password'}
          error={errors.password}
        />

        {formError && (
          <Text style={styles.formError} accessibilityLiveRegion="polite">
            {formError}
          </Text>
        )}

        <Button title={isSignUp ? 'Crear cuenta' : 'Ingresar'} onPress={submit} loading={busy} />
        <Button variant="secondary" title={isSignUp ? 'Ya tengo cuenta' : 'No tengo cuenta'} onPress={switchMode} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: 32, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { color: colors.muted, marginBottom: spacing.lg },
  formError: { color: colors.danger, marginBottom: spacing.sm, textAlign: 'center' },
});
