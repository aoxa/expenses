/**
 * Normalizes a phone number so the same number typed differently matches.
 *
 * This keeps only digits and compares the last 9, which ignores country and
 * trunk prefixes in most countries. It's a simple heuristic for the boilerplate.
 * For production, store E.164 numbers (e.g. with libphonenumber-js) and verify
 * them with Firebase phone auth.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.slice(-9);
}
