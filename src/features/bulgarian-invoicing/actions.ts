'use server';

import { and, eq, desc, sql, ilike, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  invoices,
  invoiceSequences,
  teamMembers,
  activityLogs,
  ActivityType,
  type Invoice,
  type NewInvoice,
} from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { calculateInvoice } from './calculator';
import { validateInvoice } from './validator';
import { formatInvoiceNumber } from './formatter';
import { DEFAULT_SERIES, canTransition, requiresReference } from './rules';
import type {
  DocType,
  InvoiceStatus,
  LineItemInput,
  PartySnapshot,
  InvoiceDocument,
  InvoiceTotals,
  LineItem,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionResult<T = undefined> {
  error?: string;
  validationErrors?: { code: string; field: string; message: string }[];
  data?: T;
}

interface CreateInvoiceDraftInput {
  docType: DocType;
  series?: string;
  issueDate: string;
  supplyDate?: string | null;
  currency?: string;
  fxRate?: number;
  supplier: PartySnapshot;
  recipient: PartySnapshot;
  lineItems: LineItemInput[];
  referencedInvoiceId?: number | null;
}

interface UpdateInvoiceDraftInput {
  issueDate?: string;
  supplyDate?: string | null;
  currency?: string;
  fxRate?: number;
  supplier?: PartySnapshot;
  recipient?: PartySnapshot;
  lineItems?: LineItemInput[];
  referencedInvoiceId?: number | null;
}

interface NoteOverrides {
  issueDate?: string;
  supplyDate?: string | null;
  currency?: string;
  fxRate?: number;
  supplier?: PartySnapshot;
  recipient?: PartySnapshot;
  lineItems?: LineItemInput[];
}

interface ListInvoicesFilters {
  status?: InvoiceStatus;
  docType?: DocType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

interface ListInvoicesResult {
  invoices: Invoice[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function requireAuth() {
  const user = await getUser();
  if (!user) throw new Error('User is not authenticated');
  return user;
}

async function requireTeamMembership(userId: number) {
  const result = await getUserWithTeam(userId);
  if (!result?.teamId) throw new Error('User is not part of a team');
  return { teamId: result.teamId, teamRole: result.user.role };
}

function requireRole(role: string, allowed: string[]) {
  if (!allowed.includes(role)) {
    throw new Error('Insufficient permissions');
  }
}

// ---------------------------------------------------------------------------
// Activity log helper
// ---------------------------------------------------------------------------

async function logInvoiceActivity(
  teamId: number,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  await db.insert(activityLogs).values({
    teamId,
    userId,
    action: type,
    ipAddress: ipAddress ?? '',
  });
}

// ---------------------------------------------------------------------------
// Sequence allocator (atomic, row-locked)
// ---------------------------------------------------------------------------

async function allocateNumber(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  teamId: number,
  series: string
): Promise<number> {
  // Upsert the sequence row, then lock & increment atomically.
  // INSERT ... ON CONFLICT ... DO UPDATE with RETURNING gives us the
  // allocated number in a single round-trip with implicit row lock.
  const [row] = await tx.execute<{ allocated: number }>(sql`
    INSERT INTO invoice_sequences (team_id, series, next_number, updated_at)
    VALUES (${teamId}, ${series}, 2, NOW())
    ON CONFLICT (team_id, series)
    DO UPDATE SET
      next_number = invoice_sequences.next_number + 1,
      updated_at = NOW()
    RETURNING next_number - 1 AS allocated
  `);
  return (row as Record<string, unknown>).allocated as number;
}

// ---------------------------------------------------------------------------
// DB row <-> domain document mapping
// ---------------------------------------------------------------------------

function rowToDocument(row: Invoice): InvoiceDocument {
  const items = (row.items ?? []) as LineItem[];
  const totals = (row.totals ?? {
    totalNet: 0,
    totalVat: 0,
    totalGross: 0,
    vatBreakdown: [],
  }) as InvoiceTotals;

  return {
    docType: row.docType as DocType,
    status: row.status as InvoiceStatus,
    series: row.series,
    number: row.number,
    issueDate: row.issueDate,
    supplyDate: row.supplyDate,
    currency: row.currency,
    fxRate: Number(row.fxRate),
    supplier: (row.supplierSnapshot ?? {}) as PartySnapshot,
    recipient: (row.recipientSnapshot ?? {}) as PartySnapshot,
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
): Promise<ActionResult<Invoice>> {
  const user = await requireAuth();
  const { teamId } = await requireTeamMembership(user.id);
  // Members and owners can create drafts

  const series = input.series ?? DEFAULT_SERIES[input.docType];
  const calc = calculateInvoice(input.lineItems);

  // Validate the prospective document
  const doc: InvoiceDocument = {
    docType: input.docType,
    status: 'draft',
    series,
    number: null,
    issueDate: input.issueDate,
    supplyDate: input.supplyDate ?? null,
    currency: input.currency ?? 'EUR',
    fxRate: input.fxRate ?? 1,
    supplier: input.supplier,
    recipient: input.recipient,
    items: calc.items,
    totals: calc.totals,
    referencedInvoiceNumber: input.referencedInvoiceId
      ? String(input.referencedInvoiceId)
      : null,
  };

  const vr = validateInvoice(doc);
  if (!vr.valid) {
    return { error: 'Validation failed', validationErrors: vr.errors };
  }

  // Verify referenced invoice belongs to same team
  if (input.referencedInvoiceId) {
    const [ref] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, input.referencedInvoiceId),
          eq(invoices.teamId, teamId)
        )
      )
      .limit(1);
    if (!ref) {
      return { error: 'Referenced invoice not found in this team' };
    }
  }

  const newRow: NewInvoice = {
    teamId,
    createdByUserId: user.id,
    docType: input.docType,
    status: 'draft',
    series,
    number: null,
    issueDate: input.issueDate,
    supplyDate: input.supplyDate ?? null,
    currency: input.currency ?? 'EUR',
    fxRate: String(input.fxRate ?? 1),
    supplierSnapshot: input.supplier,
    recipientSnapshot: input.recipient,
    items: calc.items,
    totals: calc.totals,
    referencedInvoiceId: input.referencedInvoiceId ?? null,
  };

  const [created] = await db.insert(invoices).values(newRow).returning();

  await logInvoiceActivity(teamId, user.id, ActivityType.CREATE_INVOICE);

  return { data: created };
}

// ---------------------------------------------------------------------------
// updateInvoiceDraft
// ---------------------------------------------------------------------------

export async function updateInvoiceDraft(
  invoiceId: number,
  input: UpdateInvoiceDraftInput
): Promise<ActionResult<Invoice>> {
  const user = await requireAuth();
  const { teamId } = await requireTeamMembership(user.id);
  // Members and owners can update drafts

  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teamId, teamId)))
    .limit(1);

  if (!existing) {
    return { error: 'Invoice not found' };
  }
  if (existing.status !== 'draft') {
    return { error: 'Only draft invoices can be updated' };
  }

  const supplier = input.supplier ?? (existing.supplierSnapshot as PartySnapshot);
  const recipient = input.recipient ?? (existing.recipientSnapshot as PartySnapshot);
  const lineItemInputs = input.lineItems;
  const calc = lineItemInputs
    ? calculateInvoice(lineItemInputs)
    : { items: existing.items as LineItem[], totals: existing.totals as InvoiceTotals };

  const issueDate = input.issueDate ?? existing.issueDate;
  const supplyDate = input.supplyDate !== undefined ? input.supplyDate : existing.supplyDate;
  const currency = input.currency ?? existing.currency;
  const fxRate = input.fxRate ?? Number(existing.fxRate);

  const doc: InvoiceDocument = {
    docType: existing.docType as DocType,
    status: 'draft',
    series: existing.series,
    number: null,
    issueDate,
    supplyDate: supplyDate ?? null,
    currency,
    fxRate,
    supplier,
    recipient,
    items: calc.items,
    totals: calc.totals,
    referencedInvoiceNumber: existing.referencedInvoiceId
      ? String(existing.referencedInvoiceId)
      : null,
  };

  const vr = validateInvoice(doc);
  if (!vr.valid) {
    return { error: 'Validation failed', validationErrors: vr.errors };
  }

  if (input.referencedInvoiceId !== undefined && input.referencedInvoiceId !== null) {
    const [ref] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.id, input.referencedInvoiceId),
          eq(invoices.teamId, teamId)
        )
      )
      .limit(1);
    if (!ref) {
      return { error: 'Referenced invoice not found in this team' };
    }
  }

  const [updated] = await db
    .update(invoices)
    .set({
      issueDate,
      supplyDate: supplyDate ?? null,
      currency,
      fxRate: String(fxRate),
      supplierSnapshot: supplier,
      recipientSnapshot: recipient,
      items: calc.items,
      totals: calc.totals,
      referencedInvoiceId: input.referencedInvoiceId !== undefined
        ? input.referencedInvoiceId
        : existing.referencedInvoiceId,
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teamId, teamId)))
    .returning();

  await logInvoiceActivity(teamId, user.id, ActivityType.UPDATE_INVOICE);

  return { data: updated };
}

