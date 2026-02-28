'use server';

import { and, eq, desc, sql, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  teamCompanyProfiles,
  partners,
  articles,
  activityLogs,
  type TeamCompanyProfile,
  type Partner,
  type Article,
  type NewTeamCompanyProfile,
  type NewPartner,
  type NewArticle,
} from '@/lib/db/schema';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
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
// Activity log
// ---------------------------------------------------------------------------

async function logActivity(
  teamId: number,
  userId: number,
  action: string,
  ipAddress?: string
) {
  await db.insert(activityLogs).values({
    teamId,
    userId,
    action,
    ipAddress: ipAddress ?? '',
  });
}

// ---------------------------------------------------------------------------
// A) Company Profile
// ---------------------------------------------------------------------------

export async function getCompanyProfile(): Promise<
  ActionResult<TeamCompanyProfile | null>
> {
  try {
    const user = await requireAuth();
    const { teamId } = await requireTeamMembership(user.id);
    // Member or Owner can view

    const [row] = await db
      .select()
      .from(teamCompanyProfiles)
      .where(eq(teamCompanyProfiles.teamId, teamId))
      .limit(1);

    return { data: row ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unauthorized' };
  }
}

export async function upsertCompanyProfile(
  input: UpsertCompanyProfileInput
): Promise<ActionResult<TeamCompanyProfile>> {
  try {
    const user = await requireAuth();
    const { teamId, teamRole } = await requireTeamMembership(user.id);
    requireRole(teamRole, ['owner']);

    const parsed = upsertCompanyProfileSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
        .join('; ');
      return { error: msg || 'Validation failed' };
    }

    const data = parsed.data;
    const [existing] = await db
      .select()
      .from(teamCompanyProfiles)
      .where(eq(teamCompanyProfiles.teamId, teamId))
      .limit(1);

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

    if (existing) {
      const [updated] = await db
        .update(teamCompanyProfiles)
        .set(payload)
        .where(eq(teamCompanyProfiles.teamId, teamId))
        .returning();
      await logActivity(teamId, user.id, 'company_profile.update');
      return { data: updated! };
    } else {
      const [created] = await db
        .insert(teamCompanyProfiles)
        .values({
          ...payload,
          teamId,
          createdAt: now,
        } as NewTeamCompanyProfile)
        .returning();
      await logActivity(teamId, user.id, 'company_profile.create');
      return { data: created! };
    }
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
    const user = await requireAuth();
    const { teamId, teamRole } = await requireTeamMembership(user.id);
    requireRole(teamRole, ['owner']);

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
        teamId,
        name: data.name,
        eik: data.eik,
        vatNumber: data.vatNumber ?? null,
        isIndividual: data.isIndividual,
        country: data.country,
        city: data.city,
        street: data.street,
        postCode: data.postCode ?? null,
        mol: data.mol ?? null,
      } as NewPartner)
      .returning();

    if (!created) return { error: 'Failed to create partner' };
    await logActivity(teamId, user.id, 'partner.create');
    return { data: created };
  } catch (e) {
    if ((e instanceof Error && e.message.includes('unique')) || (e as { code?: string })?.code === '23505') {
      return { error: 'A partner with this EIK already exists in this team' };
    }
    return { error: e instanceof Error ? e.message : 'Failed to create partner' };
  }
}

export async function updatePartner(
  id: number,
  input: UpdatePartnerInput
): Promise<ActionResult<Partner>> {
  try {
    const user = await requireAuth();
    const { teamId, teamRole } = await requireTeamMembership(user.id);
    requireRole(teamRole, ['owner']);

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
      .where(and(eq(partners.id, id), eq(partners.teamId, teamId)))
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

    const [updated] = await db
      .update(partners)
      .set(update)
      .where(and(eq(partners.id, id), eq(partners.teamId, teamId)))
      .returning();

    if (!updated) return { error: 'Failed to update partner' };
    await logActivity(teamId, user.id, 'partner.update');
    return { data: updated };
  } catch (e) {
    if (e instanceof Error && (e.message.includes('unique') || (e as { code?: string })?.code === '23505')) {
      return { error: 'A partner with this EIK already exists in this team' };
    }
    return { error: e instanceof Error ? e.message : 'Failed to update partner' };
  }
}

