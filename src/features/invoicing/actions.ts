'use server';

import { and, eq, desc, sql, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  companies,
  companyMembers,
  partners,
  articles,
  invoices,
  ActivityType,
  type Company,
  type CompanyWithMembers,
  type Partner,
  type Article,
  type NewPartner,
  type NewArticle,
} from '@/lib/db/schema';
import { logActivity } from '@/lib/db/activity';
import {
  findCompanyByEik,
  getCompanyWithMembers,
  transferCompanyOwnership,
  softDeleteCompany,
  getDashboardMetrics,
  getActivityLogsForDashboard,
  getDeletedCompaniesForUser,
  restoreCompany,
} from '@/lib/db/queries';
import {
  canEditCompanySettings,
  canTransferOwnership,
  canDeleteCompany,
} from '@/lib/auth/permissions';
import { action, type ActionResult } from '@/lib/actions/result';
import { requireUser, requireCompanyAccess } from '@/lib/auth/guards';
import { parseCompanyRow } from '@/src/features/bulgarian-invoicing/parsers';
import type { ParsedCompany } from '@/src/features/bulgarian-invoicing/parsed-types';
import {
  upsertCompanyProfileSchema,
  createPartnerSchema,
  updatePartnerSchema,
  createArticleSchema,
  updateArticleSchema,
  listQuerySchema,
  type UpsertCompanyProfileInput,
  type CreatePartnerInput,
  type UpdatePartnerInput,
  type CreateArticleInput,
  type UpdateArticleInput,
  type ListQuery,
} from './schemas';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Duplicate-key detector — Postgres unique violation
// ---------------------------------------------------------------------------

function isUniqueViolation(e: unknown): boolean {
  if (e instanceof Error && e.message.includes('unique')) return true;
  if (typeof e === 'object' && e !== null && 'code' in e) {
    // `'code' in e` narrows `e` to `object & { code: unknown }`.
    const { code } = e;
    if (code === '23505') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// A) Company Profile
// ---------------------------------------------------------------------------

export async function getCompanyProfile(): Promise<
  ActionResult<ParsedCompany | null>
> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const [row] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    return row ? parseCompanyRow(row) : null;
  });
}

export async function upsertCompanyProfile(
  input: UpsertCompanyProfileInput
): Promise<ActionResult<ParsedCompany>> {
  return action(async () => {
    const { user, companyId, role } = await requireCompanyAccess();
    if (!canEditCompanySettings(role)) {
      throw new Error('Only the company owner can edit company settings');
    }

    const data = upsertCompanyProfileSchema.parse(input);
    const now = new Date();
    const payload = {
      legalName: data.legalName,
      eik: data.eik,
      vatNumber: data.vatNumber ?? null,
      isVatRegistered: data.isVatRegistered,
      country: data.country,
      city: data.city,
      street: data.street,
      postCode: data.postCode ?? null,
      mol: data.mol ?? null,
      bankName: data.bankName ?? null,
      iban: data.iban ?? null,
      bicSwift: data.bicSwift ?? null,
      defaultCurrency: data.defaultCurrency,
      defaultVatRate: data.defaultVatRate,
      defaultPaymentMethod: data.defaultPaymentMethod,
      updatedAt: now,
    };

    const [updated] = await db
      .update(companies)
      .set(payload)
      .where(eq(companies.id, companyId))
      .returning();

    await logActivity(companyId, user.id, ActivityType.UPDATE_COMPANY);
    return parseCompanyRow(updated);
  });
}

// ---------------------------------------------------------------------------
// B) Partners (Clients)
// ---------------------------------------------------------------------------

export async function createPartner(
  input: CreatePartnerInput
): Promise<ActionResult<Partner>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const data = createPartnerSchema.parse(input);
    let created: Partner | undefined;
    try {
      [created] = await db
        .insert(partners)
        .values({
          companyId,
          name: data.name,
          eik: data.eik,
          vatNumber: data.vatNumber ?? null,
          isIndividual: data.isIndividual,
          country: data.country,
          city: data.city,
          street: data.street,
          postCode: data.postCode ?? null,
          mol: data.mol ?? null,
          linkedCompanyId: data.linkedCompanyId ?? null,
        } satisfies NewPartner)
        .returning();
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new Error('A partner with this EIK already exists in this company');
      }
      throw e;
    }

    if (!created) throw new Error('Failed to create partner');
    await logActivity(companyId, user.id, ActivityType.CREATE_PARTNER);
    return created;
  });
}