// ---------------------------------------------------------------------------
// finalizeInvoice
// ---------------------------------------------------------------------------

export async function finalizeInvoice(
  invoiceId: number
): Promise<ActionResult<Invoice>> {
  const user = await requireAuth();
  const { teamId, teamRole } = await requireTeamMembership(user.id);
  requireRole(teamRole, ['owner']);

  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teamId, teamId)))
    .limit(1);

  if (!existing) {
    return { error: 'Invoice not found' };
  }
  if (!canTransition(existing.status as InvoiceStatus, 'issued')) {
    return { error: `Cannot finalize invoice with status "${existing.status}"` };
  }

  // Credit/debit notes must reference an original
  if (requiresReference(existing.docType as DocType) && !existing.referencedInvoiceId) {
    return { error: `${existing.docType} must reference an original invoice` };
  }

  // Pre-validate the document as if it were issued (with placeholder number)
  const preDoc: InvoiceDocument = {
    ...rowToDocument(existing),
    status: 'issued',
    number: 1,
  };
  const vr = validateInvoice(preDoc);
  if (!vr.valid) {
    return { error: 'Validation failed', validationErrors: vr.errors };
  }

  // Atomic: allocate number + update invoice within a transaction
  const result = await db.transaction(async (tx) => {
    const allocatedNumber = await allocateNumber(tx, teamId, existing.series);

    const [finalized] = await tx
      .update(invoices)
      .set({
        status: 'issued',
        number: allocatedNumber,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(invoices.id, invoiceId),
          eq(invoices.teamId, teamId),
          eq(invoices.status, 'draft')
        )
      )
      .returning();

    if (!finalized) {
      throw new Error('Failed to finalize — invoice may have been modified concurrently');
    }

    await tx.insert(activityLogs).values({
      teamId,
      userId: user.id,
      action: ActivityType.FINALIZE_INVOICE,
      ipAddress: '',
    });

    return finalized;
  });

  return { data: result };
}

