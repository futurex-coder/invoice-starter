import type { VatMonthRow } from '@/src/features/bulgarian-invoicing/actions';

/**
 * Build the full, zero-filled month grid for a year so no month is ever
 * "missing" from the VAT table. Descending (most recent first). The current
 * year stops at the current month (no future rows); a past year shows all 12;
 * a future year shows none.
 */
export function buildMonthGrid(
  year: number,
  currentYear: number,
  currentMonthNum: number, // 1..12
  rows: readonly VatMonthRow[]
): VatMonthRow[] {
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const maxMonth =
    year < currentYear ? 12 : year === currentYear ? currentMonthNum : 0;
  const out: VatMonthRow[] = [];
  for (let m = maxMonth; m >= 1; m--) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    out.push(
      byMonth.get(key) ?? { month: key, vatIssued: 0, vatPaid: 0, vatNet: 0 }
    );
  }
  return out;
}
