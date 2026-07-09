'use server';

import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  invoices,
  invoiceLines,
  companies,
  partners,
  articles,
  receivedInvoices,
  ActivityType,
  InvoiceStatus,
  type Invoice,
  type NewInvoice,
} from '@/lib/db/schema';
import { getNextInvoiceNumber } from '@/lib/db/queries';
import { issuedVatSumSql } from '@/lib/db/queries/money';
import { action, failWith, type ActionResult } from '@/lib/actions/result';
import { requireCompanyAccess } from '@/lib/auth/guards';
import { logActivity, logActivityInTx } from '@/lib/db/activity';
import { calculateInvoice } from './calculator';
import { validateInvoice } from './validator';
import { formatInvoiceNumber, amountInWordsBg } from './formatter';
import { DEFAULT_SERIES, canTransition, requiresReference } from './rules';
import { DOC_TYPES, STATUSES } from './types';
import type {
  DocType,
  InvoiceStatus as DomainInvoiceStatus,
  LineItemInput,
  PartySnapshot,
  InvoiceDocument,
  LineItem,
  ValidationError as DomainValidationIssue,
} from './types';
import {
  parseInvoiceRow,
  parseInvoiceLineRow,
  parsePartySnapshotStrict,
  parseInvoiceTotalsStrict,
  parseStoredLineItems,
} from './parsers';
import type { ParsedInvoice, ParsedInvoiceLine } from './parsed-types';
import { queryInvoicesList } from './queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

function isDocType(v: string): v is DocType {
  return (DOC_TYPES as readonly string[]).includes(v);
}

function isDomainStatus(v: string): v is DomainInvoiceStatus {
  return (STATUSES as readonly string[]).includes(v);
}

export interface RecipientInput {
  partnerId?: number | null;
  name: string;
  eik: string;
  vatNumber?: string | null;
  isIndividual?: boolean;
  country?: string;
  city: string;
  street: string;
  postCode?: string | null;
  mol?: string | null;
}

export interface LineItemWithArticle extends LineItemInput {
  articleId?: number | null;
}

interface CreateInvoiceDraftInput {
  docType: DocType;
  series?: string;
  /**
   * Optional manual document number (regular invoices only). When omitted the
   * next number in the company sequence is auto-allocated. When set it must be
   * greater than the company's current highest number — the DB trigger enforces
   * this (strictly increasing, no duplicates), so manual entry can only jump the
   * sequence forward, e.g. to continue an external series.
   */
  number?: number;
  issueDate: string;
  supplyDate?: string | null;
  currency?: string;
  fxRate?: number;
  /** If omitted, fetched from company profile */
  supplier?: PartySnapshot;
  recipient: RecipientInput;
  lineItems: LineItemWithArticle[];
  referencedInvoiceId?: number | null;
  language?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  dueDate?: string | null;
  vatMode?: string;
  noVatReason?: string | null;
  amountInWords?: string | null;
  customerNote?: string | null;
  internalComment?: string | null;
  /**
   * NI-1: create the document already finalized — one transaction, no
   * intermediate draft. Validation runs against the `finalized` rules.
   */
  finalizeImmediately?: boolean;
}

interface UpdateInvoiceDraftInput {
  issueDate?: string;
  supplyDate?: string | null;
  currency?: string;
  fxRate?: number;
  supplier?: PartySnapshot;
  recipient?: RecipientInput;
  lineItems?: LineItemWithArticle[];
  referencedInvoiceId?: number | null;
  language?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  dueDate?: string | null;
  vatMode?: string;
  noVatReason?: string | null;
  amountInWords?: string | null;
  customerNote?: string | null;
  internalComment?: string | null;
}

interface NoteOverrides {
  issueDate?: string;
  supplyDate?: string | null;
  currency?: string;
  fxRate?: number;
  supplier?: PartySnapshot;
  recipient?: RecipientInput;
  lineItems?: LineItemWithArticle[];
}

export interface ListInvoicesFilters {
  status?: InvoiceStatus;
  docType?: DocType;
  paymentStatus?: string;
  /** OI-4: 'pending' | 'accounted'. */
  accountingStatus?: string;
  search?: string;
  /** OI-5: ISO month ("2026-07") — accountants work by month. */
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface ListInvoicesResult {
  invoices: ParsedInvoice[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Domain validation bridge
//
// `validateInvoice()` is a domain-specific validator (not Zod) — it returns
// field-level errors that must surface in `validationErrors`. The canonical
// `action()` wrapper only converts ZodError automatically, so we use a small
// sentinel: throw `DomainValidationError(issues)` inside the action body, then
// `runWithDomainValidation()` converts a top-level error message matching the
// sentinel back into the canonical `failWith(issues)` shape.
// ---------------------------------------------------------------------------

class DomainValidationError extends Error {
  readonly issues: DomainValidationIssue[];
  constructor(issues: DomainValidationIssue[]) {
    super('Validation failed');
    this.name = 'DomainValidationError';
    this.issues = issues;
  }
}

async function runWithDomainValidation<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { data };
  } catch (e) {
    if (e instanceof DomainValidationError) {
      return failWith(e.issues);
    }
    // Delegate to `action()`'s error handling by re-running through it.
    return action(async () => {
      throw e;
    });
  }
}

// ---------------------------------------------------------------------------
// Sequence allocator (atomic, row-locked)
// ---------------------------------------------------------------------------

// NUM-1: unified per-company numbering. Every document (invoice, proforma,
// credit/debit note) draws from ONE per-company counter, tracked under the '*'
// sentinel series (decoupled from the document's display series). The DB
// trigger enforces the same rule and keeps this row in sync.
const UNIFIED_SEQUENCE_KEY = '*';

async function allocateNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  companyId: number
): Promise<number> {
  const [row] = await tx.execute<{ allocated: number }>(sql`
    INSERT INTO invoice_sequences (company_id, series, next_number, updated_at)
    VALUES (${companyId}, ${UNIFIED_SEQUENCE_KEY}, 2, NOW())
    ON CONFLICT (company_id, series)
    DO UPDATE SET
      next_number = invoice_sequences.next_number + 1,
      updated_at = NOW()
    RETURNING next_number - 1 AS allocated
  `);
  return Number(row?.['allocated']);
}

