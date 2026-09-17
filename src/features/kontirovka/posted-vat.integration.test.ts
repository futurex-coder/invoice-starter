/**
 * KONT-1 Slice 4a — integration test for getPostedVatForPeriod: the REAL VAT of
 * a month aggregated from posted контировки. Posts a sale + a purchase into the
 * same period and asserts изходящ − входящ = нето; then reverses the sale and
 * asserts the сторно nets it out (output → 0) without double-subtracting.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { like, inArray } from 'drizzle-orm';
import { db, client } from '@/lib/db/drizzle';
import {
  users,
  companies,
  companyMembers,
  activityLogs,
  receivedInvoices,
  journalEntries,
  CompanyRole,
  type User,
} from '@/lib/db/schema';
import type { CompanyAccessContext } from '@/lib/auth/guards';
import type { ActionResult } from '@/lib/actions/result';
import {
  createInvoiceDraft,
  finalizeInvoice,
} from '@/src/features/bulgarian-invoicing/actions';
import {
  postInvoiceContra,
  reverseInvoiceContra,
  postReceivedInvoiceContra,
} from './actions';
import { getPostedVatForPeriod } from '@/lib/db/queries/vat-posted';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 60_000 });

const authState = vi.hoisted((): { ctx: CompanyAccessContext | null } => ({
  ctx: null,
}));
vi.mock('@/lib/auth/guards', () => ({
  requireCompanyAccess: async (): Promise<CompanyAccessContext> => {
    if (!authState.ctx) throw new Error('Test auth context not initialised');
    return authState.ctx;
  },
}));

const RUN = Date.now().toString();
const MARKER = '[KONT-POSTEDVAT-TEST]';
const OWNER_EMAIL = `kont-pv-${RUN}@test.local`;
// Distinct leading digit per integration file so the GLOBALLY-unique company EIK
// can't collide with a sibling file's when they run in parallel workers on the
// shared DB (posting=9, purchase=8, posted-vat=4).
const COMPANY_EIK = `4${RUN.slice(-8)}`;
const RECIPIENT_EIK = `7${RUN.slice(-8)}`;
const SUPPLIER_EIK = `2${RUN.slice(-8)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const PERIOD = TODAY.slice(0, 7);

let owner: User;
let companyId: number;

function unwrap<T>(r: ActionResult<T>, label: string): T {
  if (r.data === undefined) throw new Error(`${label}: ${r.error ?? 'no data'}`);
  return r.data;
}

async function seedConfirmedReceived(net: number, vat: number, gross: number): Promise<number> {
  const [ri] = await db
    .insert(receivedInvoices)
    .values({
      companyId,
      status: 'confirmed',
      fileBucket: 'test',
      fileObjectKey: `test/${RUN}-p`,
      fileMimeType: 'application/pdf',
      fileSizeBytes: 1,
      fileOriginalName: 'p.pdf',
      invoiceNumber: 'P-1',
      issueDate: TODAY,
      currency: 'EUR',
      fxRate: '1',
      netAmount: String(net),
      vatAmount: String(vat),
      grossAmount: String(gross),
      supplierSnapshot: { legalName: 'Доставчик ООД', eik: SUPPLIER_EIK, vatNumber: `BG${SUPPLIER_EIK}` },
      confirmedAt: new Date(),
    })
    .returning({ id: receivedInvoices.id });
  if (!ri) throw new Error('seed received');
  return ri.id;
}

async function purge(): Promise<void> {
  const stale = await db
    .select({ id: companies.id })
    .from(companies)
    .where(like(companies.legalName, `${MARKER}%`));
  const ids = stale.map((r) => r.id);
  if (ids.length > 0) {
    await db
      .update(journalEntries)
      .set({ status: 'reversed' })
      .where(inArray(journalEntries.companyId, ids));
    await db.delete(activityLogs).where(inArray(activityLogs.companyId, ids));
    await db.delete(companyMembers).where(inArray(companyMembers.companyId, ids));
    await db.delete(companies).where(inArray(companies.id, ids));
  }
  await db.delete(users).where(like(users.email, 'kont-pv-%@test.local'));
}

beforeAll(async () => {
  await purge();
  const [u] = await db
    .insert(users)
    .values({ name: 'Kont PV Owner', email: OWNER_EMAIL, passwordHash: 'test' })
    .returning();
  if (!u) throw new Error('user');
  owner = u;
  const [c] = await db
    .insert(companies)
    .values({
      legalName: `${MARKER} Тест ЕООД`,
      eik: COMPANY_EIK,
      vatNumber: `BG${COMPANY_EIK}`,
      city: 'София',
      street: 'ул. Тестова 1',
      postCode: '1000',
    })
    .returning();
  if (!c) throw new Error('company');
  companyId = c.id;
  await db.insert(companyMembers).values({ userId: owner.id, companyId, role: CompanyRole.OWNER });
  authState.ctx = { user: owner, companyId, role: CompanyRole.OWNER };
});

afterAll(async () => {
  try {
    await purge();
  } finally {
    await client.end({ timeout: 5 });
  }
});

describe('getPostedVatForPeriod', () => {
  it('aggregates output − input from posted контировки, and nets out a сторно', async () => {
    // nothing posted yet
    const empty = await getPostedVatForPeriod(companyId, PERIOD);
    expect(empty).toMatchObject({ outputVat: 0, inputVat: 0, netVat: 0, salesCount: 0, purchasesCount: 0 });

    // a posted 20% sale: output VAT 200
    const draft = unwrap(
      await createInvoiceDraft({
        docType: 'invoice',
        issueDate: TODAY,
        supplyDate: TODAY,
        currency: 'EUR',
        recipient: { name: 'Клиент ООД', eik: RECIPIENT_EIK, city: 'Пловдив', street: 'ул. 2' },
        lineItems: [{ description: 'Услуга', quantity: 1, unit: 'бр.', unitPrice: 1000, vatRate: 20 }],
      }),
      'draft'
    );
    const inv = unwrap(await finalizeInvoice(draft.id), 'finalize');
    unwrap(await postInvoiceContra(inv.id), 'post-sale');

    // a posted full-credit purchase: input VAT 80
    const riId = await seedConfirmedReceived(400, 80, 480);
    unwrap(await postReceivedInvoiceContra(riId), 'post-purchase');

    const both = await getPostedVatForPeriod(companyId, PERIOD);
    expect(both.outputVat).toBe(200);
    expect(both.inputVat).toBe(80);
    expect(both.netVat).toBe(120); // >0 → ДДС за внасяне
    expect(both.salesCount).toBe(1);
    expect(both.purchasesCount).toBe(1);

    // reverse the sale → its output nets out; the purchase input remains
    unwrap(await reverseInvoiceContra(inv.id), 'reverse-sale');
    const afterReverse = await getPostedVatForPeriod(companyId, PERIOD);
    expect(afterReverse.outputVat).toBe(0);
    expect(afterReverse.salesCount).toBe(0);
    expect(afterReverse.inputVat).toBe(80);
    expect(afterReverse.netVat).toBe(-80); // <0 → ДДС за възстановяване
  });
});
