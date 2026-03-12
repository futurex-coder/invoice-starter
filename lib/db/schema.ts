import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  date,
  numeric,
  char,
  jsonb,
  uniqueIndex,
  unique,
  index,
  foreignKey,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
// Platform-level identity. No global role — roles are company-scoped.
// Stripe billing lives here (per-user subscription model).
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),

  // Stripe (per-user billing)
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// ─────────────────────────────────────────────
// COMPANIES
// ─────────────────────────────────────────────
// Merged from old `teams` + `teamCompanyProfiles`.
// Each company is a legal entity with a globally unique EIK.
// Soft-deletable — partial unique on EIK allows re-registration.
export const companies = pgTable(
  'companies',
  {
    id: serial('id').primaryKey(),

    // Legal identity
    legalName: varchar('legal_name', { length: 255 }).notNull(),
    eik: varchar('eik', { length: 13 }).notNull(),
    vatNumber: varchar('vat_number', { length: 14 }),
    isVatRegistered: boolean('is_vat_registered').notNull().default(true),

    // Address
    country: char('country', { length: 2 }).notNull().default('BG'),
    city: varchar('city', { length: 100 }).notNull(),
    street: varchar('street', { length: 255 }).notNull(),
    postCode: varchar('post_code', { length: 20 }),

    // Representative
    mol: varchar('mol', { length: 255 }),

    // Bank defaults
    bankName: varchar('bank_name', { length: 255 }),
    iban: varchar('iban', { length: 34 }),
    bicSwift: varchar('bic_swift', { length: 11 }),

    // Invoicing defaults
    defaultCurrency: char('default_currency', { length: 3 })
      .notNull()
      .default('EUR'),
    defaultVatRate: integer('default_vat_rate').notNull().default(20),
    defaultPaymentMethod: varchar('default_payment_method', { length: 20 })
      .notNull()
      .default('bank'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    // Global EIK uniqueness among active (non-deleted) companies
    uniqueIndex('companies_eik_unique')
      .on(t.eik)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_companies_legal_name').on(t.legalName),
  ]
);

// ─────────────────────────────────────────────
// COMPANY MEMBERS
// ─────────────────────────────────────────────
// Join table: user ↔ company with a company-scoped role.
// Roles: 'owner' | 'accountant' (extensible later).
// Partial unique ensures exactly one owner per company.
export const companyMembers = pgTable(
  'company_members',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id),
    role: varchar('role', { length: 50 }).notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (t) => [
    // A user can only have one role per company
    unique('company_members_user_company_unique').on(t.userId, t.companyId),
    // Exactly one owner per company
    uniqueIndex('company_members_one_owner_per_company')
      .on(t.companyId)
      .where(sql`${t.role} = 'owner'`),
    index('idx_company_members_user_id').on(t.userId),
    index('idx_company_members_company_id').on(t.companyId),
  ]
);

// ─────────────────────────────────────────────
// PARTNERS
// ─────────────────────────────────────────────
// Company-scoped client/recipient records.
// Optional soft-link to an existing company via linkedCompanyId.
// All fields are locally overridable (partner data can drift from the
// canonical company record — "soft-link with local overrides").
export const partners = pgTable(
  'partners',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    // Optional link to a registered company in the system
    linkedCompanyId: integer('linked_company_id').references(
      () => companies.id,
      { onDelete: 'set null' }
    ),

    // Locally editable partner details (may diverge from linked company)
    name: varchar('name', { length: 255 }).notNull(),
    eik: varchar('eik', { length: 13 }).notNull(),
    vatNumber: varchar('vat_number', { length: 14 }),
    isIndividual: boolean('is_individual').notNull().default(false),

    country: char('country', { length: 2 }).notNull().default('BG'),
    city: varchar('city', { length: 100 }).notNull(),
    street: varchar('street', { length: 255 }).notNull(),
    postCode: varchar('post_code', { length: 20 }),

    mol: varchar('mol', { length: 255 }),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Same EIK can only appear once per company
    unique('partners_company_eik_unique').on(t.companyId, t.eik),
    index('idx_partners_company_id').on(t.companyId),
    index('idx_partners_company_name').on(t.companyId, t.name),
    index('idx_partners_company_eik').on(t.companyId, t.eik),
    index('idx_partners_linked_company_id')
      .on(t.linkedCompanyId)
      .where(sql`${t.linkedCompanyId} IS NOT NULL`),
  ]
);

