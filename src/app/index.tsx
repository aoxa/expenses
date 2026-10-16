import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BiometricToggle } from '@/components/BiometricToggle';
import { SegmentedControl } from '@/components/SegmentedControl';
import { colors, spacing } from '@/components/theme';
import { Button, EmptyState, Field, Loading, Screen } from '@/components/ui';
import { useCurrentUser } from '@/context/AuthContext';
import { CURRENCY_LABELS } from '@/lib/money';
import { getRole, ROLE_LABELS } from '@/lib/permissions';
import { signOut } from '@/services/auth';
import { createCalendar, subscribeMyCalendars } from '@/services/calendars';
import { CURRENCIES, type Currency, type ExpenseCalendar } from '@/types/models';

export default function CalendarsScreen() {
  const user = useCurrentUser();
  const [calendars, setCalendars] = useState<ExpenseCalendar[] | null>(null);
  const [newName, setNewName] = useState('');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [creating, setCreating] = useState(false);

  useEffect(() => subscribeMyCalendars(user.uid, setCalendars), [user.uid]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const id = await createCalendar({
        name: newName.trim(),
        currency,
        ownerId: user.uid,
        ownerName: user.displayName ?? user.email ?? 'Yo',
      });
      setNewName('');
      router.push({ pathname: '/calendar/[id]', params: { id } });
    } catch (e) {
      Alert.alert('No se pudo crear el calendario', e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={signOut} hitSlop={8}>
              <Text style={{ color: colors.primary }}>Cerrar sesión</Text>
            </Pressable>
          ),
        }}
      />

      <Field label="Nuevo calendario" placeholder="Ej.: Casa, Viaje a Bariloche" value={newName} onChangeText={setNewName} />
      <Text style={styles.label}>Moneda</Text>
      <SegmentedControl options={CURRENCIES} labels={CURRENCY_LABELS} value={currency} onChange={setCurrency} />
      <View style={{ height: spacing.sm }} />
      <Button title="Crear calendario" onPress={create} loading={creating} disabled={!newName.trim()} />

      {calendars === null ? (
        <Loading />
      ) : (
        <FlatList
          style={{ marginTop: spacing.md }}
          data={calendars}
          keyExtractor={(c) => c.id}
          ListEmptyComponent={<EmptyState message="Todavía no tenés calendarios. Creá uno o pedile a alguien que comparta el suyo." />}
          renderItem={({ item }) => {
            const role = getRole(item, user.uid);
            const owner = item.memberNames[item.ownerId];
            return (
              <Pressable
                style={styles.card}
                onPress={() => router.push({ pathname: '/calendar/[id]', params: { id: item.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {item.name} <Text style={styles.muted}>· {item.currency}</Text>
                  </Text>
                  {role !== 'owner' && <Text style={styles.muted}>Compartido por {owner}</Text>}
                </View>
                {role && <Text style={styles.badge}>{ROLE_LABELS[role]}</Text>}
              </Pressable>
            );
          }}
        />
      )}

      <BiometricToggle uid={user.uid} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, marginBottom: spacing.xs, fontSize: 13 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  muted: { color: colors.muted, marginTop: 2 },
  badge: { color: colors.primary, fontSize: 12, fontWeight: '600' },
});