// ---------------------------------------------------------------------------
// GEN-1 — freeze the doc→base FX rate at issue time
// ---------------------------------------------------------------------------

/**
 * The frozen `fxRate` to stamp on a document being finalized: the multiplier
 * such that `amount_base = amount_doc × fxRate`, where base = the company's
 * currency. Returns '1' when the doc is already in the base currency. BGN↔EUR
 * uses the fixed euro-adoption rate; real foreign currencies use ECB (cached,
 * with a safe fallback) — see `lib/fx`.
 */
async function frozenFxRate(
  companyId: number,
  docCurrency: string
): Promise<string> {
  const [c] = await db
    .select({ base: companies.defaultCurrency })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const base = c?.base ?? 'EUR';
  if (docCurrency === base) return '1';
  // Lazy import: `lib/fx/rates` is server-only (ECB fetch); loading it only on
  // the non-base path keeps it out of the module graph for unit tests that
  // import these actions (which only ever exercise same-currency finalizes).
  const { getRateToBase } = await import('@/lib/fx/rates');
  const rate = await getRateToBase(docCurrency, base);
  return String(rate);
}

// ---------------------------------------------------------------------------
// Supplier from company profile
// ---------------------------------------------------------------------------

async function getSupplierProfile(companyId: number) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return company ?? null;
}

function profileToSnapshot(profile: {
  legalName: string;
  street: string;
  postCode: string | null;
  city: string;
  country: string;
  eik: string;
  vatNumber: string | null;
}): PartySnapshot {
  const address = [
    profile.street,
    [profile.postCode, profile.city].filter(Boolean).join(' '),
    profile.country,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    legalName: profile.legalName,
    address,
    uic: profile.eik,
    vatNumber: profile.vatNumber ?? null,
  };
}

// ---------------------------------------------------------------------------
// Recipient → PartySnapshot + auto-create partner
// ---------------------------------------------------------------------------

function recipientInputToSnapshot(r: RecipientInput): PartySnapshot {
  const address = [
    r.street,
    [r.postCode, r.city].filter(Boolean).join(' '),
    r.country || 'BG',
  ]
    .filter(Boolean)
    .join(', ');
  return {
    legalName: r.name,
    address,
    uic: r.eik,
    vatNumber: r.vatNumber ?? null,
  };
}

async function resolvePartner(
  companyId: number,
  input: RecipientInput
): Promise<number | null> {
  if (input.partnerId) return input.partnerId;
  if (!input.eik?.trim()) return null;

  const [existing] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.companyId, companyId), eq(partners.eik, input.eik.trim())))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(partners)
    .values({
      companyId,
      name: input.name,
      eik: input.eik.trim(),
      vatNumber: input.vatNumber ?? null,
      isIndividual: input.isIndividual ?? false,
      country: input.country ?? 'BG',
      city: input.city || '-',
      street: input.street || '-',
      postCode: input.postCode ?? null,
      mol: input.mol ?? null,
    })
    .returning();

  return created?.id ?? null;
}

// ---------------------------------------------------------------------------
// Article auto-create from line item
// ---------------------------------------------------------------------------

async function resolveArticle(
  companyId: number,
  line: LineItemWithArticle,
  currency: string
): Promise<number | null> {
  if (line.articleId) return line.articleId;
  if (!line.description?.trim()) return null;

  const trimmed = line.description.trim();
  const [existing] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.companyId, companyId), eq(articles.name, trimmed)))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(articles)
    .values({
      companyId,
      name: trimmed,
      unit: line.unit || 'бр.',
      defaultUnitPrice: String(line.unitPrice ?? 0),
      currency,
      type: 'service',
    })
    .returning();

  return created?.id ?? null;
}

// ---------------------------------------------------------------------------
// Save invoice_lines rows
// ---------------------------------------------------------------------------

