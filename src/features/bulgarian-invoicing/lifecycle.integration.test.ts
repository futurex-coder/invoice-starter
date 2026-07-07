/**
 * N15 — Integration tests for the outgoing-invoice lifecycle:
 *
 *   createInvoiceDraft → finalizeInvoice → createCreditNoteFromInvoice
 *   (+ cancel transitions, validation failures, cross-company isolation)
 *
 * These run the REAL server actions against the REAL Postgres database
 * (POSTGRES_URL from .env) through the production postgres-js driver —
 * transactions, the row-locked sequence allocator, triggers and FKs are all
 * live. The only thing replaced is the cookie-bound auth guard, which returns
 * a throwaway user + company created in beforeAll and deleted in afterAll.
 *
 * Isolation: every row this suite creates hangs off companies whose legalName
 * starts with TEST_MARKER. beforeAll purges leftovers from any previous
 * crashed run before creating fresh fixtures, so the dev DB self-cleans.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { and, eq, like, inArray } from 'drizzle-orm';
import { db, client } from '@/lib/db/drizzle';
import {
  users,
  companies,
  companyMembers,
  partners,
  articles,
  invoices,
  invoiceLines,
  activityLogs,
  CompanyRole,
  ActivityType,
  type User,
} from '@/lib/db/schema';
import type { CompanyAccessContext } from '@/lib/auth/guards';
import type { ActionResult } from '@/lib/actions/result';
import {
  createInvoiceDraft,
  updateInvoiceDraft,
  finalizeInvoice,
  cancelInvoice,
  createCreditNoteFromInvoice,
  getInvoice,
} from './actions';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 60_000 });

// ---------------------------------------------------------------------------
// Auth-guard mock — the actions resolve company context from cookies, which
// don't exist in vitest. Everything below the guard is the real stack.
// ---------------------------------------------------------------------------

const authState = vi.hoisted((): { ctx: CompanyAccessContext | null } => ({
  ctx: null,
}));

vi.mock('@/lib/auth/guards', () => ({
  requireCompanyAccess: async (): Promise<CompanyAccessContext> => {
    if (!authState.ctx) throw new Error('Test auth context not initialised');
    return authState.ctx;
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RUN = Date.now().toString();
const TEST_MARKER = '[N15-TEST]';
const OWNER_EMAIL = `n15-lifecycle-${RUN}@test.local`;
const COMPANY_EIK = `9${RUN.slice(-8)}`; // valid 9-digit UIC, unique per run
const OTHER_COMPANY_EIK = `8${RUN.slice(-8)}`;
const RECIPIENT_EIK = `7${RUN.slice(-8)}`;
const TODAY = new Date().toISOString().slice(0, 10);

let owner: User;
let companyId: number;
let otherCompanyId: number;

type DraftInput = Parameters<typeof createInvoiceDraft>[0];

/** 2 × 100.00 + 1 × 50.50, all at 20% VAT → net 250.50 / VAT 50.10 / gross 300.60 */
function baseDraftInput(): DraftInput {
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
      { description: 'Консултантска услуга', quantity: 2, unit: 'бр.', unitPrice: 100, vatRate: 20 },
      { description: 'Разработка', quantity: 1, unit: 'ч.', unitPrice: 50.5, vatRate: 20 },
    ],
  };
}

function unwrap<T>(result: ActionResult<T>, label: string): T {
  if (result.data === undefined) {
    throw new Error(
      `${label} failed: ${result.error ?? 'no data'}` +
        (result.validationErrors ? ` ${JSON.stringify(result.validationErrors)}` : '')
    );
  }
  return result.data;
}

function unwrapError<T>(result: ActionResult<T>, label: string): string {
  if (result.error === undefined) {
    throw new Error(`${label} unexpectedly succeeded: ${JSON.stringify(result.data)}`);
  }
  return result.error;
}

/** Delete everything hanging off marker-named companies + test users. */
async function purgeTestData(): Promise<void> {
  const stale = await db
    .select({ id: companies.id })
    .from(companies)
    .where(like(companies.legalName, `${TEST_MARKER}%`));
  const ids = stale.map((r) => r.id);
  if (ids.length > 0) {
    // No ON DELETE CASCADE on these two — clear them first.
    await db.delete(activityLogs).where(inArray(activityLogs.companyId, ids));
    await db.delete(companyMembers).where(inArray(companyMembers.companyId, ids));
    // Cascades: partners, articles, invoices (→ invoice_lines), invoice_sequences.
    await db.delete(companies).where(inArray(companies.id, ids));
  }
  await db.delete(users).where(like(users.email, 'n15-lifecycle-%@test.local'));
}

