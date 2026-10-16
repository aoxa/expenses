import { LOCALE } from './dates';
import type { Currency } from '@/types/models';

export const CURRENCY_LABELS: Record<Currency, string> = {
  ARS: 'Pesos (ARS)',
  USD: 'Dólares (USD)',
};

export function formatCents(cents: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
