/**
 * KONT-1 — pure display formatters for the „Меню Контиране" form. Kept out of the
 * client component so they are trivially unit-testable and reusable.
 */

/** Контировка N — 10-digit padded once posted; „(нова)" while still a draft. */
export function formatPostingNumber(n: number | null): string {
  return n == null ? '(нова)' : String(n).padStart(10, '0');
}

/** „Месец за експорт" — reformat the stored 'YYYY-MM' vatPeriod to Microinvest 'MM.YYYY'. */
export function formatExportMonth(vatPeriod: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(vatPeriod);
  return m ? `${m[2]}.${m[1]}` : vatPeriod;
}
