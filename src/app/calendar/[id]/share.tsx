import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, Text, TextInput } from 'react-native';

import { PermissionPicker } from '@/components/PermissionPicker';
import { colors, spacing } from '@/components/theme';
import { EmptyState, Loading, Screen } from '@/components/ui';
import { useCurrentUser } from '@/context/AuthContext';
import { useCalendar } from '@/hooks/useCalendar';
import { canManageSharing, ROLE_LABELS } from '@/lib/permissions';
import { findUserByContact, shareCalendar } from '@/services/calendars';
import { loadDeviceContacts, type DeviceContact } from '@/services/contacts';
import type { SharePermission } from '@/types/models';

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const { calendar, role, loading } = useCalendar(id);

  const [permission, setPermission] = useState<SharePermission>('read');
  const [contacts, setContacts] = useState<DeviceContact[] | null>(null);
  const [contactsDenied, setContactsDenied] = useState(false);
  const [search, setSearch] = useState('');
  const [busyContactId, setBusyContactId] = useState<string | null>(null);

  useEffect(() => {
    loadDeviceContacts()
      .then((list) => (list ? setContacts(list) : setContactsDenied(true)))
      .catch(() => setContactsDenied(true));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contacts ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [contacts, search]);

  if (loading) return <Loading />;
  if (!calendar || !canManageSharing(role)) return <EmptyState message="Solo el propietario puede compartir este calendario." />;

  const sharedWith = calendar.memberIds.filter((uid) => uid !== user.uid).length;

  const shareWith = async (contact: DeviceContact) => {
    setBusyContactId(contact.id);
    try {
      const found = await findUserByContact(contact.emails, contact.phones);
      if (!found) {
        // Not registered yet: invite them through the system share sheet.
        Alert.alert(`${contact.name} todavía no usa la app`, '¿Querés enviarle una invitación?', [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Invitar',
            onPress: () =>
              Share.share({
                message: `Quiero compartir con vos mis gastos de "${calendar.name}". Instalá Gastario y registrate con este teléfono o email.`,
              }),
          },
        ]);
        return;
      }
      if (found.uid === user.uid) {
        Alert.alert('Sos vos', 'Elegí a otra persona.');
        return;
      }
      await shareCalendar(id, found, permission);
      Alert.alert('Compartido', `${found.displayName} ahora tiene acceso "${ROLE_LABELS[permission]}".`);
    } catch (e) {
      Alert.alert('No se pudo compartir', e instanceof Error ? e.message : String(e));
    } finally {
      setBusyContactId(null);
    }
  };

  return (
    <Screen>
      {sharedWith === 0 ? (
        <>
          <Text style={styles.section}>Personas con acceso</Text>
          <Text style={styles.muted}>Nadie todavía.</Text>
        </>
      ) : (
        <>
          <Pressable
            style={styles.sectionToggle}
            onPress={() => router.push({ pathname: '/calendar/[id]/access', params: { id } })}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text style={[styles.section, styles.sectionInToggle]}>Personas con acceso ({sharedWith})</Text>
            <Text style={styles.toggleHint}>Ver ›</Text>
          </Pressable>
        </>
      )}

      <Text style={styles.section}>Compartir con un contacto</Text>
      <PermissionPicker value={permission} onChange={setPermission} />

      {contactsDenied ? (
        <EmptyState message="Permití el acceso a tus contactos en los ajustes del sistema para compartir desde tu lista de contactos." />
      ) : contacts === null ? (
        <Loading />
      ) : (
        <>
          <TextInput
            style={styles.search}
            placeholder="Buscar contactos"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => (
              <Pressable style={styles.contact} onPress={() => shareWith(item)} disabled={busyContactId !== null}>
                <Text style={styles.contactName}>{item.name}</Text>
                <Text style={styles.muted}>{busyContactId === item.id ? 'Buscando…' : item.emails[0] ?? ''}</Text>
              </Pressable>
            )}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
  sectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionInToggle: { marginTop: 0, marginBottom: 0 },
  toggleHint: { color: colors.primary, fontWeight: '600' },
  muted: { color: colors.muted },
  search: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginVertical: spacing.sm,
    color: colors.text,
  },
  contact: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  contactName: { fontSize: 16, color: colors.text },
});