// ─────────────────────────────────────────────
// ARTICLES
// ─────────────────────────────────────────────
// Company-scoped product/service catalog.
export const articles = pgTable(
  'articles',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull().default('бр.'),
    tags: text('tags'),

    defaultUnitPrice: numeric('default_unit_price', {
      precision: 15,
      scale: 4,
    })
      .notNull()
      .default('0'),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    type: varchar('type', { length: 20 }).default('service'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_articles_company_id').on(t.companyId),
    index('idx_articles_company_name').on(t.companyId, t.name),
  ]
);

// ─────────────────────────────────────────────
// INVOICE SEQUENCES
// ─────────────────────────────────────────────
// Company-scoped numbering series for invoices.
// Tracks the next available number per (company, series).
// Only used for doc_type='invoice' — CN/DN inherit their parent's number.
// When a manual number override exceeds nextNumber, the trigger
// auto-advances nextNumber to (manual_number + 1).
export const invoiceSequences = pgTable(
  'invoice_sequences',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    series: varchar('series', { length: 20 }).notNull(),
    nextNumber: integer('next_number').notNull().default(1),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('invoice_sequences_company_series_unique').on(
      t.companyId,
      t.series
    ),
    index('idx_invoice_sequences_company_id').on(t.companyId),
  ]
);

// ─────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────
// Company-scoped invoices. The company IS the supplier — no separate
// supplierProfileId needed. Supplier details are snapshotted at creation.
//
// NUMBERING RULES:
// - Invoices (doc_type='invoice'): number is assigned at creation from
//   invoiceSequences, strictly monotonic per (company_id, series).
//   DB trigger enforces new number > MAX(existing) — see migration SQL.
//   Manual override allowed but must still be > MAX(existing).
//   Gaps are fine (deleted drafts); going backward is blocked at DB level.
//
// - Credit/debit notes: inherit their parent invoice's number via
//   referencedInvoiceId. Multiple CN/DN can share the same number.
//   No monotonic constraint applies to CN/DN.
export const invoices = pgTable(
  'invoices',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    // For credit/debit notes: points to the parent invoice.
    // NULL for regular invoices.
    referencedInvoiceId: integer('referenced_invoice_id'),

    partnerId: integer('partner_id').references(() => partners.id, {
      onDelete: 'set null',
    }),

    // 'invoice' | 'credit_note' | 'debit_note'
    docType: varchar('doc_type', { length: 30 }).notNull().default('invoice'),
    // 'draft' | 'finalized' | 'cancelled'
    status: varchar('status', { length: 20 }).notNull().default('draft'),

    series: varchar('series', { length: 20 }).notNull().default('INV'),
    // Always assigned at creation. For CN/DN, copied from parent invoice.
    number: integer('number').notNull(),

    issueDate: date('issue_date').notNull(),
    supplyDate: date('supply_date'),

    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    fxRate: numeric('fx_rate', { precision: 15, scale: 6 })
      .notNull()
      .default('1'),

    // Point-in-time snapshots (immutable once finalized)
    supplierSnapshot: jsonb('supplier_snapshot'),
    recipientSnapshot: jsonb('recipient_snapshot'),
    items: jsonb('items'),
    totals: jsonb('totals'),

    language: char('language', { length: 2 }).notNull().default('bg'),
    paymentMethod: varchar('payment_method', { length: 20 })
      .notNull()
      .default('bank'),
    paymentStatus: varchar('payment_status', { length: 20 })
      .notNull()
      .default('unpaid'),
    dueDate: date('due_date'),
    vatMode: varchar('vat_mode', { length: 20 }).notNull().default('standard'),
    noVatReason: text('no_vat_reason'),
    amountInWords: text('amount_in_words'),
    customerNote: text('customer_note'),
    internalComment: text('internal_comment'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.referencedInvoiceId],
      foreignColumns: [t.id],
    }).onDelete('set null'),
    // Unique numbering only for invoices (not CN/DN — they share parent's number)
    uniqueIndex('idx_invoices_company_series_number_unique')
      .on(t.companyId, t.series, t.number)
      .where(sql`${t.docType} = 'invoice'`),
    index('idx_invoices_company_id').on(t.companyId),
    index('idx_invoices_company_status').on(t.companyId, t.status),
    index('idx_invoices_company_doc_type').on(t.companyId, t.docType),
    index('idx_invoices_company_issue_date').on(
      t.companyId,
      t.issueDate.desc()
    ),
    index('idx_invoices_company_payment_status').on(
      t.companyId,
      t.paymentStatus
    ),
    index('idx_invoices_created_by_user_id')
      .on(t.createdByUserId)
      .where(sql`${t.createdByUserId} IS NOT NULL`),
    index('idx_invoices_partner_id')
      .on(t.partnerId)
      .where(sql`${t.partnerId} IS NOT NULL`),
    // For looking up all CN/DN for a given parent invoice
    index('idx_invoices_referenced_invoice_id')
      .on(t.referencedInvoiceId)
      .where(sql`${t.referencedInvoiceId} IS NOT NULL`),
  ]
);