beforeAll(async () => {
  await purgeTestData();

  const [createdOwner] = await db
    .insert(users)
    .values({
      name: 'N15 Test Owner',
      email: OWNER_EMAIL,
      passwordHash: 'test-only-not-a-real-hash',
    })
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
  const [otherCompany] = await db
    .insert(companies)
    .values({
      legalName: `${TEST_MARKER} Друга ЕООД`,
      eik: OTHER_COMPANY_EIK,
      vatNumber: `BG${OTHER_COMPANY_EIK}`,
      city: 'Варна',
      street: 'ул. Друга 3',
      postCode: '9000',
    })
    .returning();
  if (!company || !otherCompany) throw new Error('Failed to create test companies');
  companyId = company.id;
  otherCompanyId = otherCompany.id;

  await db.insert(companyMembers).values([
    { userId: owner.id, companyId, role: CompanyRole.OWNER },
    { userId: owner.id, companyId: otherCompanyId, role: CompanyRole.OWNER },
  ]);

  authState.ctx = { user: owner, companyId, role: CompanyRole.OWNER };
});

afterAll(async () => {
  try {
    await purgeTestData();
  } finally {
    await client.end({ timeout: 5 });
  }
});

// ---------------------------------------------------------------------------
// The lifecycle — tests run sequentially and share state on purpose:
// this is one flow exercised end-to-end, not isolated unit cases.
// ---------------------------------------------------------------------------

