import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MonthGrid } from '@/components/MonthGrid';
import { colors, spacing } from '@/components/theme';
import { Button, EmptyState, Loading, Screen } from '@/components/ui';
import { useCalendar } from '@/hooks/useCalendar';
import { formatMonth, monthRange, today } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { canDeleteCalendar, canManageSharing, canWrite, ROLE_LABELS } from '@/lib/permissions';
import { deleteCalendar } from '@/services/calendars';
import { subscribeExpensesInRange } from '@/services/expenses';
import type { Expense } from '@/types/models';

export default function CalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { calendar, role, loading } = useCalendar(id);

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!role) return;
    const { from, to } = monthRange(cursor.year, cursor.month);
    return subscribeExpensesInRange(id, from, to, setExpenses);
  }, [id, role, cursor]);

  const totals = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const e of expenses) byDay[e.date] = (byDay[e.date] ?? 0) + e.amountCents;
    return byDay;
  }, [expenses]);
  const monthTotal = expenses.reduce((sum, e) => sum + e.amountCents, 0);

  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const confirmDeleteCalendar = () => {
    if (!calendar) return;
    const sharedWith = calendar.memberIds.length - 1;
    Alert.alert(
      '¿Eliminar calendario?',
      `Se eliminarán "${calendar.name}" y todos sus gastos` +
        (sharedWith > 0 ? `, y dejará de estar disponible para las ${sharedWith} persona(s) con acceso` : '') +
        '. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteCalendar(id);
              if (router.canGoBack()) router.back();
              else router.replace('/');
            } catch (e) {
              Alert.alert('No se pudo eliminar el calendario', e instanceof Error ? e.message : String(e));
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (loading || deleting) return <Loading />;
  if (!calendar || !role) return <EmptyState message="Este calendario no existe o ya no tenés acceso." />;
  const sharedWith = calendar.memberIds.length - 1;

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: calendar.name,
          headerRight: canManageSharing(role)
            ? () => (
                <Pressable onPress={() => router.push({ pathname: '/calendar/[id]/share', params: { id } })} hitSlop={8}>
                  <Text style={{ color: colors.primary }}>Compartir</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView>
        <Text style={styles.role}>Tu acceso: {ROLE_LABELS[role]}</Text>

        <View style={styles.monthHeader}>
          <Pressable onPress={() => shiftMonth(-1)} hitSlop={12}>
            <Text style={styles.arrow}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>{formatMonth(cursor.year, cursor.month)}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={12}>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        </View>

        <MonthGrid
          year={cursor.year}
          month={cursor.month}
          totals={totals}
          onSelectDay={(date) => router.push({ pathname: '/calendar/[id]/day/[date]', params: { id, date } })}
        />

        <Text style={styles.total}>Total del mes: {formatCents(monthTotal, calendar.currency)}</Text>

        {canWrite(role) && (
          <Button
            title="Agregar gasto de hoy"
            onPress={() => router.push({ pathname: '/calendar/[id]/add-expense', params: { id, date: today() } })}
          />
        )}

        {canManageSharing(role) && sharedWith > 0 && (
          <View style={styles.access}>
            <Button
              variant="secondary"
              title={`Quitar acceso (${sharedWith} ${sharedWith === 1 ? 'persona' : 'personas'})`}
              onPress={() => router.push({ pathname: '/calendar/[id]/access', params: { id } })}
            />
          </View>
        )}

        {canDeleteCalendar(role) && (
          <View style={styles.dangerZone}>
            <Button variant="danger" title="Eliminar calendario" onPress={confirmDeleteCalendar} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  role: { color: colors.muted, marginBottom: spacing.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthTitle: { fontSize: 18, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  arrow: { fontSize: 28, color: colors.primary, paddingHorizontal: spacing.md },
  access: { marginTop: spacing.md },
  dangerZone: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  total: { fontSize: 16, fontWeight: '600', color: colors.text, marginVertical: spacing.md, textAlign: 'right' },
});
