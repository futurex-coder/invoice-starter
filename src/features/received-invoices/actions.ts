'use server';

import { and, eq, desc, sql, isNull, ne, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  receivedInvoices,
  receivedInvoiceLines,
  partners,
  companies,
  ActivityType,
} from '@/lib/db/schema';
import { logActivity } from '@/lib/db/activity';
import {
  createSignedUrl,
  deleteFromBucket,
} from '@/lib/supabase/storage';
import { action, type ActionResult } from '@/lib/actions/result';
import { requireCompanyAccess } from '@/lib/auth/guards';
import { ReceivedInvoiceReviewSchema } from './schema';
import { calculateReceivedInvoice } from './calculator';
import type {
  AccountingStatus,
  DuplicateMatch,
  PaymentStatus,
  ReceivedInvoiceLifecycleStatus,
  ReceivedInvoiceReviewInput,
  SupplierSnapshot,
  UploadDraftResult,
} from './types';
import {
  parseAccountingStatus,
  parseLifecycleStatus,
  parsePaymentStatus,
  parseReceivedInvoiceLineRow,
  parseReceivedInvoiceRow,
  parseSupplierSnapshot,
} from './parsers';
import type {
  ParsedReceivedInvoice,
  ParsedReceivedInvoiceLine,
} from './parsed-types';
import type { ExtractedInvoice } from '@/app/api/invoices/extract/schema';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function digitsOnly(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length === 0 ? null : digits;
}

function supplierFromExtraction(extraction: ExtractedInvoice): SupplierSnapshot {
  return {
    legalName: extraction.supplier_name?.value ?? null,
    eik: digitsOnly(extraction.supplier_eik?.value ?? null),
    vatNumber: extraction.supplier_vat_number?.value ?? null,
    country: extraction.supplier_address_country?.value ?? null,
    city: extraction.supplier_address_city?.value ?? null,
    street: extraction.supplier_address_street?.value ?? null,
    postCode: extraction.supplier_address_post_code?.value ?? null,
  };
}

async function findPartnerByEik(
  companyId: number,
  eik: string
): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.companyId, companyId), eq(partners.eik, eik)))
    .limit(1);
  return row ?? null;
}

/** Dedupe fallback for partners without an EIK (RV-4): exact-name match. */
async function findPartnerByName(
  companyId: number,
  name: string
): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(and(eq(partners.companyId, companyId), eq(partners.name, name)))
    .limit(1);
  return row ?? null;
}

