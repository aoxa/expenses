import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/components/theme';
import { Button, EmptyState, Loading, Screen } from '@/components/ui';
import { useCurrentUser } from '@/context/AuthContext';
import { useCalendar } from '@/hooks/useCalendar';
import { formatLongDate } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { canDeleteExpense, canWrite } from '@/lib/permissions';
import { deleteExpense, subscribeExpensesForDay } from '@/services/expenses';
import type { Expense } from '@/types/models';

export default function DayScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();
  const user = useCurrentUser();
  const { calendar, role, loading } = useCalendar(id);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    return subscribeExpensesForDay(id, date, setExpenses);
  }, [id, date, role]);

  if (loading) return <Loading />;
  if (!calendar || !role) return <EmptyState message="Ya no tenés acceso a este calendario." />;

  const total = (expenses ?? []).reduce((sum, e) => sum + e.amountCents, 0);

  const confirmDelete = (expense: Expense) =>
    Alert.alert(
      '¿Eliminar gasto?',
      `${expense.description || expense.category} · ${formatCents(expense.amountCents, calendar.currency)}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(expense.id);
            try {
              await deleteExpense(id, expense.id);
            } catch (e) {
              Alert.alert('No se pudo eliminar el gasto', e instanceof Error ? e.message : String(e));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: formatLongDate(date) }} />

      <Text style={styles.total}>Total: {formatCents(total, calendar.currency)}</Text>

      {expenses === null ? (
        <Loading />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<EmptyState message="No hay gastos este día." />}
          renderItem={({ item }) => (
            <View style={[styles.row, deletingId === item.id && { opacity: 0.5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.description}>{item.description || item.category}</Text>
                <Text style={styles.meta}>
                  {item.category} · cargado por {item.createdByName}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.amount}>{formatCents(item.amountCents, calendar.currency)}</Text>
                {canDeleteExpense(role, user.uid, item.createdBy) && (
                  <Pressable
                    onPress={() => confirmDelete(item)}
                    disabled={deletingId !== null}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Eliminar gasto ${item.description || item.category}`}
                  >
                    <Text style={styles.delete}>Eliminar</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}

      {canWrite(role) && (
        <Button
          title="Agregar gasto"
          onPress={() => router.push({ pathname: '/calendar/[id]/add-expense', params: { id, date } })}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  description: { fontSize: 16, color: colors.text },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: spacing.xs, marginLeft: spacing.sm },
  amount: { fontSize: 16, fontWeight: '600', color: colors.text },
  delete: { color: colors.danger, fontSize: 13 },
});