// ---------------------------------------------------------------------------
// cancelInvoice
// ---------------------------------------------------------------------------

export async function cancelInvoice(
  invoiceId: number,
  reason?: string
): Promise<ActionResult<Invoice>> {
  const user = await requireAuth();
  const { teamId, teamRole } = await requireTeamMembership(user.id);
  requireRole(teamRole, ['owner']);

  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teamId, teamId)))
    .limit(1);

  if (!existing) {
    return { error: 'Invoice not found' };
  }
  if (!canTransition(existing.status as InvoiceStatus, 'cancelled')) {
    return { error: `Cannot cancel invoice with status "${existing.status}"` };
  }

  const [cancelled] = await db
    .update(invoices)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teamId, teamId)))
    .returning();

  const actionDesc = reason
    ? `${ActivityType.CANCEL_INVOICE}: ${reason}`
    : ActivityType.CANCEL_INVOICE;

  await db.insert(activityLogs).values({
    teamId,
    userId: user.id,
    action: actionDesc,
    ipAddress: '',
  });

  return { data: cancelled };
}

// ---------------------------------------------------------------------------
// createCreditNoteFromInvoice
// ---------------------------------------------------------------------------

export async function createCreditNoteFromInvoice(
  originalInvoiceId: number,
  overrides?: NoteOverrides
): Promise<ActionResult<Invoice>> {
  return createNoteFromInvoice('credit_note', originalInvoiceId, overrides);
}

// ---------------------------------------------------------------------------
// createDebitNoteFromInvoice
// ---------------------------------------------------------------------------

export async function createDebitNoteFromInvoice(
  originalInvoiceId: number,
  overrides?: NoteOverrides
): Promise<ActionResult<Invoice>> {
  return createNoteFromInvoice('debit_note', originalInvoiceId, overrides);
}

// ---------------------------------------------------------------------------
// Shared note creation (credit / debit) — creates AND finalizes atomically
// ---------------------------------------------------------------------------

