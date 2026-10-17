import { useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { confirmRevokeAccess } from '@/components/confirmRevokeAccess';
import { PermissionPicker } from '@/components/PermissionPicker';
import { colors, spacing } from '@/components/theme';
import { EmptyState, Loading, Screen } from '@/components/ui';
import { useCurrentUser } from '@/context/AuthContext';
import { useCalendar } from '@/hooks/useCalendar';
import { canManageSharing } from '@/lib/permissions';
import { shareCalendar } from '@/services/calendars';
import type { SharePermission } from '@/types/models';

/** Owner-only list of the people a calendar is shared with: change their permission or revoke access. */
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
    .map(([uid, memberRole]) => ({ uid, role: memberRole as SharePermission, name: calendar.memberNames[uid] ?? uid }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es-AR'));

  const changeRole = (uid: string, displayName: string, next: SharePermission) =>
    shareCalendar(id, { uid, displayName }, next).catch((e) =>
      Alert.alert('No se pudo cambiar el permiso', e instanceof Error ? e.message : String(e)),
    );

  if (members.length === 0) return <EmptyState message="Este calendario no está compartido con nadie." />;

  return (
    <Screen>
      <ScrollView>
        <Text style={styles.intro}>
          Cambiá qué puede hacer cada persona, o quitales el acceso: dejarán de ver &quot;{calendar.name}&quot; y sus
          gastos.
        </Text>
        {members.map((m) => (
          <View key={m.uid} style={styles.member}>
            <Text style={styles.memberName}>{m.name}</Text>
            <PermissionPicker value={m.role} onChange={(p) => changeRole(m.uid, m.name, p)} />
            <Pressable onPress={() => confirmRevokeAccess(id, m.uid, m.name)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.remove}>Quitar acceso</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.muted, marginBottom: spacing.md },
  member: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  memberName: { fontSize: 16, fontWeight: '600', color: colors.text },
  remove: { color: colors.danger },
});