async function findDuplicates(
  companyId: number,
  options: {
    excludeId?: number;
    checksum?: string | null;
    partnerId?: number | null;
    invoiceNumber?: string | null;
    issueDate?: string | null;
  }
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];

  if (options.checksum) {
    const conditions = [
      eq(receivedInvoices.companyId, companyId),
      eq(receivedInvoices.fileChecksumSha256, options.checksum),
      ne(receivedInvoices.status, 'discarded'),
    ];
    if (options.excludeId) {
      conditions.push(ne(receivedInvoices.id, options.excludeId));
    }
    const rows = await db
      .select({
        id: receivedInvoices.id,
        invoiceNumber: receivedInvoices.invoiceNumber,
        issueDate: receivedInvoices.issueDate,
      })
      .from(receivedInvoices)
      .where(and(...conditions))
      .limit(5);
    for (const r of rows) {
      matches.push({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        issueDate: r.issueDate,
        matchType: 'checksum',
      });
    }
  }

  if (
    options.partnerId &&
    options.invoiceNumber &&
    options.invoiceNumber.trim() !== '' &&
    options.issueDate
  ) {
    const conditions = [
      eq(receivedInvoices.companyId, companyId),
      eq(receivedInvoices.partnerId, options.partnerId),
      eq(receivedInvoices.invoiceNumber, options.invoiceNumber.trim()),
      eq(receivedInvoices.issueDate, options.issueDate),
      ne(receivedInvoices.status, 'discarded'),
    ];
    if (options.excludeId) {
      conditions.push(ne(receivedInvoices.id, options.excludeId));
    }
    const rows = await db
      .select({
        id: receivedInvoices.id,
        invoiceNumber: receivedInvoices.invoiceNumber,
        issueDate: receivedInvoices.issueDate,
      })
      .from(receivedInvoices)
      .where(and(...conditions))
      .limit(5);
    for (const r of rows) {
      if (matches.find((m) => m.id === r.id)) continue;
      matches.push({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        issueDate: r.issueDate,
        matchType: 'fields',
      });
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// ASYNC-SCAN upload → analyze → draft pipeline
//   1. /api/received-invoices/upload stores the file + createAnalyzingRow (shell)
//   2. /api/received-invoices/[id]/analyze runs the AI + applyExtractionToRow
//   3. on failure the analyze route calls markAnalysisFailed (retryable)
// ---------------------------------------------------------------------------

/**
 * Pure mapper: turn a raw AI extraction into the DB-shaped draft values
 * (line rows with computed amounts, header totals, and the extracted header
 * fields). Shared by the analyze path — no DB access here.
 */
function mapExtractionToDraft(extraction: ExtractedInvoice): {
  supplier: SupplierSnapshot;
  lines: Array<{
    sortOrder: number;
    description: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    vatRate: number;
    discountPercent: string;
    netAmount: string;
    vatAmount: string;
    grossAmount: string;
  }>;
  totals: { net: number; vat: number; gross: number };
  invoiceNumber: string | null;
  issueDate: string | null;
  supplyDate: string | null;
  currency: string;
  paymentMethod: string;
  customerNote: string | null;
} {
  const supplier = supplierFromExtraction(extraction);

  const lines = extraction.line_items.map((l, i) => {
    const subtotal = l.quantity * l.unit_price;
    const discount = subtotal * (l.discount_percent / 100);
    const net = Math.round((subtotal - discount) * 100) / 100;
    const vat = Math.round(net * (l.vat_rate / 100) * 100) / 100;
    const gross = Math.round((net + vat) * 100) / 100;
    return {
      sortOrder: i,
      description: l.description,
      quantity: String(l.quantity),
      unit: l.unit,
      unitPrice: String(l.unit_price),
      vatRate: l.vat_rate,
      discountPercent: String(l.discount_percent),
      netAmount: String(net),
      vatAmount: String(vat),
      grossAmount: String(gross),
    };
  });

  const totals = lines.reduce(
    (acc, l) => ({
      net: acc.net + Number(l.netAmount),
      vat: acc.vat + Number(l.vatAmount),
      gross: acc.gross + Number(l.grossAmount),
    }),
    { net: 0, vat: 0, gross: 0 }
  );

  return {
    supplier,
    lines,
    totals,
    invoiceNumber: extraction.invoice_number?.value ?? null,
    issueDate: extraction.issue_date?.value ?? null,
    supplyDate: extraction.supply_date?.value ?? null,
    currency: extraction.currency?.value ?? 'EUR',
    paymentMethod: extraction.payment_method?.value ?? 'bank',
    customerNote: extraction.customer_note?.value ?? null,
  };
}

/**
 * ASYNC-SCAN step 1: insert a shell row at upload time, BEFORE the AI runs.
 * Status is 'analyzing'; extracted fields are empty until `applyExtractionToRow`
 * fills them. Returns the new id so the client can kick off analysis.
 */
export async function createAnalyzingRow(input: {
  fileBucket: string;
  fileObjectKey: string;
  fileMimeType: string;
  fileSizeBytes: number;
  fileOriginalName: string;
  fileChecksumSha256: string;
}): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [row] = await db
      .insert(receivedInvoices)
      .values({
        companyId,
        uploadedByUserId: user.id,
        status: 'analyzing',
        fileBucket: input.fileBucket,
        fileObjectKey: input.fileObjectKey,
        fileMimeType: input.fileMimeType,
        fileSizeBytes: input.fileSizeBytes,
        fileOriginalName: input.fileOriginalName,
        fileChecksumSha256: input.fileChecksumSha256,
        rawExtraction: null,
        analysisStartedAt: new Date(),
      })
      .returning({ id: receivedInvoices.id });

    if (!row) throw new Error('Failed to create received invoice row');

    await logActivity(
      companyId,
      user.id,
      ActivityType.UPLOAD_RECEIVED_INVOICE
    );

    return { id: row.id };
  });
}

