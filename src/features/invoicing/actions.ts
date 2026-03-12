'use server';

import { and, eq, desc, sql, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  companies,
  companyMembers,
  partners,
  articles,
  activityLogs,
  invoices,
  ActivityType,
  type Company,
  type CompanyWithMembers,
  type Partner,
  type Article,
  type NewPartner,
  type NewArticle,
} from '@/lib/db/schema';
import {
  getUser,
  getActiveCompanyId,
  verifyCompanyAccess,
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

export interface ActionResult<T = undefined> {
  error?: string;
  data?: T;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function requireCompanyAccess() {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No active company selected');

  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) throw new Error('No access to this company');

  return { user, companyId, role: membership.role };
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

async function logActivity(
  companyId: number,
  userId: number,
  action: string,
  ipAddress?: string
) {
  await db.insert(activityLogs).values({
    companyId,
    userId,
    action,
    ipAddress: ipAddress ?? '',
  });
}

// ---------------------------------------------------------------------------
// A) Company Profile
// ---------------------------------------------------------------------------

export async function getCompanyProfile(): Promise<
  ActionResult<Company | null>
> {
  try {
    const { companyId } = await requireCompanyAccess();

    const [row] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    return { data: row ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unauthorized' };
  }
}

export async function upsertCompanyProfile(
  input: UpsertCompanyProfileInput
): Promise<ActionResult<Company>> {
  try {
    const { user, companyId, role } = await requireCompanyAccess();
    if (!canEditCompanySettings(role)) {
      return { error: 'Only the company owner can edit company settings' };
    }

    const parsed = upsertCompanyProfileSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
        .join('; ');
      return { error: msg || 'Validation failed' };
    }

    const data = parsed.data;
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

    await logActivity(companyId, user.id, 'company_profile.update');
    return { data: updated! };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to save company profile' };
  }
}

// ---------------------------------------------------------------------------
// B) Partners (Clients)
// ---------------------------------------------------------------------------

export async function createPartner(
  input: CreatePartnerInput
): Promise<ActionResult<Partner>> {
  try {
    const { user, companyId } = await requireCompanyAccess();

    const parsed = createPartnerSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
        .join('; ');
      return { error: msg || 'Validation failed' };
    }

    const data = parsed.data;
    const [created] = await db
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
      } as NewPartner)
      .returning();

    if (!created) return { error: 'Failed to create partner' };
    await logActivity(companyId, user.id, 'partner.create');
    return { data: created };
  } catch (e) {
    if ((e instanceof Error && e.message.includes('unique')) || (e as { code?: string })?.code === '23505') {
      return { error: 'A partner with this EIK already exists in this company' };
    }
    return { error: e instanceof Error ? e.message : 'Failed to create partner' };
  }
}

export async function updatePartner(
  id: number,
  input: UpdatePartnerInput
): Promise<ActionResult<Partner>> {
  try {
    const { user, companyId } = await requireCompanyAccess();

    const parsed = updatePartnerSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
        .join('; ');
      return { error: msg || 'Validation failed' };
    }

    const [existing] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)))
      .limit(1);

    if (!existing) return { error: 'Partner not found' };

    const data = parsed.data;
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

    const [updated] = await db
      .update(partners)
      .set(update)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)))
      .returning();

    if (!updated) return { error: 'Failed to update partner' };
    await logActivity(companyId, user.id, 'partner.update');
    return { data: updated };
  } catch (e) {
    if (e instanceof Error && (e.message.includes('unique') || (e as { code?: string })?.code === '23505')) {
      return { error: 'A partner with this EIK already exists in this company' };
    }
    return { error: e instanceof Error ? e.message : 'Failed to update partner' };
  }
}

export async function deletePartner(id: number): Promise<ActionResult<void>> {
  try {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)))
      .limit(1);

    if (!existing) return { error: 'Partner not found' };

    await db
      .delete(partners)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)));
    await logActivity(companyId, user.id, 'partner.delete');
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete partner' };
  }
}

export async function getPartner(id: number): Promise<ActionResult<Partner | null>> {
  try {
    const { companyId } = await requireCompanyAccess();

    const [row] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), eq(partners.companyId, companyId)))
      .limit(1);

    return { data: row ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unauthorized' };
  }
}

export async function listPartners(
  query: ListQuery = { page: 1, pageSize: 20 }
): Promise<ActionResult<ListResult<Partner>>> {
  try {
    const { companyId } = await requireCompanyAccess();

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
    return { data: { items: rows, total, page, pageSize } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to list partners' };
  }
}

// ---------------------------------------------------------------------------
// C) Articles (Items)
// ---------------------------------------------------------------------------

export async function createArticle(
  input: CreateArticleInput
): Promise<ActionResult<Article>> {
  try {
    const { user, companyId } = await requireCompanyAccess();

    const parsed = createArticleSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
        .join('; ');
      return { error: msg || 'Validation failed' };
    }

    const data = parsed.data;
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
      } as NewArticle)
      .returning();

    if (!created) return { error: 'Failed to create article' };
    await logActivity(companyId, user.id, 'article.create');
    return { data: created };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to create article' };
  }
}

export async function updateArticle(
  id: number,
  input: UpdateArticleInput
): Promise<ActionResult<Article>> {
  try {
    const { user, companyId } = await requireCompanyAccess();

    const parsed = updateArticleSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
        .join('; ');
      return { error: msg || 'Validation failed' };
    }

    const [existing] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)))
      .limit(1);

    if (!existing) return { error: 'Article not found' };

    const data = parsed.data;
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

    if (!updated) return { error: 'Failed to update article' };
    await logActivity(companyId, user.id, 'article.update');
    return { data: updated };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update article' };
  }
}