async function saveInvoiceLines(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  invoiceId: number,
  calcItems: LineItem[],
  articleIds: (number | null)[]
): Promise<void> {
  await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));

  if (calcItems.length === 0) return;

  await tx.insert(invoiceLines).values(
    calcItems.map((item, i) => ({
      invoiceId,
      articleId: articleIds[i] ?? null,
      sortOrder: item.sortOrder,
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      vatRate: item.vatRate,
      discountPercent: String(item.discountPercent ?? 0),
      discountAmount: String(item.discountAmount),
      netAmount: String(item.netAmount),
      vatAmount: String(item.vatAmount),
      grossAmount: String(item.grossAmount),
    }))
  );
}

// ---------------------------------------------------------------------------
// DB row <-> domain document mapping
// ---------------------------------------------------------------------------

function rowToDocument(row: Invoice): InvoiceDocument {
  const items = parseStoredLineItems(row.items);
  const totals = parseInvoiceTotalsStrict(row.totals);

  return {
    docType: isDocType(row.docType) ? row.docType : 'invoice',
    status: isDomainStatus(row.status) ? row.status : 'draft',
    series: row.series,
    number: row.number,
    issueDate: row.issueDate,
    supplyDate: row.supplyDate,
    currency: row.currency,
    fxRate: Number(row.fxRate),
    supplier: parsePartySnapshotStrict(row.supplierSnapshot),
    recipient: parsePartySnapshotStrict(row.recipientSnapshot),
    items,
    totals,
    referencedInvoiceNumber: row.number
      ? formatInvoiceNumber(row.number)
      : null,
  };
}

// ---------------------------------------------------------------------------
// createInvoiceDraft
// ---------------------------------------------------------------------------

export async function createInvoiceDraft(
  input: CreateInvoiceDraftInput
): Promise<ActionResult<ParsedInvoice>> {
  return runWithDomainValidation(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const profile = await getSupplierProfile(companyId);
    let supplier = input.supplier;
    if (!supplier) {
      if (!profile) {
        throw new Error('Company profile (Supplier) is required. Please complete it in Settings.');
      }
      supplier = profileToSnapshot(profile);
    }

    const recipientSnapshot = recipientInputToSnapshot(input.recipient);

    const series = input.series ?? DEFAULT_SERIES[input.docType];

    // Manual document number (regular invoices only). Basic shape is checked
    // here; the "> current max" rule is enforced in the transaction + the DB
    // trigger so it stays race-safe.
    let manualNumber: number | null = null;
    if (input.number !== undefined && input.number !== null) {
      if (input.docType !== 'invoice') {
        throw new Error(
          'Ръчен номер може да се задава само на фактури, не на известия или проформи.'
        );
      }
      if (!Number.isInteger(input.number) || input.number <= 0) {
        throw new Error(
          'Номерът на фактурата трябва да е цяло положително число.'
        );
      }
      manualNumber = input.number;
    }

    const calc = calculateInvoice(input.lineItems);
    const currency = input.currency ?? 'EUR';
    const words =
      input.amountInWords?.trim() ||
      amountInWordsBg(calc.totals.grossAmount, currency);

    // NI-1: when finalizing immediately, validate against the stricter
    // `finalized` rules up front and never persist an intermediate draft.
    const targetStatus = input.finalizeImmediately ? 'finalized' : 'draft';
    if (input.finalizeImmediately && requiresReference(input.docType)) {
      throw new Error(
        `${input.docType} must be created from its original invoice`
      );
    }

    const doc: InvoiceDocument = {
      docType: input.docType,
      status: targetStatus,
      series,
      number: 1,
      issueDate: input.issueDate,
      supplyDate: input.supplyDate ?? null,
      currency,
      fxRate: input.fxRate ?? 1,
      supplier,
      recipient: recipientSnapshot,
      items: calc.items,
      totals: calc.totals,
      referencedInvoiceNumber: input.referencedInvoiceId
        ? String(input.referencedInvoiceId)
        : null,
    };

    const vr = validateInvoice(doc);
    if (!vr.valid) {
      throw new DomainValidationError(vr.errors);
    }

    if (input.referencedInvoiceId) {
      const [ref] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.referencedInvoiceId),
            eq(invoices.companyId, companyId)
          )
        )
        .limit(1);
      if (!ref) {
        throw new Error('Referenced invoice not found in this company');
      }
    }

    // Resolve partner (find or auto-create)
    const partnerId = await resolvePartner(companyId, input.recipient);

    // Resolve articles per line item (find or auto-create)
    const articleIds = await Promise.all(
      input.lineItems.map((l) => resolveArticle(companyId, l, currency))
    );

    // GEN-1: freeze the doc→base rate only when issuing now; a plain draft
    // gets '1' and is stamped at its own finalize.
    const fxRate = input.finalizeImmediately
      ? await frozenFxRate(companyId, currency)
      : '1';

    const created = await db.transaction(async (tx) => {
      let allocatedNumber: number;
      if (manualNumber !== null) {
        // Must be above the company's current highest number (the DB trigger is
        // the final guard; this gives a clean message before hitting it).
        const maxRows = await tx.execute<{ max: number }>(sql`
          SELECT COALESCE(MAX(number), 0) AS max
          FROM invoices WHERE company_id = ${companyId}
        `);
        const currentMax = Number(maxRows[0]?.['max'] ?? 0);
        if (manualNumber <= currentMax) {
          throw new Error(
            `Номер ${manualNumber} е зает или по-малък от последния (${currentMax}). Изберете по-голям номер.`
          );
        }
        allocatedNumber = manualNumber;
      } else {
        allocatedNumber = await allocateNumber(tx, companyId);
      }

      const [row] = await tx
        .insert(invoices)
        .values({
          companyId,
          createdByUserId: user.id,
          partnerId,
          docType: input.docType,
          status: targetStatus,
          series,
          number: allocatedNumber,
          issueDate: input.issueDate,
          supplyDate: input.supplyDate ?? null,
          currency,
          fxRate,
          supplierSnapshot: supplier,
          recipientSnapshot: recipientSnapshot,
          items: calc.items,
          totals: calc.totals,
          referencedInvoiceId: input.referencedInvoiceId ?? null,
          language: input.language ?? 'bg',
          paymentMethod: input.paymentMethod ?? 'bank',
          paymentStatus: input.paymentStatus ?? 'unpaid',
          dueDate: input.dueDate ?? null,
          vatMode: input.vatMode ?? 'standard',
          noVatReason: input.noVatReason ?? null,
          amountInWords: words,
          customerNote: input.customerNote ?? null,
          internalComment: input.internalComment ?? null,
        } satisfies NewInvoice)
        .returning();

      if (!row) throw new Error('Failed to create invoice');

      await saveInvoiceLines(tx, row.id, calc.items, articleIds);

      await logActivityInTx(tx, companyId, user.id, ActivityType.CREATE_INVOICE);
      if (input.finalizeImmediately) {
        await logActivityInTx(
          tx,
          companyId,
          user.id,
          ActivityType.FINALIZE_INVOICE
        );
      }

      return row;
    });

    return parseInvoiceRow(created);
  });
}