/**
 * ASYNC-SCAN step 2: fill an 'analyzing' row with the AI extraction and flip
 * it to 'draft'. Idempotent — replaces line items so a re-run (retry / double
 * fire) can't duplicate them. Company-scoped; only touches rows that are still
 * 'analyzing' or 'failed' (never overwrites a reviewed draft/confirmed row).
 */
export async function applyExtractionToRow(
  id: number,
  rawExtraction: ExtractedInvoice,
  extractionModelId: string
): Promise<ActionResult<UploadDraftResult>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select({
        id: receivedInvoices.id,
        status: receivedInvoices.status,
        checksum: receivedInvoices.fileChecksumSha256,
      })
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) throw new Error('Received invoice not found');
    if (existing.status !== 'analyzing' && existing.status !== 'failed') {
      // Already reviewed — do not clobber. Report the current id back.
      return { id, duplicates: [] };
    }

    const mapped = mapExtractionToDraft(rawExtraction);
    const partnerMatch = mapped.supplier.eik
      ? await findPartnerByEik(companyId, mapped.supplier.eik)
      : null;

    await db.transaction(async (tx) => {
      await tx
        .update(receivedInvoices)
        .set({
          status: 'draft',
          rawExtraction,
          extractionConfidence: rawExtraction.overall_confidence,
          extractionModelId,
          extractedAt: new Date(),
          analysisError: null,
          partnerId: partnerMatch?.id ?? null,
          supplierSnapshot: mapped.supplier,
          invoiceNumber: mapped.invoiceNumber,
          issueDate: mapped.issueDate,
          supplyDate: mapped.supplyDate,
          currency: mapped.currency,
          fxRate: '1',
          netAmount: String(Math.round(mapped.totals.net * 100) / 100),
          vatAmount: String(Math.round(mapped.totals.vat * 100) / 100),
          grossAmount: String(Math.round(mapped.totals.gross * 100) / 100),
          paymentMethod: mapped.paymentMethod,
          notes: mapped.customerNote,
          updatedAt: new Date(),
        })
        .where(eq(receivedInvoices.id, id));

      // Replace lines (idempotent re-run safety).
      await tx
        .delete(receivedInvoiceLines)
        .where(eq(receivedInvoiceLines.receivedInvoiceId, id));

      if (mapped.lines.length > 0) {
        await tx
          .insert(receivedInvoiceLines)
          .values(
            mapped.lines.map((l) => ({ ...l, receivedInvoiceId: id }))
          );
      }
    });

    const duplicates = await findDuplicates(companyId, {
      excludeId: id,
      checksum: existing.checksum,
      partnerId: partnerMatch?.id ?? null,
      invoiceNumber: mapped.invoiceNumber,
      issueDate: mapped.issueDate,
    });

    return { id, duplicates };
  });
}

/**
 * ASYNC-SCAN: mark an 'analyzing' row as 'failed' so the list can offer Retry.
 * Keeps the file (retryable). Company-scoped.
 */
export async function markAnalysisFailed(
  id: number,
  message: string
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();
    await db
      .update(receivedInvoices)
      .set({
        status: 'failed',
        analysisError: message.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId),
          eq(receivedInvoices.status, 'analyzing')
        )
      );
    return { id };
  });
}

// ---------------------------------------------------------------------------
// listReceivedInvoices
// ---------------------------------------------------------------------------

