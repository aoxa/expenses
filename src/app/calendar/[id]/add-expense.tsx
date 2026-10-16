import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import { Button, EmptyState, Field, Loading } from '@/components/ui';
import { useCurrentUser } from '@/context/AuthContext';
import { useCalendar } from '@/hooks/useCalendar';
import { formatLongDate, today } from '@/lib/dates';
import { canWrite } from '@/lib/permissions';
import { MAX_DESCRIPTION_LENGTH, validateAmount } from '@/lib/validation';
import { addExpense } from '@/services/expenses';

const CATEGORIES = ['Comida', 'Transporte', 'Hogar', 'Salud', 'Ocio', 'Otros'];

export default function AddExpenseScreen() {
  const { id, date = today() } = useLocalSearchParams<{ id: string; date?: string }>();
  const user = useCurrentUser();
  const { role, loading } = useCalendar(id);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (!canWrite(role)) return <EmptyState message="Solo tenés permiso de lectura en este calendario." />;

  const save = async () => {
    const { cents: amountCents, error } = validateAmount(amount);
    setAmountError(error);
    if (amountCents === null) return;
    setSaving(true);
    try {
      await addExpense(
        id,
        { date, amountCents, description: description.trim(), category },
        { uid: user.uid, displayName: user.displayName ?? user.email ?? 'Desconocido' },
      );
      router.back();
    } catch (e) {
      Alert.alert('No se pudo guardar el gasto', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.date}>{formatLongDate(date)}</Text>

      <Field
        label="Monto"
        value={amount}
        onChangeText={(value) => {
          setAmount(value);
          if (amountError) setAmountError(null);
        }}
        keyboardType="decimal-pad"
        placeholder="0,00"
        autoFocus
        error={amountError}
      />
      <Field
        label="Descripción (opcional)"
        value={description}
        onChangeText={setDescription}
        placeholder="¿En qué gastaste?"
        maxLength={MAX_DESCRIPTION_LENGTH}
      />

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipSelected]}>
            <Text style={{ color: category === c ? colors.primaryText : colors.text }}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Button title="Guardar gasto" onPress={save} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  date: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md, textTransform: 'capitalize' },
  label: { color: colors.muted, marginBottom: spacing.xs, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
