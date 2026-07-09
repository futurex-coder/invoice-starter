/**
 * KONT-1 Slice 2 — integration test for posting a контировка from an invoice.
 * Runs the real actions + triggers against the real DB (POSTGRES_URL); only the
 * cookie auth guard is mocked. Isolated by a marker-named throwaway company.
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
  invoices,
  journalEntries,
  journalLines,
  journalTaxLines,
  CompanyRole,
  type User,
} from '@/lib/db/schema';
import type { CompanyAccessContext } from '@/lib/auth/guards';
import type { ActionResult } from '@/lib/actions/result';
import {
  createInvoiceDraft,
  finalizeInvoice,
} from '@/src/features/bulgarian-invoicing/actions';
import { getInvoiceContraPreview, postInvoiceContra } from './actions';

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
const MARKER = '[KONT-POST-TEST]';
const OWNER_EMAIL = `kont-post-${RUN}@test.local`;
const COMPANY_EIK = `9${RUN.slice(-8)}`;
const RECIPIENT_EIK = `7${RUN.slice(-8)}`;
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

async function purge(): Promise<void> {
  const stale = await db
    .select({ id: companies.id })
    .from(companies)
    .where(like(companies.legalName, `${MARKER}%`));
  const ids = stale.map((r) => r.id);
  if (ids.length > 0) {
    // neutralise posted-entry immutability so the company cascade can delete
    await db
      .update(journalEntries)
      .set({ status: 'reversed' })
      .where(inArray(journalEntries.companyId, ids));
    await db.delete(activityLogs).where(inArray(activityLogs.companyId, ids));
    await db.delete(companyMembers).where(inArray(companyMembers.companyId, ids));
    await db.delete(companies).where(inArray(companies.id, ids));
  }
  await db.delete(users).where(like(users.email, 'kont-post-%@test.local'));
}

beforeAll(async () => {
  await purge();
  const [u] = await db
    .insert(users)
    .values({ name: 'Kont Post Owner', email: OWNER_EMAIL, passwordHash: 'test' })
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

describe('postInvoiceContra', () => {
  it('derives, posts a balanced entry, locks the source, blocks re-post + edits', async () => {
    // A finalized 20% services invoice: net 1000, vat 200, gross 1200.
    const draft = unwrap(
      await createInvoiceDraft({
        docType: 'invoice',
        issueDate: TODAY,
        supplyDate: TODAY,
        currency: 'EUR',
        recipient: { name: 'Клиент ООД', eik: RECIPIENT_EIK, city: 'Пловдив', street: 'ул. 2' },
        lineItems: [
          { description: 'Услуга', quantity: 1, unit: 'бр.', unitPrice: 1000, vatRate: 20 },
        ],
      }),
      'createInvoiceDraft'
    );
    const inv = unwrap(await finalizeInvoice(draft.id), 'finalize');

    // preview: derived Дт/Кт, balanced, not yet posted
    const preview = unwrap(await getInvoiceContraPreview(inv.id), 'preview');
    expect(preview.balanced).toBe(true);
    expect(preview.alreadyPosted).toBe(false);
    expect(preview.dealType).toBe('sale');
    expect(preview.vatOperation).toBe('sale_std_20');
    const dr = preview.lines.find((l) => l.code === '411/2');
    expect(dr).toMatchObject({ side: 'debit', name: 'Клиенти в евро', amount: 1200 });
    expect(preview.lines.find((l) => l.code === '703')?.amount).toBe(1000);
    expect(preview.lines.find((l) => l.code === '453/2')?.amount).toBe(200);

    // post
    const posted = unwrap(await postInvoiceContra(inv.id), 'post');
    expect(posted.postingNumber).toBeGreaterThanOrEqual(1);

    // entry persisted, posted, linked, right period
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, posted.entryId));
    expect(entry?.status).toBe('posted');
    expect(entry?.sourceInvoiceId).toBe(inv.id);
    expect(entry?.dealType).toBe('sale');
    expect(entry?.vatPeriod).toBe(TODAY.slice(0, 7));

    // lines balance (base currency)
    const lines = await db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalEntryId, posted.entryId));
    expect(lines.length).toBe(3);
    const sum = (side: string) =>
      lines.filter((l) => l.side === side).reduce((s, l) => s + Number(l.amountBase), 0);
    expect(Math.round(sum('debit') * 100)).toBe(Math.round(sum('credit') * 100));
    expect(Math.round(sum('debit') * 100)).toBe(120000); // 1200.00

    // tax line → дневник продажби cell 11/21
    const [tax] = await db
      .select()
      .from(journalTaxLines)
      .where(eq(journalTaxLines.journalEntryId, posted.entryId));
    expect(tax?.register).toBe('sales');
    expect(tax?.baseCell).toBe('11');
    expect(tax?.vatCell).toBe('21');
    expect(Number(tax?.base)).toBe(1000);
    expect(Number(tax?.vat)).toBe(200);

    // source locked
    const [locked] = await db
      .select({ acc: invoices.accountingStatus })
      .from(invoices)
      .where(eq(invoices.id, inv.id));
    expect(locked?.acc).toBe('accounted');

    // re-post blocked
    expect(unwrapError(await postInvoiceContra(inv.id), 're-post')).toMatch(/осчетоводен/i);

    // immutability: editing a posted entry is rejected by the DB trigger
    await expect(
      db.update(journalEntries).set({ note: 'опит за промяна' }).where(eq(journalEntries.id, posted.entryId))
    ).rejects.toThrow(/неизменяема/i);
  });
});