export interface ListReceivedInvoicesFilters {
  status?: ReceivedInvoiceLifecycleStatus;
  accountingStatus?: AccountingStatus;
  paymentStatus?: PaymentStatus;
  includeArchived?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ReceivedInvoiceListItem {
  id: number;
  status: ReceivedInvoiceLifecycleStatus;
  accountingStatus: AccountingStatus;
  paymentStatus: PaymentStatus;
  archivedAt: Date | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  grossAmount: string;
  partnerId: number | null;
  partnerName: string | null;
  supplierSnapshot: SupplierSnapshot;
  extractionConfidence: string | null;
  fileMimeType: string;
  createdAt: Date;
}

export async function listReceivedInvoices(
  filters: ListReceivedInvoicesFilters = {}
): Promise<
  ActionResult<{
    items: ReceivedInvoiceListItem[];
    total: number;
    page: number;
    pageSize: number;
    pendingCount: number;
  }>
> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 20, 100);
    const offset = (page - 1) * pageSize;

    const conditions = [eq(receivedInvoices.companyId, companyId)];

    if (filters.status) {
      conditions.push(eq(receivedInvoices.status, filters.status));
    } else {
      // Default "working set" view: show analyzing / failed / draft / confirmed,
      // hide only discarded (reachable via the explicit Discarded filter). This
      // keeps in-progress (async-scan) rows visible so the list can drive their
      // analysis — otherwise a freshly-uploaded row would be hidden and stall.
      conditions.push(ne(receivedInvoices.status, 'discarded'));
    }
    if (filters.accountingStatus) {
      conditions.push(
        eq(receivedInvoices.accountingStatus, filters.accountingStatus)
      );
    }
    if (filters.paymentStatus) {
      conditions.push(
        eq(receivedInvoices.paymentStatus, filters.paymentStatus)
      );
    }
    if (!filters.includeArchived) {
      conditions.push(isNull(receivedInvoices.archivedAt));
    }
    if (filters.dateFrom) {
      conditions.push(gte(receivedInvoices.issueDate, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(receivedInvoices.issueDate, filters.dateTo));
    }
    if (filters.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      conditions.push(
        sql`(
          ${receivedInvoices.invoiceNumber} ILIKE ${term}
          OR ${receivedInvoices.supplierSnapshot}->>'legalName' ILIKE ${term}
          OR EXISTS (
            SELECT 1 FROM partners p
            WHERE p.id = ${receivedInvoices.partnerId}
              AND (p.name ILIKE ${term} OR p.eik LIKE ${term})
          )
        )`
      );
    }

    const where = and(...conditions);

    const [rows, countResult, pendingResult] = await Promise.all([
      db
        .select({
          id: receivedInvoices.id,
          status: receivedInvoices.status,
          accountingStatus: receivedInvoices.accountingStatus,
          paymentStatus: receivedInvoices.paymentStatus,
          archivedAt: receivedInvoices.archivedAt,
          invoiceNumber: receivedInvoices.invoiceNumber,
          issueDate: receivedInvoices.issueDate,
          dueDate: receivedInvoices.dueDate,
          currency: receivedInvoices.currency,
          grossAmount: receivedInvoices.grossAmount,
          partnerId: receivedInvoices.partnerId,
          partnerName: partners.name,
          supplierSnapshot: receivedInvoices.supplierSnapshot,
          extractionConfidence: receivedInvoices.extractionConfidence,
          fileMimeType: receivedInvoices.fileMimeType,
          createdAt: receivedInvoices.createdAt,
        })
        .from(receivedInvoices)
        .leftJoin(partners, eq(receivedInvoices.partnerId, partners.id))
        .where(where)
        .orderBy(desc(receivedInvoices.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(receivedInvoices)
        .where(where),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(receivedInvoices)
        .where(
          and(
            eq(receivedInvoices.companyId, companyId),
            eq(receivedInvoices.status, 'draft')
          )
        ),
    ]);

    const items: ReceivedInvoiceListItem[] = rows.map((r) => ({
      ...r,
      status: parseLifecycleStatus(r.status),
      accountingStatus: parseAccountingStatus(r.accountingStatus),
      paymentStatus: parsePaymentStatus(r.paymentStatus),
      supplierSnapshot: parseSupplierSnapshot(r.supplierSnapshot),
    }));

    return {
      items,
      total: countResult[0]?.count ?? 0,
      pendingCount: pendingResult[0]?.count ?? 0,
      page,
      pageSize,
    };
  });
}