// ---------------------------------------------------------------------------
// updateInvoiceDraft
// ---------------------------------------------------------------------------

export async function updateInvoiceDraft(
  invoiceId: number,
  input: UpdateInvoiceDraftInput
): Promise<ActionResult<ParsedInvoice>> {
  return runWithDomainValidation(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!existing) {
      throw new Error('Invoice not found');
    }
    // EDIT-RULE (D-EDIT): an invoice is freely editable until it is marked
    // `accounted`; then it locks. Cancelled invoices must be uncancelled first
    // (there's nothing meaningful to edit while void). Draft + finalized (not
    // accounted) are both editable; the number and status are preserved.
    if (existing.accountingStatus === 'accounted') {
      throw new Error(
        'This invoice is marked accounted and is locked. Set it back to pending accounting to edit it.'
      );
    }
    if (existing.status === 'cancelled') {
      throw new Error('Uncancel this invoice before editing it.');
    }

    const supplier = input.supplier ?? parsePartySnapshotStrict(existing.supplierSnapshot);
    const recipientSnapshot = input.recipient
      ? recipientInputToSnapshot(input.recipient)
      : parsePartySnapshotStrict(existing.recipientSnapshot);
    const lineItemInputs = input.lineItems;
    const calc = lineItemInputs
      ? calculateInvoice(lineItemInputs)
      : {
          items: parseStoredLineItems(existing.items),
          totals: parseInvoiceTotalsStrict(existing.totals),
        };

    const issueDate = input.issueDate ?? existing.issueDate;
    const supplyDate = input.supplyDate !== undefined ? input.supplyDate : existing.supplyDate;
    const currency = input.currency ?? existing.currency;
    const fxRate = input.fxRate ?? Number(existing.fxRate);

    const doc: InvoiceDocument = {
      docType: isDocType(existing.docType) ? existing.docType : 'invoice',
      // Validate against the invoice's ACTUAL status (a finalized edit must
      // still satisfy the finalized rules), preserving its allocated number.
      status: isDomainStatus(existing.status) ? existing.status : 'draft',
      series: existing.series,
      number: existing.number,
      issueDate,
      supplyDate: supplyDate ?? null,
      currency,
      fxRate,
      supplier,
      recipient: recipientSnapshot,
      items: calc.items,
      totals: calc.totals,
      referencedInvoiceNumber: existing.referencedInvoiceId
        ? String(existing.referencedInvoiceId)
        : null,
    };

    const vr = validateInvoice(doc);
    if (!vr.valid) {
      throw new DomainValidationError(vr.errors);
    }

    if (input.referencedInvoiceId !== undefined && input.referencedInvoiceId !== null) {
      const [ref] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.referencedInvoiceId),
            eq(invoices.companyId, companyId)
          )
        )
        .limit(1);
      if (!ref) {
        throw new Error('Referenced invoice not found in this company');
      }
    }

    // Resolve partner if recipient was provided
    let partnerId: number | null | undefined;
    if (input.recipient) {
      partnerId = await resolvePartner(companyId, input.recipient);
    }

    // Resolve articles per line item if items were provided
    let articleIds: (number | null)[] | undefined;
    if (lineItemInputs) {
      articleIds = await Promise.all(
        lineItemInputs.map((l) => resolveArticle(companyId, l, currency))
      );
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({
          issueDate,
          supplyDate: supplyDate ?? null,
          currency,
          fxRate: String(fxRate),
          supplierSnapshot: supplier,
          recipientSnapshot: recipientSnapshot,
          items: calc.items,
          totals: calc.totals,
          ...(partnerId !== undefined && { partnerId }),
          referencedInvoiceId: input.referencedInvoiceId !== undefined
            ? input.referencedInvoiceId
            : existing.referencedInvoiceId,
          ...(input.language !== undefined && { language: input.language }),
          ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod }),
          ...(input.paymentStatus !== undefined && { paymentStatus: input.paymentStatus }),
          ...(input.dueDate !== undefined && { dueDate: input.dueDate ?? null }),
          ...(input.vatMode !== undefined && { vatMode: input.vatMode }),
          ...(input.noVatReason !== undefined && { noVatReason: input.noVatReason ?? null }),
          ...(input.amountInWords !== undefined && { amountInWords: input.amountInWords ?? null }),
          ...(input.customerNote !== undefined && { customerNote: input.customerNote ?? null }),
          ...(input.internalComment !== undefined && { internalComment: input.internalComment ?? null }),
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
        .returning();

      if (lineItemInputs && articleIds) {
        await saveInvoiceLines(tx, invoiceId, calc.items, articleIds);
      }

      return row;
    });

    await logActivity(companyId, user.id, ActivityType.UPDATE_INVOICE);

    return parseInvoiceRow(updated);
  });
}

