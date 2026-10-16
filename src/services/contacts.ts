import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';

import { normalizePhone } from '@/lib/phone';

export interface DeviceContact {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
}

const FIELDS = [ContactField.FULL_NAME, ContactField.EMAILS, ContactField.PHONES] as const;

/** Returns contacts that have at least an email or phone, or null if permission was denied. */
export async function loadDeviceContacts(): Promise<DeviceContact[] | null> {
  const { granted } = await requestPermissionsAsync();
  if (!granted) return null;

  const details = await Contact.getAllDetails(FIELDS);
  return details
    .map((c) => ({
      id: c.id,
      name: c.fullName ?? '(sin nombre)',
      emails: (c.emails ?? []).map((e) => e.address?.trim().toLowerCase()).filter((e): e is string => !!e),
      phones: (c.phones ?? []).map((p) => (p.number ? normalizePhone(p.number) : '')).filter(Boolean),
    }))
    .filter((c) => c.emails.length > 0 || c.phones.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