export async function updatePartner(
  id: number,
  input: UpdatePartnerInput
): Promise<ActionResult<Partner>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const data = updatePartnerSchema.parse(input);

    const [existing] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)))
      .limit(1);

    if (!existing) throw new Error('Partner not found');

    const update: Partial<NewPartner> = { updatedAt: new Date() };
    if (data.name !== undefined) update.name = data.name;
    if (data.eik !== undefined) update.eik = data.eik;
    if (data.vatNumber !== undefined) update.vatNumber = data.vatNumber ?? null;
    if (data.isIndividual !== undefined) update.isIndividual = data.isIndividual;
    if (data.country !== undefined) update.country = data.country;
    if (data.city !== undefined) update.city = data.city;
    if (data.street !== undefined) update.street = data.street;
    if (data.postCode !== undefined) update.postCode = data.postCode ?? null;
    if (data.mol !== undefined) update.mol = data.mol ?? null;
    if (data.linkedCompanyId !== undefined) update.linkedCompanyId = data.linkedCompanyId ?? null;

    let updated: Partner | undefined;
    try {
      [updated] = await db
        .update(partners)
        .set(update)
        .where(and(eq(partners.id, id), eq(partners.companyId, companyId)))
        .returning();
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new Error('A partner with this EIK already exists in this company');
      }
      throw e;
    }

    if (!updated) throw new Error('Failed to update partner');
    await logActivity(companyId, user.id, ActivityType.UPDATE_PARTNER);
    return updated;
  });
}

export async function deletePartner(id: number): Promise<ActionResult<void>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)))
      .limit(1);

    if (!existing) throw new Error('Partner not found');

    await db
      .delete(partners)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)));
    await logActivity(companyId, user.id, ActivityType.DELETE_PARTNER);
  });
}

export async function getPartner(id: number): Promise<ActionResult<Partner | null>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const [row] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)))
      .limit(1);

    return row ?? null;
  });
}

export async function listPartners(
  query: ListQuery = { page: 1, pageSize: 20 }
): Promise<ActionResult<ListResult<Partner>>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    // `safeParse` (not `parse`) is intentional here — bad/missing pagination
    // params should fall back to defaults, not surface as a validation error.
    const parsed = listQuerySchema.safeParse(query);
    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success ? parsed.data.pageSize : 20;
    const search = parsed.success ? parsed.data.search : undefined;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(partners.companyId, companyId)];
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      const trimmed = search.trim();
      conditions.push(
        or(ilike(partners.name, term), eq(partners.eik, trimmed))!
      );
    }
    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(partners)
        .where(where)
        .orderBy(desc(partners.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(partners).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items: rows, total, page, pageSize };
  });
}

// ---------------------------------------------------------------------------
// C) Articles (Items)
// ---------------------------------------------------------------------------

export async function createArticle(
  input: CreateArticleInput
): Promise<ActionResult<Article>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const data = createArticleSchema.parse(input);
    const [created] = await db
      .insert(articles)
      .values({
        companyId,
        name: data.name,
        unit: data.unit,
        tags: data.tags ?? null,
        defaultUnitPrice: String(data.defaultUnitPrice),
        currency: data.currency,
        type: data.type ?? null,
      } satisfies NewArticle)
      .returning();

    if (!created) throw new Error('Failed to create article');
    await logActivity(companyId, user.id, ActivityType.CREATE_ARTICLE);
    return created;
  });
}

export async function updateArticle(
  id: number,
  input: UpdateArticleInput
): Promise<ActionResult<Article>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const data = updateArticleSchema.parse(input);

    const [existing] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)))
      .limit(1);

    if (!existing) throw new Error('Article not found');

    const update: Partial<NewArticle> = { updatedAt: new Date() };
    if (data.name !== undefined) update.name = data.name;
    if (data.unit !== undefined) update.unit = data.unit;
    if (data.tags !== undefined) update.tags = data.tags ?? null;
    if (data.defaultUnitPrice !== undefined) update.defaultUnitPrice = String(data.defaultUnitPrice);
    if (data.currency !== undefined) update.currency = data.currency;
    if (data.type !== undefined) update.type = data.type ?? null;

    const [updated] = await db
      .update(articles)
      .set(update)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)))
      .returning();

    if (!updated) throw new Error('Failed to update article');
    await logActivity(companyId, user.id, ActivityType.UPDATE_ARTICLE);
    return updated;
  });
}