export async function deleteArticle(id: number): Promise<ActionResult<void>> {
  try {
    const { user, companyId } = await requireCompanyAccess();

    const [existing] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)))
      .limit(1);

    if (!existing) return { error: 'Article not found' };

    await db
      .delete(articles)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)));
    await logActivity(companyId, user.id, 'article.delete');
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete article' };
  }
}

export async function getArticle(id: number): Promise<ActionResult<Article | null>> {
  try {
    const { companyId } = await requireCompanyAccess();

    const [row] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.companyId, companyId)))
      .limit(1);

    return { data: row ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unauthorized' };
  }
}

export async function listArticles(
  query: ListQuery = { page: 1, pageSize: 20 }
): Promise<ActionResult<ListResult<Article>>> {
  try {
    const { companyId } = await requireCompanyAccess();

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
    return { data: { items: rows, total, page, pageSize } };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to list articles' };
  }
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
  try {
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
      data: {
        hasCompanyProfile: !!company?.legalName,
        hasBankDetails: !!company?.iban,
        articleCount: articleResult?.count ?? 0,
        partnerCount: partnerResult?.count ?? 0,
        invoiceCount: invoiceResult?.count ?? 0,
        companyName: company?.legalName ?? 'Your Company',
      },
    };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Failed to load onboarding status',
    };
  }
}

// ---------------------------------------------------------------------------
// E) EIK Lookup — resolve a partner's EIK to a registered company
// ---------------------------------------------------------------------------

export async function lookupCompanyByEik(
  eik: string
): Promise<ActionResult<Company | null>> {
  try {
    await requireCompanyAccess();
    const company = await findCompanyByEik(eik.trim());
    return { data: company };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Lookup failed' };
  }
}

// ---------------------------------------------------------------------------
// F) Company Members — load company with members and pending invitations
// ---------------------------------------------------------------------------

export async function getCompanyMembersAction(): Promise<
  ActionResult<CompanyWithMembers>
> {
  try {
    const { companyId } = await requireCompanyAccess();
    const data = await getCompanyWithMembers(companyId);
    if (!data) return { error: 'Company not found' };
    return { data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load members' };
  }
}

// ---------------------------------------------------------------------------
// G) Transfer Ownership
// ---------------------------------------------------------------------------

export async function transferOwnershipAction(
  newOwnerId: number
): Promise<ActionResult<void>> {
  try {
    const { user, companyId, role } = await requireCompanyAccess();
    if (!canTransferOwnership(role)) {
      return { error: 'Only the company owner can transfer ownership' };
    }
    if (newOwnerId === user.id) {
      return { error: 'You are already the owner' };
    }
    await transferCompanyOwnership(companyId, user.id, newOwnerId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to transfer ownership' };
  }
}

// ---------------------------------------------------------------------------
// H) Delete Company (soft delete)
// ---------------------------------------------------------------------------

export async function deleteCompanyAction(): Promise<ActionResult<void>> {
  try {
    const { companyId, role } = await requireCompanyAccess();
    if (!canDeleteCompany(role)) {
      return { error: 'Only the company owner can delete the company' };
    }
    await softDeleteCompany(companyId);
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete company' };
  }
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
  try {
    const user = await getUser();
    if (!user) return { error: 'Not authenticated' };
    const data = await getDashboardMetrics(user.id);
    return { data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load dashboard' };
  }
}

export async function getDashboardActivityAction(
  onlyOwnActions: boolean
): Promise<ActionResult<DashboardActivityLog[]>> {
  try {
    const user = await getUser();
    if (!user) return { error: 'Not authenticated' };
    const logs = await getActivityLogsForDashboard(user.id, {
      onlyOwnActions,
      limit: 10,
    });
    return { data: logs };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to load activity' };
  }
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
  try {
    const user = await getUser();
    if (!user) return { error: 'Not authenticated' };

    const existing = await findCompanyByEik(input.eik.trim());
    if (existing) {
      return {
        error:
          'A company with this EIK already exists. Please ask the company owner to invite you instead.',
      };
    }

    const [newCompany] = await db
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
      .returning();

    await db.insert(companyMembers).values({
      userId: user.id,
      companyId: newCompany.id,
      role: 'owner',
    });

    await logActivity(newCompany.id, user.id, ActivityType.CREATE_COMPANY);

    return { data: { companyId: newCompany.id } };
  } catch (e) {
    if (
      (e instanceof Error && e.message.includes('unique')) ||
      (e as { code?: string })?.code === '23505'
    ) {
      return {
        error:
          'A company with this EIK already exists. Please ask the company owner to invite you instead.',
      };
    }
    return {
      error: e instanceof Error ? e.message : 'Failed to create company',
    };
  }
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
  try {
    const user = await getUser();
    if (!user) return { error: 'Not authenticated' };
    const rows = await getDeletedCompaniesForUser(user.id);
    return { data: rows };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Failed to load deleted companies',
    };
  }
}

export async function restoreCompanyAction(
  companyId: number
): Promise<ActionResult<void>> {
  try {
    const user = await getUser();
    if (!user) return { error: 'Not authenticated' };

    const deleted: DeletedCompanyRow[] = await getDeletedCompaniesForUser(user.id);
    const match = deleted.find((d) => d.company.id === companyId);
    if (!match) {
      return { error: 'Company not found or you are not the owner' };
    }

    await restoreCompany(companyId);
    await logActivity(companyId, user.id, ActivityType.RESTORE_COMPANY);
    return {};
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Failed to restore company',
    };
  }
}
