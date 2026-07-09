/**
 * KONT-1 Slice 3 — integration test for posting a purchase контировка from a
 * confirmed received invoice. Real actions + triggers against the real DB
 * (POSTGRES_URL); only the cookie auth guard is mocked. Marker-named throwaway
 * company. Covers: derive → post (full credit) → lock → re-post block → guards →
 * reverse → re-post; plus the чл.70 no-credit variant.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { eq, like, inArray } from 'drizzle-orm';
import { db, client } from '@/lib/db/drizzle';
import {
  users,
  companies,
  companyMembers,
  activityLogs,
  receivedInvoices,
  journalEntries,
  journalLines,
  journalTaxLines,
  CompanyRole,
  type User,
} from '@/lib/db/schema';
import type { CompanyAccessContext } from '@/lib/auth/guards';
import type { ActionResult } from '@/lib/actions/result';
import {
  getReceivedInvoiceContraPreview,
  postReceivedInvoiceContra,
  reverseReceivedInvoiceContra,
} from './actions';
import {
  setReceivedInvoiceAccountingStatus,
  deleteReceivedInvoice,
} from '@/src/features/received-invoices/actions';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 60_000 });

// received-invoices/actions pulls in supabase storage → `server-only`, which
// throws outside a real RSC. Neutralise it (we never hit the storage path — the
// delete under test is refused by the posting guard before deleteFromBucket).
vi.mock('server-only', () => ({}));

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
const MARKER = '[KONT-PURCH-TEST]';
const OWNER_EMAIL = `kont-purch-${RUN}@test.local`;
const COMPANY_EIK = `9${RUN.slice(-8)}`;
const SUPPLIER_EIK = `2${RUN.slice(-8)}`;
const TODAY = new Date().toISOString().slice(0, 10);

let owner: User;
let companyId: number;

function unwrap<T>(r: ActionResult<T>, label: string): T {
  if (r.data === undefined) throw new Error(`${label}: ${r.error ?? 'no data'}`);
  return r.data;
}
function unwrapError<T>(r: ActionResult<T>, label: string): string {
  if (r.error === undefined) throw new Error(`${label} unexpectedly ok`);
  return r.error;
}

/** Insert a confirmed received invoice directly (bypasses the upload/AI flow). */
async function seedConfirmedReceived(opts: {
  net: number;
  vat: number;
  gross: number;
  number: string;
}): Promise<number> {
  const [ri] = await db
    .insert(receivedInvoices)
    .values({
      companyId,
      status: 'confirmed',
      fileBucket: 'test',
      fileObjectKey: `test/${RUN}-${opts.number}`,
      fileMimeType: 'application/pdf',
      fileSizeBytes: 1,
      fileOriginalName: `${opts.number}.pdf`,
      invoiceNumber: opts.number,
      issueDate: TODAY,
      currency: 'EUR',
      fxRate: '1',
      netAmount: String(opts.net),
      vatAmount: String(opts.vat),
      grossAmount: String(opts.gross),
      supplierSnapshot: {
        legalName: 'Доставчик ООД',
        eik: SUPPLIER_EIK,
        vatNumber: `BG${SUPPLIER_EIK}`,
      },
      confirmedAt: new Date(),
    })
    .returning({ id: receivedInvoices.id });
  if (!ri) throw new Error('seed received invoice');
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
  await db.delete(users).where(like(users.email, 'kont-purch-%@test.local'));
}