describe('invoice lifecycle: create draft → finalize → credit note', () => {
  let draftId: number;
  let draftNumber: number;
  let partnerId: number;
  let secondDraftId: number;
  let creditNoteId: number;

  it('creates a draft with an allocated number, correct totals, persisted lines, and an auto-created partner', async () => {
    const result = await createInvoiceDraft(baseDraftInput());
    const draft = unwrap(result, 'createInvoiceDraft');
    draftId = draft.id;
    draftNumber = draft.number;

    expect(draft.status).toBe('draft');
    expect(draft.docType).toBe('invoice');
    expect(draft.series).toBe('INV');
    expect(draft.number).toBeGreaterThanOrEqual(1);
    expect(draft.currency).toBe('EUR');
    expect(draft.paymentStatus).toBe('unpaid');
    expect(draft.vatMode).toBe('standard');
    expect(draft.totals).toMatchObject({
      netAmount: 250.5,
      vatAmount: 50.1,
      grossAmount: 300.6,
    });
    expect(draft.supplierSnapshot.uic).toBe(COMPANY_EIK);
    expect(draft.recipientSnapshot.legalName).toBe('Клиент Тест ООД');
    expect(draft.amountInWords).toBeTruthy();

    const lines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, draft.id))
      .orderBy(invoiceLines.sortOrder);
    expect(lines).toHaveLength(2);
    expect(Number(lines[0]?.netAmount)).toBe(200);
    expect(Number(lines[0]?.vatAmount)).toBe(40);
    expect(Number(lines[0]?.grossAmount)).toBe(240);
    expect(Number(lines[1]?.netAmount)).toBe(50.5);
    expect(Number(lines[1]?.grossAmount)).toBe(60.6);

    const [partner] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.companyId, companyId), eq(partners.eik, RECIPIENT_EIK)));
    expect(partner).toBeDefined();
    expect(draft.partnerId).toBe(partner?.id);
    if (partner) partnerId = partner.id;

    const arts = await db
      .select()
      .from(articles)
      .where(eq(articles.companyId, companyId));
    expect(arts.map((a) => a.name).sort()).toEqual(['Консултантска услуга', 'Разработка']);

    const logs = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.companyId, companyId),
          eq(activityLogs.action, ActivityType.CREATE_INVOICE)
        )
      );
    expect(logs).toHaveLength(1);
  });

  it('allocates strictly increasing numbers and reuses the existing partner + articles', async () => {
    const result = await createInvoiceDraft(baseDraftInput());
    const second = unwrap(result, 'createInvoiceDraft (second)');
    secondDraftId = second.id;

    expect(second.number).toBe(draftNumber + 1);
    expect(second.partnerId).toBe(partnerId);

    const partnerRows = await db
      .select()
      .from(partners)
      .where(and(eq(partners.companyId, companyId), eq(partners.eik, RECIPIENT_EIK)));
    expect(partnerRows).toHaveLength(1);

    const arts = await db
      .select()
      .from(articles)
      .where(eq(articles.companyId, companyId));
    expect(arts).toHaveLength(2);
  });

  it('rejects an invalid recipient UIC with field-level validation errors and writes nothing', async () => {
    const bad = baseDraftInput();
    bad.recipient = { ...bad.recipient, eik: 'ABC' };

    const result = await createInvoiceDraft(bad);
    expect(result.data).toBeUndefined();
    expect(result.error).toBe('Validation failed');
    expect(
      result.validationErrors?.some(
        (v) => v.field === 'recipient.uic' && v.code === 'INVALID_UIC'
      )
    ).toBe(true);

    const badPartner = await db
      .select()
      .from(partners)
      .where(and(eq(partners.companyId, companyId), eq(partners.eik, 'ABC')));
    expect(badPartner).toHaveLength(0);
  });

  it('refuses a credit note against a draft', async () => {
    const result = await createCreditNoteFromInvoice(draftId);
    expect(unwrapError(result, 'credit note on draft')).toMatch(/finalized/i);
  });

  it('finalizes the draft: status flips, number is kept, activity is logged', async () => {
    const result = await finalizeInvoice(draftId);
    const finalized = unwrap(result, 'finalizeInvoice');

    expect(finalized.status).toBe('finalized');
    expect(finalized.number).toBe(draftNumber);
    expect(finalized.amountInWords).toBeTruthy();

    const logs = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.companyId, companyId),
          eq(activityLogs.action, ActivityType.FINALIZE_INVOICE)
        )
      );
    expect(logs).toHaveLength(1);
  });

  it('refuses to finalize twice', async () => {
    const result = await finalizeInvoice(draftId);
    expect(unwrapError(result, 'double finalize')).toMatch(/Cannot finalize/);
  });

  it('refuses to update a finalized invoice', async () => {
    const result = await updateInvoiceDraft(draftId, { internalComment: 'nope' });
    expect(unwrapError(result, 'update finalized')).toMatch(
      /Only draft invoices can be updated/
    );
  });

  it('creates a finalized credit note that references the original and mirrors its money', async () => {
    const result = await createCreditNoteFromInvoice(draftId);
    const cn = unwrap(result, 'createCreditNoteFromInvoice');
    creditNoteId = cn.id;

    expect(cn.docType).toBe('credit_note');
    expect(cn.status).toBe('finalized');
    // DB contract (trg_enforce_invoice_numbering): notes inherit the parent's
    // series and number instead of drawing from their own sequence.
    expect(cn.series).toBe('INV');
    expect(cn.number).toBe(draftNumber);
    expect(cn.referencedInvoiceId).toBe(draftId);
    expect(cn.partnerId).toBe(partnerId);
    expect(cn.totals).toMatchObject({
      netAmount: 250.5,
      vatAmount: 50.1,
      grossAmount: 300.6,
    });

    const cnLines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, cn.id))
      .orderBy(invoiceLines.sortOrder);
    expect(cnLines).toHaveLength(2);
    expect(Number(cnLines[0]?.grossAmount)).toBe(240);
    expect(Number(cnLines[1]?.grossAmount)).toBe(60.6);

    const logs = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.companyId, companyId),
          eq(activityLogs.action, ActivityType.CREATE_CREDIT_NOTE)
        )
      );
    expect(logs).toHaveLength(1);
  });

  it('allows multiple credit notes against the same parent, all sharing its number', async () => {
    const result = await createCreditNoteFromInvoice(draftId);
    const second = unwrap(result, 'createCreditNoteFromInvoice (second)');

    expect(second.id).not.toBe(creditNoteId);
    expect(second.series).toBe('INV');
    expect(second.number).toBe(draftNumber);
    expect(second.referencedInvoiceId).toBe(draftId);

    const logs = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.companyId, companyId),
          eq(activityLogs.action, ActivityType.CREATE_CREDIT_NOTE)
        )
      );
    expect(logs).toHaveLength(2);
  });

  it('refuses a credit note against another credit note', async () => {
    const result = await createCreditNoteFromInvoice(creditNoteId);
    expect(unwrapError(result, 'note-on-note')).toMatch(/regular invoices/);
  });

  it('creates a note against an OLD invoice — the note carries its own tax-event date', async () => {
    // Regression: the note used to inherit the original's supplyDate, so any
    // note against an invoice older than 5 days failed ISSUE_DATE_TOO_LATE
    // (ЗДДС чл. 115 — the note's tax event is the correction, not the supply).
    const past = new Date();
    past.setDate(past.getDate() - 60);
    const oldDate = past.toISOString().slice(0, 10);

    const draft = unwrap(
      await createInvoiceDraft({
        ...baseDraftInput(),
        issueDate: oldDate,
        supplyDate: oldDate,
      }),
      'createInvoiceDraft (old)'
    );
    unwrap(await finalizeInvoice(draft.id), 'finalizeInvoice (old)');

    const cn = unwrap(
      await createCreditNoteFromInvoice(draft.id),
      'createCreditNoteFromInvoice (old parent)'
    );
    expect(cn.issueDate).toBe(TODAY);
    expect(cn.supplyDate).toBe(TODAY);
    expect(cn.number).toBe(draft.number);
  });

  it('hides invoices from other companies (scoping on read + mutate)', async () => {
    authState.ctx = { user: owner, companyId: otherCompanyId, role: CompanyRole.OWNER };
    try {
      const read = await getInvoice(draftId);
      expect(unwrapError(read, 'cross-company read')).toBe('Invoice not found');

      const mutate = await cancelInvoice(draftId);
      expect(unwrapError(mutate, 'cross-company cancel')).toBe('Invoice not found');
    } finally {
      authState.ctx = { user: owner, companyId, role: CompanyRole.OWNER };
    }
  });

  it('cancels a finalized invoice; cancelled is terminal', async () => {
    const cancelled = unwrap(await cancelInvoice(draftId, 'интеграционен тест'), 'cancelInvoice');
    expect(cancelled.status).toBe('cancelled');

    expect(unwrapError(await cancelInvoice(draftId), 'double cancel')).toMatch(/Cannot cancel/);
    expect(unwrapError(await finalizeInvoice(draftId), 'finalize cancelled')).toMatch(
      /Cannot finalize/
    );
  });

  it('cancels a draft directly (draft → cancelled is a valid transition)', async () => {
    const cancelled = unwrap(await cancelInvoice(secondDraftId), 'cancel draft');
    expect(cancelled.status).toBe('cancelled');

    const [row] = await db
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, secondDraftId));
    expect(row?.status).toBe('cancelled');
  });

  it('creates + finalizes in one transaction, no intermediate draft (NI-1)', async () => {
    const res = unwrap(
      await createInvoiceDraft({ ...baseDraftInput(), finalizeImmediately: true }),
      'createInvoiceDraft(finalizeImmediately)'
    );

    expect(res.status).toBe('finalized');
    expect(res.docType).toBe('invoice');
    expect(res.totals.grossAmount).toBe(300.6);
    expect(res.amountInWords).toBeTruthy();

    // Already finalized — a second finalize must refuse.
    expect(unwrapError(await finalizeInvoice(res.id), 'refinalize')).toMatch(
      /Cannot finalize/
    );

    // Both lifecycle activities land in the same transaction.
    const acts = await db
      .select({ action: activityLogs.action })
      .from(activityLogs)
      .where(eq(activityLogs.companyId, companyId));
    const counts = acts.reduce<Record<string, number>>((m, a) => {
      m[a.action] = (m[a.action] ?? 0) + 1;
      return m;
    }, {});
    expect(counts[ActivityType.FINALIZE_INVOICE]).toBeGreaterThanOrEqual(2);
  });

  it('refuses finalizeImmediately for note doc types (they need an original)', async () => {
    const res = await createInvoiceDraft({
      ...baseDraftInput(),
      docType: 'credit_note',
      finalizeImmediately: true,
    });
    expect(unwrapError(res, 'immediate note')).toMatch(/original invoice/);
  });
});