// ---------------------------------------------------------------------------
// finalizeInvoice
// ---------------------------------------------------------------------------

export async function finalizeInvoice(
  invoiceId: number
): Promise<ActionResult<ParsedInvoice>> {
  return runWithDomainValidation(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!existing) {
      throw new Error('Invoice not found');
    }
    if (!isDomainStatus(existing.status) || !canTransition(existing.status, 'finalized')) {
      throw new Error(`Cannot finalize invoice with status "${existing.status}"`);
    }

    // Credit/debit notes must reference an original
    if (isDocType(existing.docType) && requiresReference(existing.docType) && !existing.referencedInvoiceId) {
      throw new Error(`${existing.docType} must reference an original invoice`);
    }

    const preDoc: InvoiceDocument = {
      ...rowToDocument(existing),
      status: 'finalized',
    };
    const vr = validateInvoice(preDoc);
    if (!vr.valid) {
      throw new DomainValidationError(vr.errors);
    }

    const totals = parseInvoiceTotalsStrict(existing.totals);
    const currency = existing.currency ?? 'EUR';
    const amountInWords =
      existing.amountInWords?.trim() ||
      amountInWordsBg(totals.grossAmount, currency);

    // GEN-1: freeze the doc→base FX rate at issue time so historical totals
    // never drift when tomorrow's rate moves.
    const fxRate = await frozenFxRate(companyId, currency);

    const [finalized] = await db
      .update(invoices)
      .set({
        status: InvoiceStatus.FINALIZED,
        amountInWords: amountInWords || undefined,
        fxRate,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.companyId, companyId),
          eq(invoices.status, 'draft')
        )
      )
      .returning();

    if (!finalized) {
      throw new Error('Failed to finalize — invoice may have been modified concurrently');
    }

    await logActivity(companyId, user.id, ActivityType.FINALIZE_INVOICE);

    return parseInvoiceRow(finalized);
  });
}

// ---------------------------------------------------------------------------
// cancelInvoice
// ---------------------------------------------------------------------------

export async function cancelInvoice(
  invoiceId: number,
  reason?: string
): Promise<ActionResult<ParsedInvoice>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!existing) {
      throw new Error('Invoice not found');
    }
    if (!isDomainStatus(existing.status) || !canTransition(existing.status, 'cancelled')) {
      throw new Error(`Cannot cancel invoice with status "${existing.status}"`);
    }

    const [cancelled] = await db
      .update(invoices)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .returning();

    const actionDesc = reason
      ? `${ActivityType.CANCEL_INVOICE}: ${reason}`
      : ActivityType.CANCEL_INVOICE;
    // TODO: re-surface `actionDesc` once `activity_logs` has a `description`
    // column. Today the activity feed only reads `action` and would render
    // "Unknown action" for the concatenated string, so we log just the enum
    // and drop the reason in the feed. The full `actionDesc` is preserved
    // here as a hint for the future migration.
    void actionDesc;
    await logActivity(companyId, user.id, ActivityType.CANCEL_INVOICE);

    return parseInvoiceRow(cancelled);
  });
}

// ---------------------------------------------------------------------------
// uncancelInvoice — EDIT-RULE (D-CANCEL): cancel is reversible.
// ---------------------------------------------------------------------------