// ---------------------------------------------------------------------------
// getReceivedInvoice
// ---------------------------------------------------------------------------

export interface GetReceivedInvoiceResult {
  row: ParsedReceivedInvoice;
  lines: ParsedReceivedInvoiceLine[];
  partnerSuggestion:
    | { matchedPartnerId: number; matchedPartnerName: string }
    | null;
  fileSignedUrl: string;
  nextPendingId: number | null;
  pendingPosition: { index: number; total: number } | null;
}

export async function getReceivedInvoice(
  id: number
): Promise<ActionResult<GetReceivedInvoiceResult>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const [row] = await db
      .select()
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!row) {
      throw new Error('Received invoice not found');
    }

    const lines = await db
      .select()
      .from(receivedInvoiceLines)
      .where(eq(receivedInvoiceLines.receivedInvoiceId, id))
      .orderBy(receivedInvoiceLines.sortOrder);

    let partnerSuggestion:
      | { matchedPartnerId: number; matchedPartnerName: string }
      | null = null;
    if (!row.partnerId) {
      const supplier = parseSupplierSnapshot(row.supplierSnapshot);
      if (supplier.eik) {
        const match = await findPartnerByEik(companyId, supplier.eik);
        if (match) {
          const [p] = await db
            .select({ name: partners.name })
            .from(partners)
            .where(eq(partners.id, match.id))
            .limit(1);
          partnerSuggestion = {
            matchedPartnerId: match.id,
            matchedPartnerName: p?.name ?? '(unknown)',
          };
        }
      }
    }

    const fileSignedUrl = await createSignedUrl({
      bucket: row.fileBucket,
      path: row.fileObjectKey,
      expiresInSeconds: 600,
    });

    let nextPendingId: number | null = null;
    let pendingPosition: { index: number; total: number } | null = null;

    if (row.status === 'draft') {
      const pendingRows = await db
        .select({ id: receivedInvoices.id })
        .from(receivedInvoices)
        .where(
          and(
            eq(receivedInvoices.companyId, companyId),
            eq(receivedInvoices.status, 'draft'),
            isNull(receivedInvoices.archivedAt)
          )
        )
        .orderBy(receivedInvoices.createdAt);
      const ids = pendingRows.map((r) => r.id);
      const idx = ids.indexOf(id);
      if (idx >= 0) {
        pendingPosition = { index: idx + 1, total: ids.length };
        nextPendingId = ids[idx + 1] ?? null;
      }
    }

    return {
      row: parseReceivedInvoiceRow(row),
      lines: lines.map(parseReceivedInvoiceLineRow),
      partnerSuggestion,
      fileSignedUrl,
      nextPendingId,
      pendingPosition,
    };
  });
}

// ---------------------------------------------------------------------------
// updateReceivedInvoiceDraft — save reviewer edits without confirming
// ---------------------------------------------------------------------------