// ─────────────────────────────────────────────
// INVOICE LINES
// ─────────────────────────────────────────────
export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: serial('id').primaryKey(),
    invoiceId: integer('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    articleId: integer('article_id').references(() => articles.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order').notNull().default(0),

    description: varchar('description', { length: 500 }).notNull(),
    quantity: numeric('quantity', { precision: 15, scale: 4 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull().default('бр.'),
    unitPrice: numeric('unit_price', { precision: 15, scale: 4 }).notNull(),
    vatRate: integer('vat_rate').notNull().default(20),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    netAmount: numeric('net_amount', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    vatAmount: numeric('vat_amount', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    grossAmount: numeric('gross_amount', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_invoice_lines_invoice_id').on(t.invoiceId),
    index('idx_invoice_lines_article_id')
      .on(t.articleId)
      .where(sql`${t.articleId} IS NOT NULL`),
  ]
);

// ─────────────────────────────────────────────
// ACTIVITY LOGS
// ─────────────────────────────────────────────
// Company-scoped audit trail. Every action records both the user
// AND the company context they were acting in.
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id),
    userId: integer('user_id').references(() => users.id),
    action: text('action').notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    ipAddress: varchar('ip_address', { length: 45 }),
  },
  (t) => [
    index('idx_activity_logs_company_id').on(t.companyId),
    index('idx_activity_logs_user_id')
      .on(t.userId)
      .where(sql`${t.userId} IS NOT NULL`),
    index('idx_activity_logs_timestamp').on(t.timestamp.desc()),
  ]
);

// ─────────────────────────────────────────────
// INVITATIONS
// ─────────────────────────────────────────────
// Company-scoped invitations. Accountants can invite other accountants;
// only owners can invite with role 'owner' (enforced in app logic).
export const invitations = pgTable(
  'invitations',
  {
    id: serial('id').primaryKey(),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id),
    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    invitedBy: integer('invited_by')
      .notNull()
      .references(() => users.id),
    invitedAt: timestamp('invited_at').notNull().defaultNow(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
  },
  (t) => [
    index('idx_invitations_company_id').on(t.companyId),
    index('idx_invitations_email').on(t.email),
  ]
);

// ─────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  companyMemberships: many(companyMembers),
  invitationsSent: many(invitations),
  invoicesCreated: many(invoices),
  activityLogs: many(activityLogs),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  members: many(companyMembers),
  partners: many(partners),
  articles: many(articles),
  invoiceSequences: many(invoiceSequences),
  invoices: many(invoices),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
}));