export async function uncancelInvoice(
  invoiceId: number
): Promise<ActionResult<ParsedInvoice>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!existing) {
      throw new Error('Invoice not found');
    }
    if (existing.status !== 'cancelled') {
      throw new Error('Only cancelled invoices can be reinstated');
    }

    // Cancel is only offered on issued (finalized) invoices, so the pre-cancel
    // state is always 'finalized'. Guard the status in the WHERE for concurrency.
    const [restored] = await db
      .update(invoices)
      .set({ status: 'finalized', updatedAt: new Date() })
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.companyId, companyId),
          eq(invoices.status, 'cancelled')
        )
      )
      .returning();

    if (!restored) {
      throw new Error(
        'Failed to reinstate — invoice may have been modified concurrently'
      );
    }

    await logActivity(companyId, user.id, ActivityType.UNCANCEL_INVOICE);

    return parseInvoiceRow(restored);
  });
}

// ---------------------------------------------------------------------------
// deleteInvoice — permanently remove a document that isn't accounted yet.
// Mirrors the EDIT-RULE lock: once `accounted`, a document is immutable AND
// undeletable until set back to pending. Blocks deletion when credit/debit notes
// still reference the invoice (the self-FK is ON DELETE SET NULL, so deleting the
// parent would orphan them). Afterwards the unified sequence tracker is healed to
// MAX(number)+1, so deleting the LATEST document reclaims its number (no gap);
// deleting an older one leaves the inherent gap.
// ---------------------------------------------------------------------------

export async function deleteInvoice(
  invoiceId: number
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!existing) {
      throw new Error('Фактурата не е намерена');
    }
    if (existing.accountingStatus === 'accounted') {
      throw new Error(
        'Осчетоводена фактура не може да се изтрие. Първо я върнете в „изчаква осчетоводяване“.'
      );
    }

    // A parent invoice with notes cannot be deleted — the notes' parent link
    // (referenced_invoice_id) is ON DELETE SET NULL and would be orphaned.
    const [note] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, companyId),
          eq(invoices.referencedInvoiceId, invoiceId)
        )
      )
      .limit(1);
    if (note) {
      throw new Error(
        'Фактурата има кредитни/дебитни известия и не може да се изтрие. Първо изтрийте известията.'
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(invoices)
        .where(
          and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId))
        );

      // Heal the unified sequence: next = MAX(number)+1 over what remains, so
      // deleting the latest document reclaims its number instead of gapping.
      await tx.execute(sql`
        INSERT INTO invoice_sequences (company_id, series, next_number, updated_at)
        VALUES (
          ${companyId}, '*',
          (SELECT COALESCE(MAX(number), 0) + 1 FROM invoices WHERE company_id = ${companyId}),
          NOW()
        )
        ON CONFLICT (company_id, series)
        DO UPDATE SET
          next_number = (SELECT COALESCE(MAX(number), 0) + 1 FROM invoices WHERE company_id = ${companyId}),
          updated_at = NOW()
      `);
    });

    await logActivity(companyId, user.id, ActivityType.DELETE_INVOICE);

    return { id: invoiceId };
  });
}

// ---------------------------------------------------------------------------
// updateInvoicePaymentInfo — update paymentStatus / dueDate on any non-cancelled invoice
// ---------------------------------------------------------------------------

const VALID_PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;

export async function updateInvoicePaymentInfo(
  invoiceId: number,
  input: { paymentStatus?: string; dueDate?: string | null }
): Promise<ActionResult<ParsedInvoice>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!existing) {
      throw new Error('Invoice not found');
    }
    if (existing.status === 'cancelled') {
      throw new Error('Cannot update a cancelled invoice');
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.paymentStatus !== undefined) {
      if (!(VALID_PAYMENT_STATUSES as readonly string[]).includes(input.paymentStatus)) {
        throw new Error(`Invalid payment status: ${input.paymentStatus}`);
      }
      patch.paymentStatus = input.paymentStatus;
    }
    if (input.dueDate !== undefined) {
      patch.dueDate = input.dueDate ?? null;
    }

    const [updated] = await db
      .update(invoices)
      .set(patch)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .returning();

    await logActivity(companyId, user.id, ActivityType.UPDATE_INVOICE);

    return parseInvoiceRow(updated);
  });
}

// ---------------------------------------------------------------------------
// updateInvoiceAccountingStatus — OI-9 inline "accounted" toggle
// ---------------------------------------------------------------------------

const VALID_ACCOUNTING_STATUSES = ['pending', 'accounted'] as const;

export async function updateInvoiceAccountingStatus(
  invoiceId: number,
  accountingStatus: string
): Promise<ActionResult<ParsedInvoice>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    if (
      !(VALID_ACCOUNTING_STATUSES as readonly string[]).includes(
        accountingStatus
      )
    ) {
      throw new Error(`Invalid accounting status: ${accountingStatus}`);
    }

    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!existing) {
      throw new Error('Invoice not found');
    }
    // Booking happens on issued documents — drafts have nothing to book yet
    // and cancelled documents are out of the ledger.
    if (existing.status !== InvoiceStatus.FINALIZED) {
      throw new Error('Only finalized documents can change accounting status');
    }

    const [updated] = await db
      .update(invoices)
      .set({ accountingStatus, updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .returning();

    await logActivity(companyId, user.id, ActivityType.UPDATE_INVOICE);

    return parseInvoiceRow(updated);
  });
}

