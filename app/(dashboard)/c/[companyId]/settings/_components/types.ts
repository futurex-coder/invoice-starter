export type PaymentMethod = 'bank' | 'cash' | 'barter';

export interface MemberSummary {
  userId: number;
  userName: string;
  userEmail: string;
  role: string;
}

export const CURRENCIES = ['EUR', 'BGN'] as const;

export const PAYMENT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'bank', label: 'Банков път' },
  { value: 'cash', label: 'В брой' },
  { value: 'barter', label: 'Бартер' },
] as const;

export function isPaymentMethod(value: string): value is PaymentMethod {
  return value === 'bank' || value === 'cash' || value === 'barter';
}