export const companyMembersRelations = relations(
  companyMembers,
  ({ one }) => ({
    user: one(users, {
      fields: [companyMembers.userId],
      references: [users.id],
    }),
    company: one(companies, {
      fields: [companyMembers.companyId],
      references: [companies.id],
    }),
  })
);

export const partnersRelations = relations(partners, ({ one, many }) => ({
  company: one(companies, {
    fields: [partners.companyId],
    references: [companies.id],
  }),
  linkedCompany: one(companies, {
    fields: [partners.linkedCompanyId],
    references: [companies.id],
    relationName: 'linkedPartners',
  }),
  invoices: many(invoices),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  company: one(companies, {
    fields: [articles.companyId],
    references: [companies.id],
  }),
  invoiceLines: many(invoiceLines),
}));

export const invoiceSequencesRelations = relations(
  invoiceSequences,
  ({ one }) => ({
    company: one(companies, {
      fields: [invoiceSequences.companyId],
      references: [companies.id],
    }),
  })
);

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
  createdByUser: one(users, {
    fields: [invoices.createdByUserId],
    references: [users.id],
    relationName: 'invoicesCreated',
  }),
  referencedInvoice: one(invoices, {
    fields: [invoices.referencedInvoiceId],
    references: [invoices.id],
    relationName: 'invoiceReferences',
  }),
  creditNotes: many(invoices, {
    relationName: 'invoiceReferences',
  }),
  partner: one(partners, {
    fields: [invoices.partnerId],
    references: [partners.id],
  }),
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id],
  }),
  article: one(articles, {
    fields: [invoiceLines.articleId],
    references: [articles.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  company: one(companies, {
    fields: [activityLogs.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  company: one(companies, {
    fields: [invitations.companyId],
    references: [companies.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────
// INFERRED TYPES
// ─────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type CompanyMember = typeof companyMembers.$inferSelect;
export type NewCompanyMember = typeof companyMembers.$inferInsert;
export type Partner = typeof partners.$inferSelect;
export type NewPartner = typeof partners.$inferInsert;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type InvoiceSequence = typeof invoiceSequences.$inferSelect;
export type NewInvoiceSequence = typeof invoiceSequences.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;

// Composite types for common query shapes
export type CompanyWithMembers = Company & {
  members: (CompanyMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
  invitations: Invitation[];
};

export type UserCompanyMembership = {
  company: Company;
  role: CompanyMember['role'];
};

// ─────────────────────────────────────────────
// ENUMS (app-level, not pg enums — easier to extend)
// ─────────────────────────────────────────────

export enum CompanyRole {
  OWNER = 'owner',
  ACCOUNTANT = 'accountant',
}

export enum DocType {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  FINALIZED = 'finalized',
  CANCELLED = 'cancelled',
}

export enum ActivityType {
  // Auth
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',

  // Company management
  CREATE_COMPANY = 'CREATE_COMPANY',
  UPDATE_COMPANY = 'UPDATE_COMPANY',
  DELETE_COMPANY = 'DELETE_COMPANY',
  RESTORE_COMPANY = 'RESTORE_COMPANY',
  TRANSFER_OWNERSHIP = 'TRANSFER_OWNERSHIP',

  // Member management
  INVITE_MEMBER = 'INVITE_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  REMOVE_MEMBER = 'REMOVE_MEMBER',

  // Invoicing
  CREATE_INVOICE = 'CREATE_INVOICE',
  UPDATE_INVOICE = 'UPDATE_INVOICE',
  FINALIZE_INVOICE = 'FINALIZE_INVOICE',
  CANCEL_INVOICE = 'CANCEL_INVOICE',
  CREATE_CREDIT_NOTE = 'CREATE_CREDIT_NOTE',
  CREATE_DEBIT_NOTE = 'CREATE_DEBIT_NOTE',
}