// ---------------------------------------------------------------------------
// createCreditNoteFromInvoice
// ---------------------------------------------------------------------------

export async function createCreditNoteFromInvoice(
  originalInvoiceId: number,
  overrides?: NoteOverrides
): Promise<ActionResult<ParsedInvoice>> {
  return createNoteFromInvoice('credit_note', originalInvoiceId, overrides);
}

// ---------------------------------------------------------------------------
// createDebitNoteFromInvoice
// ---------------------------------------------------------------------------

export async function createDebitNoteFromInvoice(
  originalInvoiceId: number,
  overrides?: NoteOverrides
): Promise<ActionResult<ParsedInvoice>> {
  return createNoteFromInvoice('debit_note', originalInvoiceId, overrides);
}

// ---------------------------------------------------------------------------
// Shared note creation (credit / debit) — creates AND finalizes atomically
// ---------------------------------------------------------------------------

async function createNoteFromInvoice(
  noteType: 'credit_note' | 'debit_note',
  originalInvoiceId: number,
  overrides?: NoteOverrides
): Promise<ActionResult<ParsedInvoice>> {
  return runWithDomainValidation(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [original] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, originalInvoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!original) {
      throw new Error('Original invoice not found');
    }
    if (original.docType !== 'invoice') {
      throw new Error('Notes can only be created against regular invoices');
    }
    if (original.status !== InvoiceStatus.FINALIZED) {
      throw new Error('Can only create notes against finalized invoices');
    }

    const today = new Date().toISOString().slice(0, 10);
    // NUM-1: a note is its own document with its own unique number — it no
    // longer inherits the parent's number. It keeps its own display series
    // (CN/DN) and the parent LINK via referenced_invoice_id; the number is
    // allocated from the unified per-company sequence inside the transaction.
    const series = DEFAULT_SERIES[noteType];

    const supplier = overrides?.supplier
      ?? parsePartySnapshotStrict(original.supplierSnapshot);

    // Build recipient snapshot: from overrides or copy from original
    const recipientSnapshot = overrides?.recipient
      ? recipientInputToSnapshot(overrides.recipient)
      : parsePartySnapshotStrict(original.recipientSnapshot);

    const issueDate = overrides?.issueDate ?? today;
    // The note's tax event is the CORRECTION (ЗДДС чл. 115: a note is issued
    // within 5 days of the circumstance requiring it), not the original
    // supply — inheriting the original's supplyDate made every note against
    // an invoice older than 5 days fail ISSUE_DATE_TOO_LATE validation.
    const supplyDate = overrides?.supplyDate !== undefined
      ? overrides.supplyDate
      : issueDate;
    const currency = overrides?.currency ?? original.currency;
    // GEN-1: a note is finalized on creation → freeze its doc→base rate now.
    const fxRate = Number(await frozenFxRate(companyId, currency));

    // Load original invoice_lines to get article IDs
    const originalLines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, originalInvoiceId))
      .orderBy(invoiceLines.sortOrder);

    const lineItemInputs: LineItemWithArticle[] = overrides?.lineItems
      ?? parseStoredLineItems(original.items).map((item, i): LineItemWithArticle => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
          discountPercent: item.discountPercent ?? 0,
          articleId: originalLines[i]?.articleId ?? null,
        }));

    const calc = calculateInvoice(lineItemInputs);

    const refNumber = original.number
      ? formatInvoiceNumber(original.number)
      : String(original.id);

    const doc: InvoiceDocument = {
      docType: noteType,
      status: 'finalized',
      series,
      // Placeholder for validation; the real unified number is allocated in the
      // transaction below (same pattern as createInvoiceDraft).
      number: 1,
      issueDate,
      supplyDate: supplyDate ?? null,
      currency,
      fxRate,
      supplier,
      recipient: recipientSnapshot,
      items: calc.items,
      totals: calc.totals,
      referencedInvoiceNumber: refNumber,
    };

    const vr = validateInvoice(doc);
    if (!vr.valid) {
      throw new DomainValidationError(vr.errors);
    }

    const activityType = noteType === 'credit_note'
      ? ActivityType.CREATE_CREDIT_NOTE
      : ActivityType.CREATE_DEBIT_NOTE;

    // Resolve partner from original or override
    const partnerId = overrides?.recipient
      ? await resolvePartner(companyId, overrides.recipient)
      : original.partnerId;

    // Resolve article IDs for each line
    const articleIds = lineItemInputs.map((l) => l.articleId ?? null);

    const result = await db.transaction(async (tx) => {
      const allocatedNumber = await allocateNumber(tx, companyId);

      const [created] = await tx
        .insert(invoices)
        .values({
          companyId,
          createdByUserId: user.id,
          referencedInvoiceId: original.id,
          partnerId: partnerId ?? null,
          docType: noteType,
          status: InvoiceStatus.FINALIZED,
          series,
          number: allocatedNumber,
          issueDate,
          supplyDate: supplyDate ?? null,
          currency,
          fxRate: String(fxRate),
          supplierSnapshot: supplier,
          recipientSnapshot: recipientSnapshot,
          items: calc.items,
          totals: calc.totals,
        })
        .returning();

      if (!created) {
        throw new Error(`Failed to create ${noteType}`);
      }

      await saveInvoiceLines(tx, created.id, calc.items, articleIds);

      await logActivityInTx(tx, companyId, user.id, activityType);

      return created;
    });

    return parseInvoiceRow(result);
  });
}

