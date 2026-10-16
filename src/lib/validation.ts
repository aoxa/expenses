// Form validators. Each returns an error message in Spanish, or null if valid.

/** Firebase Auth rejects passwords shorter than this. */
export const MIN_PASSWORD_LENGTH = 6;
/** Must match the limit in firebase/firestore.rules. */
export const MAX_DESCRIPTION_LENGTH = 200;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Ingresá tu email.';
  if (!EMAIL_RE.test(email.trim())) return 'El email no es válido.';
  return null;
}

export function validatePassword(password: string, { isNew }: { isNew: boolean }): string | null {
  if (!password) return 'Ingresá tu contraseña.';
  if (isNew && password.length < MIN_PASSWORD_LENGTH) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

export function validateName(name: string): string | null {
  return name.trim() ? null : 'Ingresá tu nombre.';
}

/** Phone is optional, but if present it needs enough digits to be matched. */
export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null;
  return phone.replace(/\D/g, '').length >= 8 ? null : 'El teléfono no es válido.';
}

/**
 * Parses an amount typed in Argentine format ("1.250,50") or with a decimal
 * point ("1250.50") into integer cents. Returns null if it isn't a number.
 */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/\s/g, '');
  if (s.includes(',')) {
    // Comma is the decimal separator; dots are thousands separators.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.250" with no comma: dots are thousands separators.
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export function validateAmount(input: string): { cents: number; error: null } | { cents: null; error: string } {
  if (!input.trim()) return { cents: null, error: 'Ingresá un monto.' };
  const cents = parseAmount(input);
  if (cents === null) return { cents: null, error: 'Monto inválido. Usá un formato como 1.250,50' };
  if (cents <= 0) return { cents: null, error: 'El monto debe ser mayor a 0.' };
  return { cents, error: null };
}

/** Maps Firebase Auth error codes to messages for the user. */
export function authErrorMessage(e: unknown): string {
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email o contraseña incorrectos.';
    case 'auth/invalid-email':
      return 'El email no es válido.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese email.';
    case 'auth/weak-password':
      return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Probá de nuevo en unos minutos.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
    default:
      return e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
  }
}