export async function deletePartner(id: number): Promise<ActionResult<void>> {
  try {
    const user = await requireAuth();
    const { teamId, teamRole } = await requireTeamMembership(user.id);
    requireRole(teamRole, ['owner']);

    const [existing] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(and(eq(partners.id, id), eq(partners.teamId, teamId)))
      .limit(1);

    if (!existing) return { error: 'Partner not found' };

    await db
      .delete(partners)
      .where(and(eq(partners.id, id), eq(partners.teamId, teamId)));
    await logActivity(teamId, user.id, 'partner.delete');
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete partner' };
  }
}

export async function getPartner(id: number): Promise<ActionResult<Partner | null>> {
  try {
    const user = await requireAuth();
    const { teamId } = await requireTeamMembership(user.id);

    const [row] = await db
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), eq(partners.teamId, teamId)))
      .limit(1);

    return { data: row ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unauthorized' };
  }
}

export async function listPartners(
  query: ListQuery = {}
): Promise<ActionResult<ListResult<Partner>>> {
  try {
    const user = await requireAuth();
    const { teamId } = await requireTeamMembership(user.id);

    const parsed = listQuerySchema.safeParse(query);
    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success ? parsed.data.pageSize : 20;
    const search = parsed.success ? parsed.data.search : undefined;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(partners.teamId, teamId)];
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      const trimmed = search.trim();
      conditions.push(
        or(ilike(partners.name, term), eq(partners.eik, trimmed))
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
    const user = await requireAuth();
    const { teamId, teamRole } = await requireTeamMembership(user.id);
    requireRole(teamRole, ['owner']);

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
        teamId,
        name: data.name,
        unit: data.unit,
        tags: data.tags ?? null,
        defaultUnitPrice: String(data.defaultUnitPrice),
        currency: data.currency,
        type: data.type ?? null,
      } as NewArticle)
      .returning();

    if (!created) return { error: 'Failed to create article' };
    await logActivity(teamId, user.id, 'article.create');
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
    const user = await requireAuth();
    const { teamId, teamRole } = await requireTeamMembership(user.id);
    requireRole(teamRole, ['owner']);

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
      .where(and(eq(articles.id, id), eq(articles.teamId, teamId)))
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
      .where(and(eq(articles.id, id), eq(articles.teamId, teamId)))
      .returning();

    if (!updated) return { error: 'Failed to update article' };
    await logActivity(teamId, user.id, 'article.update');
    return { data: updated };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to update article' };
  }
}

export async function deleteArticle(id: number): Promise<ActionResult<void>> {
  try {
    const user = await requireAuth();
    const { teamId, teamRole } = await requireTeamMembership(user.id);
    requireRole(teamRole, ['owner']);

    const [existing] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.teamId, teamId)))
      .limit(1);

    if (!existing) return { error: 'Article not found' };

    await db
      .delete(articles)
      .where(and(eq(articles.id, id), eq(articles.teamId, teamId)));
    await logActivity(teamId, user.id, 'article.delete');
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to delete article' };
  }
}

export async function getArticle(id: number): Promise<ActionResult<Article | null>> {
  try {
    const user = await requireAuth();
    const { teamId } = await requireTeamMembership(user.id);

    const [row] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.id, id), eq(articles.teamId, teamId)))
      .limit(1);

    return { data: row ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unauthorized' };
  }
}

export async function listArticles(
  query: ListQuery = {}
): Promise<ActionResult<ListResult<Article>>> {
  try {
    const user = await requireAuth();
    const { teamId } = await requireTeamMembership(user.id);

    const parsed = listQuerySchema.safeParse(query);
    const page = parsed.success ? parsed.data.page : 1;
    const pageSize = parsed.success ? parsed.data.pageSize : 20;
    const search = parsed.success ? parsed.data.search : undefined;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(articles.teamId, teamId)];
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
