import { Alert } from 'react-native';

import { revokeAccess } from '@/services/calendars';

/** Asks the owner to confirm before removing a user's access to a calendar. */
export function confirmRevokeAccess(calendarId: string, uid: string, displayName: string) {
  Alert.alert('¿Quitar acceso?', `${displayName} ya no podrá ver este calendario.`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Quitar',
      style: 'destructive',
      onPress: () =>
        revokeAccess(calendarId, uid).catch((e) =>
          Alert.alert('No se pudo quitar el acceso', e instanceof Error ? e.message : String(e)),
        ),
    },
  ]);
}
