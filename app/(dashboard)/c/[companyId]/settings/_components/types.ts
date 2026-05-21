export type PaymentMethod = 'bank' | 'cash' | 'barter';

export interface MemberSummary {
  userId: number;
  userName: string;
  userEmail: string;
  role: string;
}

export const CURRENCIES = ['EUR', 'BGN'] as const;

export const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'bank', label: 'Банков път (Bank)' },
  { value: 'cash', label: 'В брой (Cash)' },
  { value: 'barter', label: 'Бартер (Barter)' },
] as const;

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === 'bank' || value === 'cash' || value === 'barter';
}