beforeAll(async () => {
  await purge();
  const [u] = await db
    .insert(users)
    .values({ name: 'Kont Purch Owner', email: OWNER_EMAIL, passwordHash: 'test' })
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

describe('postReceivedInvoiceContra — full credit (default)', () => {
  it('derives Dr 602 + Dr 453/1 / Cr 401, posts, locks, guards, reverses, re-posts', async () => {
    const riId = await seedConfirmedReceived({ net: 1000, vat: 200, gross: 1200, number: 'F-100' });

    // preview: full-credit purchase, balanced
    const preview = unwrap(await getReceivedInvoiceContraPreview(riId), 'preview');
    expect(preview.dealType).toBe('purchase');
    expect(preview.vatOperation).toBe('purchase_full_20');
    expect(preview.balanced).toBe(true);
    expect(preview.hasVat).toBe(true);
    expect(preview.alreadyPosted).toBe(false);
    expect(preview.lines.find((l) => l.code === '602')).toMatchObject({ side: 'debit', amount: 1000 });
    expect(preview.lines.find((l) => l.code === '453/1')).toMatchObject({ side: 'debit', amount: 200 });
    expect(preview.lines.find((l) => l.code === '401/2')).toMatchObject({
      side: 'credit',
      name: 'Доставчици в евро',
      amount: 1200,
    });

    // post
    const posted = unwrap(await postReceivedInvoiceContra(riId), 'post');

    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, posted.entryId));
    expect(entry?.status).toBe('posted');
    expect(entry?.dealType).toBe('purchase');
    expect(entry?.sourceReceivedInvoiceId).toBe(riId);
    expect(entry?.vatPeriod).toBe(TODAY.slice(0, 7));

    const lines = await db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, posted.entryId));
    expect(lines.length).toBe(3);
    const sum = (side: string) =>
      lines.filter((l) => l.side === side).reduce((s, l) => s + Number(l.amountBase), 0);
    expect(Math.round(sum('debit') * 100)).toBe(Math.round(sum('credit') * 100));
    expect(Math.round(sum('debit') * 100)).toBe(120000);

    // tax line → дневник покупки cell 31/41, full VAT credit
    const [tax] = await db
      .select()
      .from(journalTaxLines)
      .where(eq(journalTaxLines.journalEntryId, posted.entryId));
    expect(tax?.register).toBe('purchases');
    expect(tax?.baseCell).toBe('31');
    expect(tax?.vatCell).toBe('41');
    expect(Number(tax?.base)).toBe(1000);
    expect(Number(tax?.vat)).toBe(200);

    // source locked
    const [locked] = await db
      .select({ acc: receivedInvoices.accountingStatus })
      .from(receivedInvoices)
      .where(eq(receivedInvoices.id, riId));
    expect(locked?.acc).toBe('accounted');

    // re-post blocked
    expect(unwrapError(await postReceivedInvoiceContra(riId), 're-post')).toMatch(/осчетоводен/i);

    // guards: un-account + delete refused while posted
    expect(
      unwrapError(await setReceivedInvoiceAccountingStatus(riId, 'pending'), 'un-account')
    ).toMatch(/сторнирайте контировката/i);
    expect(unwrapError(await deleteReceivedInvoice(riId), 'delete')).toMatch(
      /сторнирайте контировката/i
    );

    // reverse → source unlocked → re-post works (index excludes reversed)
    const rev = unwrap(await reverseReceivedInvoiceContra(riId), 'reverse');
    expect(rev.postingNumber).toBeGreaterThan(posted.postingNumber);
    const [unlocked] = await db
      .select({ acc: receivedInvoices.accountingStatus })
      .from(receivedInvoices)
      .where(eq(receivedInvoices.id, riId));
    expect(unlocked?.acc).toBe('pending');

    const reposted = unwrap(await postReceivedInvoiceContra(riId), 're-post-2');
    expect(reposted.entryId).not.toBe(posted.entryId);
  });
});

describe('postReceivedInvoiceContra — чл.70 no credit', () => {
  it('capitalises the VAT into the cost: Dr 602 gross / Cr 401 gross, кл.30, no deductible VAT', async () => {
    const riId = await seedConfirmedReceived({ net: 500, vat: 100, gross: 600, number: 'F-200' });

    const preview = unwrap(
      await getReceivedInvoiceContraPreview(riId, { basis: 'services', noCredit: true }),
      'preview'
    );
    expect(preview.vatOperation).toBe('purchase_no_credit');
    expect(preview.noCredit).toBe(true);
    expect(preview.balanced).toBe(true);
    // gross debited to the expense, no separate 453/1 leg
    expect(preview.lines.find((l) => l.code === '602')).toMatchObject({ side: 'debit', amount: 600 });
    expect(preview.lines.find((l) => l.code === '401/2')).toMatchObject({ side: 'credit', amount: 600 });
    expect(preview.lines.find((l) => l.code === '453/1')).toBeUndefined();

    const posted = unwrap(
      await postReceivedInvoiceContra(riId, { basis: 'services', noCredit: true }),
      'post'
    );
    const [tax] = await db
      .select()
      .from(journalTaxLines)
      .where(eq(journalTaxLines.journalEntryId, posted.entryId));
    expect(tax?.register).toBe('purchases');
    expect(tax?.baseCell).toBe('30');
    expect(tax?.vatCell).toBeNull();
    expect(Number(tax?.base)).toBe(500);
    expect(Number(tax?.vat)).toBe(0); // non-deductible — capitalised into the cost
  });
});

describe('postReceivedInvoiceContra — basis picker', () => {
  it('routes the expense to the chosen account (goods → 304)', async () => {
    const riId = await seedConfirmedReceived({ net: 300, vat: 60, gross: 360, number: 'F-300' });
    const preview = unwrap(
      await getReceivedInvoiceContraPreview(riId, { basis: 'goods', noCredit: false }),
      'preview'
    );
    expect(preview.basis).toBe('goods');
    expect(preview.lines.find((l) => l.side === 'debit' && l.code === '304')).toMatchObject({
      amount: 300,
    });
  });
});
