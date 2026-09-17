/**
 * KONT-1 Slice 1 — integration test: the per-document sales ledger RECONCILES to
 * getVatSummary.vatIssued for a month, credit notes carry negative VAT, and the
 * derived Операция по ДДС is correct. Runs the REAL server actions + queries
 * against the REAL Postgres DB (POSTGRES_URL); only the cookie auth guard is
 * mocked. Isolated by a marker-named throwaway company, purged before/after.
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
  CompanyRole,
  type User,
} from '@/lib/db/schema';
import type { CompanyAccessContext } from '@/lib/auth/guards';
import type { ActionResult } from '@/lib/actions/result';
import {
  createInvoiceDraft,
  finalizeInvoice,
  createCreditNoteFromInvoice,
  getVatSummary,
} from '@/src/features/bulgarian-invoicing/actions';
import { getSalesLedger } from './dnevnik';

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
const TEST_MARKER = '[DNEVNIK-TEST]';
const OWNER_EMAIL = `dnevnik-${RUN}@test.local`;
const COMPANY_EIK = `9${RUN.slice(-8)}`;
const RECIPIENT_EIK = `7${RUN.slice(-8)}`;
const TODAY = new Date().toISOString().slice(0, 10);
const MONTH = TODAY.slice(0, 7); // 'YYYY-MM'
const now = new Date();
const LAST_DAY = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const RANGE = {
  from: `${MONTH}-01`,
  to: `${MONTH}-${String(LAST_DAY).padStart(2, '0')}`,
};

let owner: User;
let companyId: number;

type DraftInput = Parameters<typeof createInvoiceDraft>[0];

function draftAt(rate: 20 | 9): DraftInput {
  return {
    docType: 'invoice',
    issueDate: TODAY,
    supplyDate: TODAY,
    currency: 'EUR',
    recipient: {
      name: 'Клиент Тест ООД',
      eik: RECIPIENT_EIK,
      city: 'Пловдив',
      street: 'ул. Клиентска 2',
    },
    lineItems: [
      { description: 'Консултантска услуга', quantity: 1, unit: 'бр.', unitPrice: 1000, vatRate: rate },
    ],
  };
}

function unwrap<T>(result: ActionResult<T>, label: string): T {
  if (result.data === undefined) {
    throw new Error(`${label} failed: ${result.error ?? 'no data'}`);
  }
  return result.data;
}

async function purge(): Promise<void> {
  const stale = await db
    .select({ id: companies.id })
    .from(companies)
    .where(like(companies.legalName, `${TEST_MARKER}%`));
  const ids = stale.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(activityLogs).where(inArray(activityLogs.companyId, ids));
    await db.delete(companyMembers).where(inArray(companyMembers.companyId, ids));
    await db.delete(companies).where(inArray(companies.id, ids));
  }
  await db.delete(users).where(like(users.email, 'dnevnik-%@test.local'));
}

beforeAll(async () => {
  await purge();
  const [createdOwner] = await db
    .insert(users)
    .values({ name: 'Dnevnik Owner', email: OWNER_EMAIL, passwordHash: 'test' })
    .returning();
  if (!createdOwner) throw new Error('Failed to create test user');
  owner = createdOwner;

  const [company] = await db
    .insert(companies)
    .values({
      legalName: `${TEST_MARKER} Тест ЕООД`,
      eik: COMPANY_EIK,
      vatNumber: `BG${COMPANY_EIK}`,
      city: 'София',
      street: 'ул. Тестова 1',
      postCode: '1000',
    })
    .returning();
  if (!company) throw new Error('Failed to create test company');
  companyId = company.id;
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

describe('getSalesLedger reconciles to getVatSummary', () => {
  it('sums per-document VAT to vatIssued; CN negative; ops derived', async () => {
    // Two finalized invoices (20% and 9%) + a full credit note against the 20%.
    const inv20 = unwrap(await createInvoiceDraft(draftAt(20)), 'inv20');
    unwrap(await finalizeInvoice(inv20.id), 'finalize inv20');
    const inv9 = unwrap(await createInvoiceDraft(draftAt(9)), 'inv9');
    unwrap(await finalizeInvoice(inv9.id), 'finalize inv9');
    const cn = unwrap(await createCreditNoteFromInvoice(inv20.id), 'credit note');

    const rows = await getSalesLedger(companyId, RANGE);
    // three documents this month: inv20, inv9, cn
    expect(rows.length).toBe(3);

    const r20 = rows.find((r) => r.id === inv20.id);
    const r9 = rows.find((r) => r.id === inv9.id);
    const rcn = rows.find((r) => r.id === cn.id);
    if (!r20 || !r9 || !rcn) throw new Error('expected all three ledger rows');

    // derived operations
    expect(r20.vatOperation).toBe('sale_std_20');
    expect(r20.vatRate).toBe(20);
    expect(r9.vatOperation).toBe('sale_std_9');
    expect(r9.vatRate).toBe(9);

    // credit note carries NEGATIVE base/vat/gross (сторно, matches signedVatSql)
    expect(rcn.vatBase).toBeLessThan(0);
    expect(rcn.netBase).toBeLessThan(0);
    expect(r20.vatBase).toBeGreaterThan(0);

    // RECONCILE: Σ per-document vat (base, signed) == getVatSummary.vatIssued
    const ledgerVat = Math.round(rows.reduce((s, r) => s + r.vatBase, 0) * 100) / 100;
    const summary = unwrap(await getVatSummary({ months: 12 }), 'vat summary');
    const monthRow = summary.rows.find((m) => m.month === MONTH);
    if (!monthRow) throw new Error(`no VAT summary row for ${MONTH}`);
    expect(ledgerVat).toBe(monthRow.vatIssued);

    // CN fully offsets inv20 → month VAT == inv9's VAT (9% of 1000 = 90.00)
    expect(monthRow.vatIssued).toBe(90);
  });
});
