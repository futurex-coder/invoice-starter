/**
 * KONT-1 Slice 4 — the REAL VAT for a period, aggregated from POSTED контировки
 * (not the accrual Прогноза). Sums journal_tax_lines over live document postings:
 *
 *   изходящ ДДС (кл.20 proxy)  = Σ vat_base where register = 'sales'
 *   входящ ДДС  (кл.40 proxy)  = Σ vat_base where register = 'purchases' (deductible)
 *   нето                        = изходящ − входящ   (>0 за внасяне кл.50, <0 кл.60)
 *
 * Only `status='posted' AND kind='document'` rows count: a reversed original is
 * `status='reversed'` (excluded) and its counter-entry is `kind='reversal'`
 * (excluded), so a сторно nets to zero without double-subtracting. A re-posted
 * document is a fresh `kind='document'` row and counts once. Amounts are in the
 * company base currency (vat_base).
 */

import { and, eq, sql } from 'drizzle-orm';
import { db } from '../drizzle';
import { journalEntries, journalTaxLines } from '../schema';

export interface PostedVatPeriod {
  /** 'YYYY-MM' */
  period: string;
  /** изходящ ДДС (output) in base currency. */
  outputVat: number;
  /** входящ ДДС (deductible input) in base currency. */
  inputVat: number;
  /** output − input: >0 ДДС за внасяне (кл.50), <0 за възстановяване (кл.60). */
  netVat: number;
  /** distinct posted sales documents in the period. */
  salesCount: number;
  /** distinct posted purchase documents in the period. */
  purchasesCount: number;
}

export async function getPostedVatForPeriod(
  companyId: number,
  period: string
): Promise<PostedVatPeriod> {
  const rows = await db
    .select({
      register: journalTaxLines.register,
      vat: sql<string>`COALESCE(SUM(${journalTaxLines.vatBase}), 0)`,
      cnt: sql<number>`COUNT(DISTINCT ${journalEntries.id})`,
    })
    .from(journalTaxLines)
    .innerJoin(
      journalEntries,
      eq(journalTaxLines.journalEntryId, journalEntries.id)
    )
    .where(
      and(
        eq(journalEntries.companyId, companyId),
        eq(journalEntries.vatPeriod, period),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.kind, 'document')
      )
    )
    .groupBy(journalTaxLines.register);

  let outputVat = 0;
  let inputVat = 0;
  let salesCount = 0;
  let purchasesCount = 0;
  for (const r of rows) {
    if (r.register === 'sales') {
      outputVat = Number(r.vat);
      salesCount = Number(r.cnt);
    } else if (r.register === 'purchases') {
      inputVat = Number(r.vat);
      purchasesCount = Number(r.cnt);
    }
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  outputVat = round2(outputVat);
  inputVat = round2(inputVat);
  return {
    period,
    outputVat,
    inputVat,
    netVat: round2(outputVat - inputVat),
    salesCount,
    purchasesCount,
  };
}