export async function deleteArticle(id: number): Promise<ActionResult<void>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)))
      .limit(1);

    if (!existing) throw new Error('Article not found');

    await db
      .delete(articles)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)));
    await logActivity(companyId, user.id, ActivityType.DELETE_ARTICLE);
  });
}

export async function getArticle(id: number): Promise<ActionResult<Article | null>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const [row] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)))
      .limit(1);

    return row ?? null;
  });
}

export async function listArticles(
  query: ListQuery = { page: 1, pageSize: 20 }
): Promise<ActionResult<ListResult<Article>>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    // `safeParse` (not `parse`) is intentional here — bad/missing pagination
    // params should fall back to defaults, not surface as a validation error.
    const parsed = listQuerySchema.safeParse(query);
    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success ? parsed.data.pageSize : 20;
    const search = parsed.success ? parsed.data.search : undefined;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(articles.companyId, companyId)];
    if (search && search.trim()) {
      conditions.push(ilike(articles.name, `%${search.trim()}%`));
    }
    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(articles)
        .where(where)
        .orderBy(desc(articles.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(articles).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items: rows, total, page, pageSize };
  });
}

// ---------------------------------------------------------------------------
// D) Onboarding Status
// ---------------------------------------------------------------------------

export async function getOnboardingStatus(): Promise<
  ActionResult<{
    hasCompanyProfile: boolean;
    hasBankDetails: boolean;
    articleCount: number;
    partnerCount: number;
    invoiceCount: number;
    companyName: string;
  }>
> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const [[company], [articleResult], [partnerResult], [invoiceResult]] =
      await Promise.all([
        db
          .select()
          .from(companies)
          .where(eq(companies.id, companyId))
          .limit(1),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(articles)
          .where(eq(articles.companyId, companyId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(partners)
          .where(eq(partners.companyId, companyId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(invoices)
          .where(eq(invoices.companyId, companyId)),
      ]);

    return {
      hasCompanyProfile: !!company?.legalName,
      hasBankDetails: !!company?.iban,
      articleCount: articleResult?.count ?? 0,
      partnerCount: partnerResult?.count ?? 0,
      invoiceCount: invoiceResult?.count ?? 0,
      companyName: company?.legalName ?? 'Your Company',
    };
  });
}

// ---------------------------------------------------------------------------
// E) EIK Lookup — resolve a partner's EIK to a registered company
// ---------------------------------------------------------------------------

export async function lookupCompanyByEik(
  eik: string
): Promise<ActionResult<Company | null>> {
  return action(async () => {
    await requireUser();
    const company = await findCompanyByEik(eik.trim());
    return company ?? null;
  });
}

// ---------------------------------------------------------------------------
// F) Company Members — load company with members and pending invitations
// ---------------------------------------------------------------------------

export async function getCompanyMembersAction(): Promise<
  ActionResult<CompanyWithMembers>
> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();
    const data = await getCompanyWithMembers(companyId);
    if (!data) throw new Error('Company not found');
    return data;
  });
}

// ---------------------------------------------------------------------------
// G) Transfer Ownership
// ---------------------------------------------------------------------------

export async function transferOwnershipAction(
  newOwnerId: number
): Promise<ActionResult<void>> {
  return action(async () => {
    const { user, companyId, role } = await requireCompanyAccess();
    if (!canTransferOwnership(role)) {
      throw new Error('Only the company owner can transfer ownership');
    }
    if (newOwnerId === user.id) {
      throw new Error('You are already the owner');
    }
    await transferCompanyOwnership(companyId, user.id, newOwnerId);
  });
}

// ---------------------------------------------------------------------------
// H) Delete Company (soft delete)
// ---------------------------------------------------------------------------

