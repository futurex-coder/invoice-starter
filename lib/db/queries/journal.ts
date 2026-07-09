import { and, eq, ne } from 'drizzle-orm';
import { db } from '../drizzle';
import { journalEntries } from '../schema';

/**
 * KONT-1 — posting-existence guard. A document with a LIVE (non-reversed)
 * контировка is locked: its edits, cancel, un-accounting and delete must all be
 * refused (correct via a reversing entry, not by mutating behind a filed ledger
 * row). Keyed on posting existence, NOT on the user-togglable accountingStatus
 * (stress #1/#3/#4).
 */
export async function invoiceHasActivePosting(
  invoiceId: number
): Promise<boolean> {
  const [row] = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.sourceInvoiceId, invoiceId),
        ne(journalEntries.status, 'reversed')
      )
    )
    .limit(1);
  return row !== undefined;
}

export async function receivedInvoiceHasActivePosting(
  receivedInvoiceId: number
): Promise<boolean> {
  const [row] = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.sourceReceivedInvoiceId, receivedInvoiceId),
        ne(journalEntries.status, 'reversed')
      )
    )
    .limit(1);
  return row !== undefined;
}