async function applyReviewPatch(
  id: number,
  companyId: number,
  patch: ReceivedInvoiceReviewInput
): Promise<{ partnerId: number | null }> {
  const calc = calculateReceivedInvoice(patch.lineItems);

  let partnerId = patch.partnerId ?? null;
  if (!partnerId && patch.createPartnerOnConfirm) {
    // RV-4: a name is enough — foreign suppliers have no EIK. Dedupe by EIK
    // when present, else by exact name.
    const supplierName = patch.supplier.legalName?.trim() || null;
    const supplierEik = patch.supplier.eik?.trim() || null;
    const existing = supplierEik
      ? await findPartnerByEik(companyId, supplierEik)
      : supplierName
        ? await findPartnerByName(companyId, supplierName)
        : null;
    if (existing) {
      partnerId = existing.id;
    } else if (supplierName) {
      const [created] = await db
        .insert(partners)
        .values({
          companyId,
          name: supplierName,
          eik: supplierEik,
          vatNumber: patch.supplier.vatNumber?.trim() || null,
          country: patch.supplier.country ?? 'BG',
          city: patch.supplier.city ?? '',
          street: patch.supplier.street ?? '',
          postCode: patch.supplier.postCode ?? null,
        })
        .returning({ id: partners.id });
      partnerId = created?.id ?? null;
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(receivedInvoices)
      .set({
        partnerId,
        supplierSnapshot: patch.supplier,
        invoiceNumber: patch.invoiceNumber,
        issueDate: patch.issueDate,
        supplyDate: patch.supplyDate,
        dueDate: patch.dueDate,
        currency: patch.currency,
        fxRate: String(patch.fxRate),
        netAmount: String(calc.totals.netAmount),
        vatAmount: String(calc.totals.vatAmount),
        grossAmount: String(calc.totals.grossAmount),
        paymentMethod: patch.paymentMethod,
        paymentStatus: patch.paymentStatus,
        accountingStatus: patch.accountingStatus,
        notes: patch.notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    await tx
      .delete(receivedInvoiceLines)
      .where(eq(receivedInvoiceLines.receivedInvoiceId, id));

    if (calc.items.length > 0) {
      await tx.insert(receivedInvoiceLines).values(
        calc.items.map((item, i) => ({
          receivedInvoiceId: id,
          sortOrder: i,
          description: item.description,
          quantity: String(item.quantity),
          unit: item.unit,
          unitPrice: String(item.unitPrice),
          vatRate: item.vatRate,
          discountPercent: String(item.discountPercent),
          netAmount: String(item.netAmount),
          vatAmount: String(item.vatAmount),
          grossAmount: String(item.grossAmount),
        }))
      );
    }
  });

  return { partnerId };
}

export async function updateReceivedInvoiceDraft(
  id: number,
  patch: ReceivedInvoiceReviewInput
): Promise<ActionResult<{ id: number; duplicates: DuplicateMatch[] }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    ReceivedInvoiceReviewSchema.parse(patch);

    const [existing] = await db
      .select()
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error('Received invoice not found');
    }
    if (existing.status === 'discarded') {
      throw new Error('Cannot edit a discarded invoice');
    }

    const { partnerId } = await applyReviewPatch(id, companyId, patch);

    await logActivity(
      companyId,
      user.id,
      ActivityType.UPDATE_RECEIVED_INVOICE
    );

    const duplicates = await findDuplicates(companyId, {
      excludeId: id,
      checksum: existing.fileChecksumSha256,
      partnerId,
      invoiceNumber: patch.invoiceNumber,
      issueDate: patch.issueDate,
    });

    return { id, duplicates };
  });
}

// ---------------------------------------------------------------------------
// confirmReceivedInvoice — draft → confirmed (counts in aggregations)
// ---------------------------------------------------------------------------

export async function confirmReceivedInvoice(
  id: number,
  patch: ReceivedInvoiceReviewInput
): Promise<ActionResult<{ id: number; duplicates: DuplicateMatch[] }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    ReceivedInvoiceReviewSchema.parse(patch);

    const [existing] = await db
      .select()
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) {
      throw new Error('Received invoice not found');
    }
    if (existing.status === 'discarded') {
      throw new Error('Cannot confirm a discarded invoice');
    }

    if (!patch.supplier.legalName?.trim()) {
      throw new Error('Supplier legal name is required to confirm');
    }
    if (!patch.issueDate) {
      throw new Error('Issue date is required to confirm');
    }

    const { partnerId } = await applyReviewPatch(id, companyId, patch);

    const wasAlreadyConfirmed = existing.status === 'confirmed';

    // GEN-1: freeze the doc→base FX rate at confirm (a received invoice starts
    // counting in expense/VAT aggregates once confirmed). BGN↔EUR fixed; real
    // foreign currency (USD…) via ECB. amount_base = amount_doc × fxRate.
    const [co] = await db
      .select({ base: companies.defaultCurrency })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);
    const base = co?.base ?? 'EUR';
    let fxRate = '1';
    if (patch.currency !== base) {
      // Lazy import — server-only ECB service, only on the non-base path.
      const { getRateToBase } = await import('@/lib/fx/rates');
      fxRate = String(await getRateToBase(patch.currency, base));
    }

    await db
      .update(receivedInvoices)
      .set({
        status: 'confirmed',
        fxRate,
        confirmedAt: wasAlreadyConfirmed ? existing.confirmedAt : new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    await logActivity(
      companyId,
      user.id,
      ActivityType.CONFIRM_RECEIVED_INVOICE
    );

    const duplicates = await findDuplicates(companyId, {
      excludeId: id,
      checksum: existing.fileChecksumSha256,
      partnerId,
      invoiceNumber: patch.invoiceNumber,
      issueDate: patch.issueDate,
    });

    return { id, duplicates };
  });
}