export async function deleteCompanyAction(): Promise<ActionResult<void>> {
  return action(async () => {
    const { companyId, role } = await requireCompanyAccess();
    if (!canDeleteCompany(role)) {
      throw new Error('Only the company owner can delete the company');
    }
    await softDeleteCompany(companyId);
  });
}

// ---------------------------------------------------------------------------
// I) Dashboard — cross-company metrics and activity
// ---------------------------------------------------------------------------

type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
type DashboardActivityLog = Awaited<
  ReturnType<typeof getActivityLogsForDashboard>
>[number];

export async function getDashboardData(): Promise<
  ActionResult<DashboardMetrics>
> {
  return action(async () => {
    const user = await requireUser();
    return getDashboardMetrics(user.id);
  });
}

export async function getDashboardActivityAction(
  onlyOwnActions: boolean
): Promise<ActionResult<DashboardActivityLog[]>> {
  return action(async () => {
    const user = await requireUser();
    return getActivityLogsForDashboard(user.id, {
      onlyOwnActions,
      limit: 10,
    });
  });
}

// ---------------------------------------------------------------------------
// J) Create Company
// ---------------------------------------------------------------------------

export type CreateCompanyInput = {
  legalName: string;
  eik: string;
  vatNumber?: string | null;
  isVatRegistered: boolean;
  country: string;
  city: string;
  street: string;
  postCode?: string | null;
  mol?: string | null;
  bankName?: string | null;
  iban?: string | null;
  bicSwift?: string | null;
  defaultCurrency: string;
  defaultVatRate: number;
  defaultPaymentMethod: string;
};

export async function createCompanyAction(
  input: CreateCompanyInput
): Promise<ActionResult<{ companyId: number }>> {
  return action(async () => {
    const user = await requireUser();

    const existing = await findCompanyByEik(input.eik.trim());
    if (existing) {
      throw new Error(
        'A company with this EIK already exists. Please ask the company owner to invite you instead.'
      );
    }

    let newCompany: { id: number } | undefined;
    try {
      [newCompany] = await db
        .insert(companies)
        .values({
          legalName: input.legalName.trim(),
          eik: input.eik.trim(),
          vatNumber: input.vatNumber?.trim() || null,
          isVatRegistered: input.isVatRegistered,
          country: input.country.trim() || 'BG',
          city: input.city.trim(),
          street: input.street.trim(),
          postCode: input.postCode?.trim() || null,
          mol: input.mol?.trim() || null,
          bankName: input.bankName?.trim() || null,
          iban: input.iban?.trim() || null,
          bicSwift: input.bicSwift?.trim() || null,
          defaultCurrency: input.defaultCurrency,
          defaultVatRate: input.defaultVatRate,
          defaultPaymentMethod: input.defaultPaymentMethod,
        })
        .returning({ id: companies.id });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new Error(
          'A company with this EIK already exists. Please ask the company owner to invite you instead.'
        );
      }
      throw e;
    }

    if (!newCompany) throw new Error('Failed to create company');

    await db.insert(companyMembers).values({
      userId: user.id,
      companyId: newCompany.id,
      role: 'owner',
    });

    await logActivity(newCompany.id, user.id, ActivityType.CREATE_COMPANY);

    return { companyId: newCompany.id };
  });
}

// ---------------------------------------------------------------------------
// K) Deleted Companies — list and restore
// ---------------------------------------------------------------------------

type DeletedCompanyRow = Awaited<
  ReturnType<typeof getDeletedCompaniesForUser>
>[number];

export async function getDeletedCompaniesAction(): Promise<
  ActionResult<DeletedCompanyRow[]>
> {
  return action(async () => {
    const user = await requireUser();
    return getDeletedCompaniesForUser(user.id);
  });
}

export async function restoreCompanyAction(
  companyId: number
): Promise<ActionResult<void>> {
  return action(async () => {
    const user = await requireUser();

    const deleted: DeletedCompanyRow[] = await getDeletedCompaniesForUser(user.id);
    const match = deleted.find((d) => d.company.id === companyId);
    if (!match) {
      throw new Error('Company not found or you are not the owner');
    }

    await restoreCompany(companyId);
    await logActivity(companyId, user.id, ActivityType.RESTORE_COMPANY);
  });
}
