import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { confirmRevokeAccess } from '@/components/confirmRevokeAccess';
import { colors, spacing } from '@/components/theme';
import { Button, EmptyState, Loading, Screen } from '@/components/ui';
import { useCurrentUser } from '@/context/AuthContext';
import { useCalendar } from '@/hooks/useCalendar';
import { canManageSharing, ROLE_LABELS } from '@/lib/permissions';

/** Owner-only list of the people a calendar is shared with, to revoke their access. */
export default function AccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const { calendar, role, loading } = useCalendar(id);

  if (loading) return <Loading />;
  if (!calendar || !canManageSharing(role)) {
    return <EmptyState message="Solo el propietario puede gestionar el acceso a este calendario." />;
  }

  const members = Object.entries(calendar.members)
    .filter(([uid]) => uid !== user.uid)
    .map(([uid, memberRole]) => ({ uid, role: memberRole, name: calendar.memberNames[uid] ?? uid }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es-AR'));

  if (members.length === 0) return <EmptyState message="Este calendario no está compartido con nadie." />;

  return (
    <Screen>
      <ScrollView>
        <Text style={styles.intro}>
          Las personas a las que les quites el acceso dejarán de ver &quot;{calendar.name}&quot; y sus gastos.
        </Text>
        {members.map((m) => (
          <View key={m.uid} style={styles.member}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.muted}>{ROLE_LABELS[m.role]}</Text>
            </View>
            <Button variant="danger" title="Quitar acceso" onPress={() => confirmRevokeAccess(id, m.uid, m.name)} />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, marginBottom: spacing.md },
  muted: { color: colors.muted },
  member: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  memberInfo: { gap: 2 },
  memberName: { fontSize: 16, fontWeight: '600', color: colors.text },
});