// ---------------------------------------------------------------------------
// discardReceivedInvoice — soft-rejects a draft (or any non-confirmed row)
// ---------------------------------------------------------------------------

export async function discardReceivedInvoice(
  id: number
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) throw new Error('Received invoice not found');
    if (existing.status === 'confirmed') {
      throw new Error(
        'Cannot discard a confirmed invoice — archive it instead if you no longer want it counted'
      );
    }

    await db
      .update(receivedInvoices)
      .set({ status: 'discarded', updatedAt: new Date() })
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    await logActivity(
      companyId,
      user.id,
      ActivityType.DISCARD_RECEIVED_INVOICE
    );

    return { id };
  });
}

// ---------------------------------------------------------------------------
// restoreDiscardedReceivedInvoice — OI-10 (received side): discard is not a
// dead end; a discarded document goes back to draft for review.
// ---------------------------------------------------------------------------

export async function restoreDiscardedReceivedInvoice(
  id: number
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) throw new Error('Received invoice not found');
    if (existing.status !== 'discarded') {
      throw new Error('Only discarded invoices can be restored');
    }

    await db
      .update(receivedInvoices)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    await logActivity(companyId, user.id, ActivityType.UPDATE_RECEIVED_INVOICE);

    return { id };
  });
}

// ---------------------------------------------------------------------------
// Lightweight status flips (accounted / paid / archived)
// ---------------------------------------------------------------------------

export async function setReceivedInvoiceAccountingStatus(
  id: number,
  status: AccountingStatus
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select({ id: receivedInvoices.id })
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);
    if (!existing) throw new Error('Received invoice not found');

    await db
      .update(receivedInvoices)
      .set({ accountingStatus: status, updatedAt: new Date() })
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    await logActivity(
      companyId,
      user.id,
      ActivityType.UPDATE_RECEIVED_INVOICE
    );

    return { id };
  });
}

export async function setReceivedInvoicePaymentStatus(
  id: number,
  status: PaymentStatus
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select({ id: receivedInvoices.id })
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);
    if (!existing) throw new Error('Received invoice not found');

    await db
      .update(receivedInvoices)
      .set({ paymentStatus: status, updatedAt: new Date() })
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    await logActivity(
      companyId,
      user.id,
      ActivityType.UPDATE_RECEIVED_INVOICE
    );

    return { id };
  });
}

export async function setReceivedInvoiceArchived(
  id: number,
  archived: boolean
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select({ id: receivedInvoices.id })
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);
    if (!existing) throw new Error('Received invoice not found');

    await db
      .update(receivedInvoices)
      .set({
        archivedAt: archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    await logActivity(
      companyId,
      user.id,
      archived
        ? ActivityType.ARCHIVE_RECEIVED_INVOICE
        : ActivityType.UNARCHIVE_RECEIVED_INVOICE
    );

    return { id };
  });
}

// ---------------------------------------------------------------------------
// hardDeleteDiscardedReceivedInvoice — admin-only cleanup, removes file too
// ---------------------------------------------------------------------------

export async function hardDeleteDiscardedReceivedInvoice(
  id: number
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) throw new Error('Received invoice not found');
    if (existing.status !== 'discarded') {
      throw new Error('Only discarded invoices can be permanently deleted');
    }

    try {
      await deleteFromBucket({
        bucket: existing.fileBucket,
        path: existing.fileObjectKey,
      });
    } catch (e) {
      logger.warn('storage delete failed (continuing)', { err: e });
    }

    await db
      .delete(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    return { id };
  });
}

