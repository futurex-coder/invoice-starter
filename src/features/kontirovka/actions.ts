'use server';

import { action, type ActionResult } from '@/lib/actions/result';
import { requireCompanyAccess } from '@/lib/auth/guards';
import {
  getSalesLedger,
  getPurchaseLedger,
  type SalesLedgerRow,
  type PurchaseLedgerRow,
} from '@/lib/db/queries/dnevnik';

export interface MonthDnevnik {
  /** The ISO month these ledgers cover, e.g. "2026-07". */
  month: string;
  /** Дневник продажби — one row per outgoing document. */
  sales: SalesLedgerRow[];
  /** Дневник покупки — one row per confirmed received document. */
  purchases: PurchaseLedgerRow[];
}

/**
 * KONT-1 Slice 1 — the per-document ДДС дневник (sales + purchases) behind a
 * single month on the VAT page. Read-only: it reconciles to getVatSummary for
 * that month (Σ sales vat === vatIssued, Σ purchase vat === vatPaid CN-free).
 */
export async function getDnevnikForMonth(
  month: string
): Promise<ActionResult<MonthDnevnik>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) throw new Error('Невалиден месец');
    const year = Number(m[1]);
    const mon = Number(m[2]);
    if (mon < 1 || mon > 12) throw new Error('Невалиден месец');
    // last calendar day of the month (date column comparison must be valid)
    const lastDay = new Date(year, mon, 0).getDate();
    const range = {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    };

    const [sales, purchases] = await Promise.all([
      getSalesLedger(companyId, range),
      getPurchaseLedger(companyId, range),
    ]);

    return { month, sales, purchases };
  });
}