// ---------------------------------------------------------------------------
// getInvoice
// ---------------------------------------------------------------------------

export async function getInvoice(
  invoiceId: number
): Promise<ActionResult<ParsedInvoice>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const [row] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!row) {
      throw new Error('Invoice not found');
    }

    return parseInvoiceRow(row);
  });
}

// ---------------------------------------------------------------------------
// getInvoiceLines
// ---------------------------------------------------------------------------

export async function getInvoiceLines(
  invoiceId: number
): Promise<ActionResult<ParsedInvoiceLine[]>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();
    const [row] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
      .limit(1);

    if (!row) {
      throw new Error('Invoice not found');
    }

    const lines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .orderBy(invoiceLines.sortOrder);

    return lines.map(parseInvoiceLineRow);
  });
}

// ---------------------------------------------------------------------------
// listInvoices
// ---------------------------------------------------------------------------

export async function listInvoices(
  filters: ListInvoicesFilters = {}
): Promise<ActionResult<ListInvoicesResult>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();
    // Shared with the SSR seed in invoices/page.tsx — see queries.ts.
    return queryInvoicesList(companyId, filters);
  });
}

// ---------------------------------------------------------------------------
// getNextNumber — exposes getNextInvoiceNumber to client components
// ---------------------------------------------------------------------------

export async function getNextNumber(): Promise<ActionResult<number>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();
    const nextNumber = await getNextInvoiceNumber(companyId);
    return nextNumber;
  });
}

// ---------------------------------------------------------------------------
// getVatSummary — VAT-1: ДДС received vs paid, net owed to НАП, by month
// ---------------------------------------------------------------------------

export interface VatMonthRow {
  /** ISO month, e.g. "2026-07" */
  month: string;
  /** VAT charged on issued documents (accrual: all finalized; CN subtract). */
  vatIssued: number;
  /** VAT paid on received documents (confirmed, non-archived). */
  vatPaid: number;
  /** vatIssued − vatPaid: positive = owed to НАП, negative = refundable. */
  vatNet: number;
}

export interface VatSummary {
  /** The company base currency all figures are expressed in (GEN-1). */
  baseCurrency: string;
  rows: VatMonthRow[];
}

export async function getVatSummary(input?: {
  months?: number;
}): Promise<ActionResult<VatSummary>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();
    const months = Math.min(Math.max(input?.months ?? 12, 1), 36);

    // GEN-1: all figures convert to the company base currency (× frozen
    // fxRate), so the summary is per month — no per-currency split.
    const [companyRow] = await db
      .select({ base: companies.defaultCurrency })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    const baseCurrency = companyRow?.base ?? 'EUR';

    const issued = await db
      .select({
        month: sql<string>`to_char(${invoices.issueDate}::date, 'YYYY-MM')`,
        vat: issuedVatSumSql,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.companyId, companyId),
          sql`${invoices.issueDate}::date >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1})`
        )
      )
      .groupBy(sql`to_char(${invoices.issueDate}::date, 'YYYY-MM')`);

    const paid = await db
      .select({
        month: sql<string>`to_char(${receivedInvoices.issueDate}::date, 'YYYY-MM')`,
        vat: sql<string>`COALESCE(SUM(
          CASE WHEN ${receivedInvoices.status} = 'confirmed'
               AND ${receivedInvoices.archivedAt} IS NULL
          THEN ${receivedInvoices.vatAmount}::numeric * ${receivedInvoices.fxRate}::numeric
          ELSE 0 END
        ), 0)`,
      })
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.companyId, companyId),
          sql`${receivedInvoices.issueDate}::date >= date_trunc('month', CURRENT_DATE) - make_interval(months => ${months - 1})`
        )
      )
      .groupBy(sql`to_char(${receivedInvoices.issueDate}::date, 'YYYY-MM')`);

    const byMonth = new Map<string, VatMonthRow>();
    const upsert = (month: string | null) => {
      const m = month ?? 'unknown';
      let row = byMonth.get(m);
      if (!row) {
        row = { month: m, vatIssued: 0, vatPaid: 0, vatNet: 0 };
        byMonth.set(m, row);
      }
      return row;
    };
    for (const r of issued) {
      upsert(r.month).vatIssued = Math.round(parseFloat(r.vat) * 100) / 100;
    }
    for (const r of paid) {
      upsert(r.month).vatPaid = Math.round(parseFloat(r.vat) * 100) / 100;
    }
    for (const row of byMonth.values()) {
      row.vatNet = Math.round((row.vatIssued - row.vatPaid) * 100) / 100;
    }

    return {
      baseCurrency,
      rows: [...byMonth.values()].sort((a, b) =>
        b.month.localeCompare(a.month)
      ),
    };
  });
}