// ---------------------------------------------------------------------------
// deleteReceivedInvoice — permanently remove ANY received invoice (any status,
// including confirmed) that isn't accounted yet, plus its stored file. This is
// the direct delete the review flow's soft `discard` never covered for confirmed
// documents (which previously could only be archived). Accounted (booked)
// documents are locked — set them back to pending first.
// ---------------------------------------------------------------------------

export async function deleteReceivedInvoice(
  id: number
): Promise<ActionResult<{ id: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select()
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!existing) throw new Error('Получената фактура не е намерена');
    if (existing.accountingStatus === 'accounted') {
      throw new Error(
        'Осчетоводена фактура не може да се изтрие. Първо я върнете в „изчаква осчетоводяване“.'
      );
    }

    try {
      await deleteFromBucket({
        bucket: existing.fileBucket,
        path: existing.fileObjectKey,
      });
    } catch (e) {
      logger.warn('storage delete failed (continuing)', { err: e });
    }

    await db
      .delete(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      );

    await logActivity(companyId, user.id, ActivityType.DELETE_RECEIVED_INVOICE);

    return { id };
  });
}

// ---------------------------------------------------------------------------
// Payments summary — company-base-currency money KPIs (owed / paid this month /
// overdue) shown on the received-invoices page. The per-document detail lives in
// that list itself (payment-status filter + row actions), so this is totals only.
// Drafts and discarded never count here.
// ---------------------------------------------------------------------------

export interface PaymentsSummary {
  toPayAmount: number;
  paidThisMonthAmount: number;
  overdueCount: number;
  overdueAmount: number;
}

export async function getPaymentsSummary(): Promise<
  ActionResult<PaymentsSummary>
> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const baseConditions = [
      eq(receivedInvoices.companyId, companyId),
      eq(receivedInvoices.status, 'confirmed'),
      isNull(receivedInvoices.archivedAt),
    ];

    const today = new Date().toISOString().slice(0, 10);

    // GEN-1: gross × frozen fxRate → company base currency.
    const [totalsRow] = await db
      .select({
        toPayAmount: sql<string>`coalesce(sum(case when ${receivedInvoices.paymentStatus} <> 'paid' then ${receivedInvoices.grossAmount}::numeric * ${receivedInvoices.fxRate}::numeric else 0 end), 0)`,
        paidThisMonthAmount: sql<string>`coalesce(sum(case when ${receivedInvoices.paymentStatus} = 'paid' and date_trunc('month', ${receivedInvoices.issueDate}::timestamp) = date_trunc('month', now()) then ${receivedInvoices.grossAmount}::numeric * ${receivedInvoices.fxRate}::numeric else 0 end), 0)`,
        overdueCount: sql<number>`count(*) filter (where ${receivedInvoices.paymentStatus} <> 'paid' and ${receivedInvoices.dueDate} is not null and ${receivedInvoices.dueDate}::date < ${today}::date)`,
        overdueAmount: sql<string>`coalesce(sum(case when ${receivedInvoices.paymentStatus} <> 'paid' and ${receivedInvoices.dueDate} is not null and ${receivedInvoices.dueDate}::date < ${today}::date then ${receivedInvoices.grossAmount}::numeric * ${receivedInvoices.fxRate}::numeric else 0 end), 0)`,
      })
      .from(receivedInvoices)
      .where(and(...baseConditions));

    const totals = totalsRow ?? {
      toPayAmount: '0',
      paidThisMonthAmount: '0',
      overdueCount: 0,
      overdueAmount: '0',
    };

    return {
      toPayAmount: parseFloat(totals.toPayAmount),
      paidThisMonthAmount: parseFloat(totals.paidThisMonthAmount),
      overdueCount: Number(totals.overdueCount),
      overdueAmount: parseFloat(totals.overdueAmount),
    };
  });
}