async function createNoteFromInvoice(
  noteType: 'credit_note' | 'debit_note',
  originalInvoiceId: number,
  overrides?: NoteOverrides
): Promise<ActionResult<Invoice>> {
  const user = await requireAuth();
  const { teamId, teamRole } = await requireTeamMembership(user.id);
  requireRole(teamRole, ['owner']);

  const [original] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, originalInvoiceId), eq(invoices.teamId, teamId)))
    .limit(1);

  if (!original) {
    return { error: 'Original invoice not found' };
  }
  if (original.status !== 'issued') {
    return { error: 'Can only create notes against issued invoices' };
  }

  const today = new Date().toISOString().slice(0, 10);
  const series = DEFAULT_SERIES[noteType];

  const supplier = overrides?.supplier
    ?? (original.supplierSnapshot as PartySnapshot);
  const recipient = overrides?.recipient
    ?? (original.recipientSnapshot as PartySnapshot);
  const issueDate = overrides?.issueDate ?? today;
  const supplyDate = overrides?.supplyDate !== undefined
    ? overrides.supplyDate
    : original.supplyDate;
  const currency = overrides?.currency ?? original.currency;
  const fxRate = overrides?.fxRate ?? Number(original.fxRate);

  const lineItemInputs: LineItemInput[] = overrides?.lineItems
    ?? (original.items as LineItem[]).map((item): LineItemInput => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        discountPercent: item.discountPercent ?? 0,
      }));

  const calc = calculateInvoice(lineItemInputs);

  const refNumber = original.number
    ? formatInvoiceNumber(original.number)
    : String(original.id);

  const doc: InvoiceDocument = {
    docType: noteType,
    status: 'issued',
    series,
    number: 1,
    issueDate,
    supplyDate: supplyDate ?? null,
    currency,
    fxRate,
    supplier,
    recipient,
    items: calc.items,
    totals: calc.totals,
    referencedInvoiceNumber: refNumber,
  };

  const vr = validateInvoice(doc);
  if (!vr.valid) {
    return { error: 'Validation failed', validationErrors: vr.errors };
  }

  const activityType = noteType === 'credit_note'
    ? ActivityType.CREATE_CREDIT_NOTE
    : ActivityType.CREATE_DEBIT_NOTE;

  const result = await db.transaction(async (tx) => {
    const allocatedNumber = await allocateNumber(tx, teamId, series);

    const [created] = await tx
      .insert(invoices)
      .values({
        teamId,
        createdByUserId: user.id,
        referencedInvoiceId: original.id,
        docType: noteType,
        status: 'issued',
        series,
        number: allocatedNumber,
        issueDate,
        supplyDate: supplyDate ?? null,
        currency,
        fxRate: String(fxRate),
        supplierSnapshot: supplier,
        recipientSnapshot: recipient,
        items: calc.items,
        totals: calc.totals,
      })
      .returning();

    if (!created) {
      throw new Error(`Failed to create ${noteType}`);
    }

    await tx.insert(activityLogs).values({
      teamId,
      userId: user.id,
      action: activityType,
      ipAddress: '',
    });

    return created;
  });

  return { data: result };
}

// ---------------------------------------------------------------------------
// getInvoice
// ---------------------------------------------------------------------------

export async function getInvoice(
  invoiceId: number
): Promise<ActionResult<Invoice>> {
  const user = await requireAuth();
  const { teamId } = await requireTeamMembership(user.id);
  // Members and owners can view

  const [row] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teamId, teamId)))
    .limit(1);

  if (!row) {
    return { error: 'Invoice not found' };
  }

  return { data: row };
}

// ---------------------------------------------------------------------------
// listInvoices
// ---------------------------------------------------------------------------

export async function listInvoices(
  filters: ListInvoicesFilters = {}
): Promise<ActionResult<ListInvoicesResult>> {
  const user = await requireAuth();
  const { teamId } = await requireTeamMembership(user.id);
  // Members and owners can list

  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 20, 100);
  const offset = (page - 1) * pageSize;

  const conditions = [eq(invoices.teamId, teamId)];

  if (filters.status) {
    conditions.push(eq(invoices.status, filters.status));
  }
  if (filters.docType) {
    conditions.push(eq(invoices.docType, filters.docType));
  }
  if (filters.dateFrom) {
    conditions.push(gte(invoices.issueDate, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(invoices.issueDate, filters.dateTo));
  }

  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(where),
  ]);

  return {
    data: {
      invoices: rows,
      total: countResult[0]?.count ?? 0,
      page,
      pageSize,
    },
  };
}
