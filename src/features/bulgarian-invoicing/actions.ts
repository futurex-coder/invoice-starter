'use server';

import { and, eq, desc, sql, ilike, gte, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  invoices,
  invoiceLines,
  invoiceSequences,
  teamCompanyProfiles,
  partners,
  articles,
  activityLogs,
  ActivityType,
  type Invoice,
  type NewInvoice,
  type InvoiceLine,
} from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { calculateInvoice } from './calculator';
import { validateInvoice } from './validator';
import { formatInvoiceNumber, amountInWordsBg } from './formatter';
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
  issueDate: string;
  supplyDate?: string | null;
  currency?: string;
  fxRate?: number;
  /** If omitted, fetched from team company profile */
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
  // TODO: Replace with verifyCompanyRole() check after Step 2.3
  return { teamId: result.teamId };
}

// TODO: Replace with verifyCompanyRole() check after Step 2.3
function requireRole(_role: string, _allowed: string[]) {
  // No-op: user.role is removed. Role checks will use company_members.
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
// Supplier from team company profile
// ---------------------------------------------------------------------------

async function getSupplierProfile(teamId: number) {
  const [profile] = await db
    .select()
    .from(teamCompanyProfiles)
    .where(eq(teamCompanyProfiles.teamId, teamId))
    .limit(1);
  return profile ?? null;
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
  teamId: number,
  input: RecipientInput
): Promise<number | null> {
  if (input.partnerId) return input.partnerId;
  if (!input.eik?.trim()) return null;

  const [existing] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.teamId, teamId), eq(partners.eik, input.eik.trim())))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(partners)
    .values({
      teamId,
      name: input.name,
      eik: input.eik.trim(),
      vatNumber: input.vatNumber ?? null,
      isIndividual: input.isIndividual ?? false,
      country: (input.country as string) ?? 'BG',
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
  teamId: number,
  line: LineItemWithArticle,
  currency: string
): Promise<number | null> {
  if (line.articleId) return line.articleId;
  if (!line.description?.trim()) return null;

  const trimmed = line.description.trim();
  const [existing] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.teamId, teamId), eq(articles.name, trimmed)))
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(articles)
    .values({
      teamId,
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
  invoiceId: number,
  calcItems: LineItem[],
  articleIds: (number | null)[]
): Promise<void> {
  await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));

  if (calcItems.length === 0) return;

  await db.insert(invoiceLines).values(
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

  const profile = await getSupplierProfile(teamId);
  let supplier = input.supplier;
  if (!supplier) {
    if (!profile) {
      return { error: 'Company profile (Supplier) is required. Please complete it in Settings.' };
    }
    supplier = profileToSnapshot(profile);
  }

  const recipientSnapshot = recipientInputToSnapshot(input.recipient);

  const series = input.series ?? DEFAULT_SERIES[input.docType];
  const calc = calculateInvoice(input.lineItems);
  const currency = input.currency ?? 'EUR';
  const words =
    input.amountInWords?.trim() ||
    amountInWordsBg(calc.totals.totalGross, currency);

  const doc: InvoiceDocument = {
    docType: input.docType,
    status: 'draft',
    series,
    number: null,
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
    return { error: 'Validation failed', validationErrors: vr.errors };
  }

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

  // Resolve partner (find or auto-create)
  const partnerId = await resolvePartner(teamId, input.recipient);

  // Resolve articles per line item (find or auto-create)
  const articleIds = await Promise.all(
    input.lineItems.map((l) => resolveArticle(teamId, l, currency))
  );

  const newRow: NewInvoice = {
    teamId,
    createdByUserId: user.id,
    partnerId,
    supplierProfileId: profile?.id ?? null,
    docType: input.docType,
    status: 'draft',
    series,
    number: null,
    issueDate: input.issueDate,
    supplyDate: input.supplyDate ?? null,
    currency,
    fxRate: String(input.fxRate ?? 1),
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
  };

  const [created] = await db.insert(invoices).values(newRow).returning();

  // Save relational line items
  await saveInvoiceLines(created.id, calc.items, articleIds);

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
  const recipientSnapshot = input.recipient
    ? recipientInputToSnapshot(input.recipient)
    : (existing.recipientSnapshot as PartySnapshot);
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
    recipient: recipientSnapshot,
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

  // Resolve partner if recipient was provided
  let partnerId: number | null | undefined;
  if (input.recipient) {
    partnerId = await resolvePartner(teamId, input.recipient);
  }

  // Resolve articles per line item if items were provided
  let articleIds: (number | null)[] | undefined;
  if (lineItemInputs) {
    articleIds = await Promise.all(
      lineItemInputs.map((l) => resolveArticle(teamId, l, currency))
    );
  }

  const [updated] = await db
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
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teamId, teamId)))
    .returning();

  // Re-save relational line items if items were provided
  if (lineItemInputs && articleIds) {
    await saveInvoiceLines(invoiceId, calc.items, articleIds);
  }

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
  const { teamId } = await requireTeamMembership(user.id);
  // TODO: Replace with verifyCompanyRole() check after Step 2.3

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

  const totals = (existing.totals ?? { totalGross: 0 }) as InvoiceTotals;
  const currency = existing.currency ?? 'EUR';
  const amountInWords =
    existing.amountInWords?.trim() ||
    amountInWordsBg(totals.totalGross, currency);

  // Atomic: allocate number + update invoice within a transaction
  const result = await db.transaction(async (tx) => {
    const allocatedNumber = await allocateNumber(tx, teamId, existing.series);

    const [finalized] = await tx
      .update(invoices)
      .set({
        status: 'issued',
        number: allocatedNumber,
        amountInWords: amountInWords || undefined,
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
  const { teamId } = await requireTeamMembership(user.id);
  // TODO: Replace with verifyCompanyRole() check after Step 2.3

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
  const { teamId } = await requireTeamMembership(user.id);
  // TODO: Replace with verifyCompanyRole() check after Step 2.3

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

  // Build recipient snapshot: from overrides or copy from original
  const recipientSnapshot = overrides?.recipient
    ? recipientInputToSnapshot(overrides.recipient)
    : (original.recipientSnapshot as PartySnapshot);

  const issueDate = overrides?.issueDate ?? today;
  const supplyDate = overrides?.supplyDate !== undefined
    ? overrides.supplyDate
    : original.supplyDate;
  const currency = overrides?.currency ?? original.currency;
  const fxRate = overrides?.fxRate ?? Number(original.fxRate);

  // Load original invoice_lines to get article IDs
  const originalLines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, originalInvoiceId))
    .orderBy(invoiceLines.sortOrder);

  const lineItemInputs: LineItemWithArticle[] = overrides?.lineItems
    ?? (original.items as LineItem[]).map((item, i): LineItemWithArticle => ({
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
    status: 'issued',
    series,
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
    return { error: 'Validation failed', validationErrors: vr.errors };
  }

  const activityType = noteType === 'credit_note'
    ? ActivityType.CREATE_CREDIT_NOTE
    : ActivityType.CREATE_DEBIT_NOTE;

  // Resolve partner from original or override
  const partnerId = overrides?.recipient
    ? await resolvePartner(teamId, overrides.recipient)
    : original.partnerId;

  // Resolve article IDs for each line
  const articleIds = lineItemInputs.map((l) => l.articleId ?? null);

  const result = await db.transaction(async (tx) => {
    const allocatedNumber = await allocateNumber(tx, teamId, series);

    const [created] = await tx
      .insert(invoices)
      .values({
        teamId,
        createdByUserId: user.id,
        referencedInvoiceId: original.id,
        partnerId: partnerId ?? null,
        supplierProfileId: original.supplierProfileId,
        docType: noteType,
        status: 'issued',
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

    await tx.insert(activityLogs).values({
      teamId,
      userId: user.id,
      action: activityType,
      ipAddress: '',
    });

    return created;
  });

  // Save relational line items
  await saveInvoiceLines(result.id, calc.items, articleIds);

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
// getInvoiceLines
// ---------------------------------------------------------------------------

export async function getInvoiceLines(
  invoiceId: number
): Promise<ActionResult<InvoiceLine[]>> {
  const user = await requireAuth();
  const { teamId } = await requireTeamMembership(user.id);

  // Verify invoice belongs to team
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.teamId, teamId)))
    .limit(1);

  if (!row) {
    return { error: 'Invoice not found' };
  }

  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoiceId))
    .orderBy(invoiceLines.sortOrder);

  return { data: lines };
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
  if (filters.paymentStatus) {
    conditions.push(eq(invoices.paymentStatus, filters.paymentStatus));
  }
  if (filters.dateFrom) {
    conditions.push(gte(invoices.issueDate, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(invoices.issueDate, filters.dateTo));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    const searchCond = or(
      sql`${invoices.number}::text LIKE ${term}`,
      sql`${invoices.recipientSnapshot}->>'legalName' ILIKE ${term}`,
      sql`EXISTS (SELECT 1 FROM partners p WHERE p.id = ${invoices.partnerId} AND (p.name ILIKE ${term} OR p.eik LIKE ${term}))`
    );
    if (searchCond) conditions.push(searchCond);
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
