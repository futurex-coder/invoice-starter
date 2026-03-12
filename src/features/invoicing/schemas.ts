import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const eikSchema = z.string().min(9, 'EIK must be 9 or 10 digits').max(10).regex(/^\d{9,10}$/, 'EIK must be 9 or 10 digits');
const vatNumberSchema = z.string().regex(/^BG\d{9,10}$/).optional().nullable();
const countrySchema = z.string().length(2).default('BG');
const currencySchema = z.string().length(3).default('EUR');

// ---------------------------------------------------------------------------
// Company Profile (Supplier)
// ---------------------------------------------------------------------------

export const upsertCompanyProfileSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required').max(255),
  eik: eikSchema,
  vatNumber: vatNumberSchema,
  isVatRegistered: z.boolean().default(true),

  country: countrySchema,
  city: z.string().min(1, 'City is required').max(100),
  street: z.string().min(1, 'Street is required').max(255),
  postCode: z.string().max(20).optional().nullable(),

  mol: z.string().max(255).optional().nullable(),

  bankName: z.string().max(255).optional().nullable(),
  iban: z.string().max(34).optional().nullable(),
  bicSwift: z.string().max(11).optional().nullable(),

  defaultCurrency: currencySchema,
  defaultVatRate: z.number().int().min(0).max(100).default(20),
  defaultPaymentMethod: z.enum(['bank', 'cash', 'barter']).default('bank'),
});

export type UpsertCompanyProfileInput = z.infer<typeof upsertCompanyProfileSchema>;

// ---------------------------------------------------------------------------
// Partners (Clients)
// ---------------------------------------------------------------------------

export const createPartnerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  eik: eikSchema,
  vatNumber: vatNumberSchema,
  isIndividual: z.boolean().default(false),

  country: countrySchema,
  city: z.string().min(1, 'City is required').max(100),
  street: z.string().min(1, 'Street is required').max(255),
  postCode: z.string().max(20).optional().nullable(),

  mol: z.string().max(255).optional().nullable(),

  linkedCompanyId: z.number().int().nullable().optional(),
});

export const updatePartnerSchema = createPartnerSchema.partial();

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>;
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>;

// ---------------------------------------------------------------------------
// Articles (Items)
// ---------------------------------------------------------------------------

export const createArticleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  unit: z.string().min(1, 'Unit is required').max(20).default('бр.'),
  tags: z.string().max(500).optional().nullable(),

  defaultUnitPrice: z.number().min(0).default(0),
  currency: currencySchema,
  type: z.enum(['service', 'goods']).optional().nullable(),
});

export const updateArticleSchema = createArticleSchema.partial();

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;

// ---------------------------------------------------------------------------
// List query + pagination
// ---------------------------------------------------------------------------

export const listQuerySchema = z.object({
  search: z.string().max(255).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
