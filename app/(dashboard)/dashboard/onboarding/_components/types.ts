export type PaymentMethod = 'bank' | 'cash' | 'barter';

export interface ArticleRow {
  name: string;
  unit: string;
  defaultUnitPrice: string;
}

export const CURRENCIES = ['BGN', 'EUR', 'USD'] as const;

export const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'bank', label: 'Банков път (Bank)' },
  { value: 'cash', label: 'В брой (Cash)' },
  { value: 'barter', label: 'Бартер (Barter)' },
] as const;

export const UNITS = [
  'бр.', 'кг', 'л', 'м', 'услуга', 'час', 'ден', 'км', 'кв.м', 'куб.м',
] as const;

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === 'bank' || value === 'cash' || value === 'barter';
}
