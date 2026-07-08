/**
 * AGG-1 — integration tests for the canonical money-aggregation rules
 * (lib/db/queries/money.ts) through getDashboardMetrics against the REAL
 * database. Documents (incl. credit/debit notes satisfying the live
 * numbering triggers) are inserted directly; the suite self-cleans.
 *
 * Ledger under test:
 *   A  invoice     finalized  paid     1000
 *   B  invoice     finalized  unpaid    600   (overdue)
 *   C  invoice     finalized  partial   300   (overdue)
 *   D  credit note finalized  paid      200   (against A)
 *   E  credit note finalized  unpaid    150   (against B)
 *   F  debit note  finalized  unpaid     50   (against A)
 *   G  invoice     draft               9999   (must never count)
 *   H  invoice     cancelled           7777   (must never count)
 *
 * Expected:  collected = 1000 − 200                = 800
 *            outstanding = 600 + 300 − 150 + 50    = 800
 *            overdueCount = 2 (B and C — partial counts too)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, like, inArray } from 'drizzle-orm';
import { db, client } from '@/lib/db/drizzle';
import {
  users,
  companies,
  companyMembers,
  invoices,
  activityLogs,
  CompanyRole,
} from '@/lib/db/schema';
import { getDashboardMetrics } from '@/lib/db/queries/dashboard';

const RUN = Date.now().toString();
const TEST_MARKER = '[AGG1-TEST]';
const EMAIL = `agg1-money-${RUN}@test.local`;
const EIK = `6${RUN.slice(-8)}`;

let userId: number;
let companyId: number;

async function purgeLeftovers(): Promise<void> {
  const stale = await db
    .select({ id: companies.id })
    .from(companies)
    .where(like(companies.legalName, `${TEST_MARKER}%`));
  const ids = stale.map((c) => c.id);
  if (ids.length > 0) {
    await db.delete(activityLogs).where(inArray(activityLogs.companyId, ids));
    await db.delete(invoices).where(inArray(invoices.companyId, ids));
    await db
      .delete(companyMembers)
      .where(inArray(companyMembers.companyId, ids));
    await db.delete(companies).where(inArray(companies.id, ids));
  }
  await db.delete(users).where(like(users.email, 'agg1-money-%@test.local'));
}

beforeAll(async () => {
  await purgeLeftovers();

  const [u] = await db
    .insert(users)
    .values({ name: 'AGG1 Tester', email: EMAIL, passwordHash: 'x' })
    .returning({ id: users.id });
  if (!u) throw new Error('failed to create test user');
  userId = u.id;

  const [c] = await db
    .insert(companies)
    .values({
      legalName: `${TEST_MARKER} Money Rules ${RUN}`,
      eik: EIK,
      city: 'София',
      street: 'тест',
    })
    .returning({ id: companies.id });
  if (!c) throw new Error('failed to create test company');
  companyId = c.id;

  await db.insert(companyMembers).values({
    userId,
    companyId,
    role: CompanyRole.OWNER,
  });

  const gross = (n: number) => ({
    netAmount: n,
    vatAmount: 0,
    grossAmount: n,
  });
  const base = {
    companyId,
    createdByUserId: userId,
    series: 'INV',
    issueDate: '2026-01-10',
    currency: 'EUR',
    fxRate: '1',
    items: [],
  };

  // Numbering trigger: invoices strictly increasing per (company, series);
  // notes inherit the parent's series + number.
  const [a] = await db
    .insert(invoices)
    .values({
      ...base,
      docType: 'invoice',
      status: 'finalized',
      paymentStatus: 'paid',
      number: 1,
      totals: gross(1000),
    })
    .returning({ id: invoices.id, number: invoices.number });
  const [b] = await db
    .insert(invoices)
    .values({
      ...base,
      docType: 'invoice',
      status: 'finalized',
      paymentStatus: 'unpaid',
      number: 2,
      dueDate: '2026-02-01',
      totals: gross(600),
    })
    .returning({ id: invoices.id, number: invoices.number });
  await db.insert(invoices).values({
    ...base,
    docType: 'invoice',
    status: 'finalized',
    paymentStatus: 'partial',
    number: 3,
    dueDate: '2026-02-01',
    totals: gross(300),
  });
  if (!a || !b) throw new Error('failed to seed invoices');

  await db.insert(invoices).values({
    ...base,
    docType: 'credit_note',
    status: 'finalized',
    paymentStatus: 'paid',
    number: a.number,
    referencedInvoiceId: a.id,
    totals: gross(200),
  });
  await db.insert(invoices).values({
    ...base,
    docType: 'credit_note',
    status: 'finalized',
    paymentStatus: 'unpaid',
    number: b.number,
    referencedInvoiceId: b.id,
    totals: gross(150),
  });
  await db.insert(invoices).values({
    ...base,
    docType: 'debit_note',
    status: 'finalized',
    paymentStatus: 'unpaid',
    number: a.number,
    referencedInvoiceId: a.id,
    totals: gross(50),
  });

  await db.insert(invoices).values({
    ...base,
    docType: 'invoice',
    status: 'draft',
    paymentStatus: 'unpaid',
    number: 4,
    totals: gross(9999),
  });
  await db.insert(invoices).values({
    ...base,
    docType: 'invoice',
    status: 'cancelled',
    paymentStatus: 'unpaid',
    number: 5,
    totals: gross(7777),
  });
}, 60_000);

afterAll(async () => {
  await purgeLeftovers();
  await client.end();
}, 60_000);

describe('AGG-1 money-aggregation rules (real DB)', () => {
  it('nets credit/debit notes and keeps partial documents visible', async () => {
    const metrics = await getDashboardMetrics(userId);
    const co = metrics.companies.find((c) => c.companyId === companyId);
    expect(co).toBeDefined();
    if (!co) return;

    // collected: 1000 (paid invoice) − 200 (paid CN)
    expect(co.revenue).toBe(800);
    // outstanding: 600 (unpaid) + 300 (partial) − 150 (unpaid CN) + 50 (DN)
    expect(co.outstanding).toBe(800);
    // overdue: unpaid B + partial C — partial no longer vanishes
    expect(co.overdueCount).toBe(2);

    // drafts + cancelled never count anywhere
    expect(co.revenue + co.outstanding).toBe(1600);
  });
});
