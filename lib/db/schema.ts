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

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

/** One per team — Supplier (Доставчик) / company profile + bank defaults */
export const teamCompanyProfiles = pgTable(
  'team_company_profiles',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),

    legalName: varchar('legal_name', { length: 255 }).notNull(),
    eik: varchar('eik', { length: 13 }).notNull(),
    vatNumber: varchar('vat_number', { length: 14 }),
    isVatRegistered: boolean('is_vat_registered').notNull().default(true),

    country: char('country', { length: 2 }).notNull().default('BG'),
    city: varchar('city', { length: 100 }).notNull(),
    street: varchar('street', { length: 255 }).notNull(),
    postCode: varchar('post_code', { length: 20 }),

    mol: varchar('mol', { length: 255 }),

    bankName: varchar('bank_name', { length: 255 }),
    iban: varchar('iban', { length: 34 }),
    bicSwift: varchar('bic_swift', { length: 11 }),

    defaultCurrency: char('default_currency', { length: 3 }).notNull().default('EUR'),
    defaultVatRate: integer('default_vat_rate').notNull().default(20),
    defaultPaymentMethod: varchar('default_payment_method', { length: 20 })
      .notNull()
      .default('bank'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('team_company_profiles_team_id_unique').on(t.teamId),
    index('idx_team_company_profiles_team_id').on(t.teamId),
  ]
);

/** Clients/recipients (Получатели) — team-scoped; recipient per invoice is snapshot */
export const partners = pgTable(
  'partners',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),

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
    unique('partners_team_id_eik_unique').on(t.teamId, t.eik),
    index('idx_partners_team_id').on(t.teamId),
    index('idx_partners_team_name').on(t.teamId, t.name),
    index('idx_partners_team_eik').on(t.teamId, t.eik),
  ]
);

/** Articles/items (Артикули) — team-scoped catalog */
export const articles = pgTable(
  'articles',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull().default('бр.'),
    tags: text('tags'), // comma-separated or JSON array string; optional

    defaultUnitPrice: numeric('default_unit_price', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    type: varchar('type', { length: 20 }).default('service'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_articles_team_id').on(t.teamId),
    index('idx_articles_team_name').on(t.teamId, t.name),
  ]
);

export const invoiceSequences = pgTable(
  'invoice_sequences',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    series: varchar('series', { length: 20 }).notNull(),
    nextNumber: integer('next_number').notNull().default(1),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('invoice_sequences_team_series_unique').on(t.teamId, t.series),
    index('idx_invoice_sequences_team_id').on(t.teamId),
  ]
);

export const invoices = pgTable(
  'invoices',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    referencedInvoiceId: integer('referenced_invoice_id'),

    partnerId: integer('partner_id').references(() => partners.id, {
      onDelete: 'set null',
    }),
    supplierProfileId: integer('supplier_profile_id').references(
      () => teamCompanyProfiles.id,
      { onDelete: 'set null' }
    ),

    docType: varchar('doc_type', { length: 30 }).notNull().default('invoice'),
    status: varchar('status', { length: 20 }).notNull().default('draft'),

    series: varchar('series', { length: 20 }).notNull().default('INV'),
    number: integer('number'),

    issueDate: date('issue_date').notNull(),
    supplyDate: date('supply_date'),

    currency: char('currency', { length: 3 }).notNull().default('EUR'),
    fxRate: numeric('fx_rate', { precision: 15, scale: 6 }).notNull().default('1'),

    supplierSnapshot: jsonb('supplier_snapshot'),
    recipientSnapshot: jsonb('recipient_snapshot'),
    items: jsonb('items'),
    totals: jsonb('totals'),

    language: char('language', { length: 2 }).notNull().default('bg'),
    paymentMethod: varchar('payment_method', { length: 20 }).notNull().default('bank'),
    paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('unpaid'),
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
    uniqueIndex('idx_invoices_team_series_number_unique')
      .on(t.teamId, t.series, t.number)
      .where(sql`${t.number} IS NOT NULL`),
    index('idx_invoices_team_id').on(t.teamId),
    index('idx_invoices_team_status').on(t.teamId, t.status),
    index('idx_invoices_team_issue_date').on(t.teamId, t.issueDate.desc()),
    index('idx_invoices_team_payment_status').on(t.teamId, t.paymentStatus),
    index('idx_invoices_created_by_user_id')
      .on(t.createdByUserId)
      .where(sql`${t.createdByUserId} IS NOT NULL`),
    index('idx_invoices_partner_id')
      .on(t.partnerId)
      .where(sql`${t.partnerId} IS NOT NULL`),
  ]
);

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

export const teamsRelations = relations(teams, ({ one, many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  teamCompanyProfile: one(teamCompanyProfiles),
  partners: many(partners),
  articles: many(articles),
  invoiceSequences: many(invoiceSequences),
  invoices: many(invoices),
  invoiceLines: many(invoiceLines),
}));

export const teamCompanyProfilesRelations = relations(
  teamCompanyProfiles,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamCompanyProfiles.teamId],
      references: [teams.id],
    }),
  })
);

export const partnersRelations = relations(partners, ({ one, many }) => ({
  team: one(teams, {
    fields: [partners.teamId],
    references: [teams.id],
  }),
  invoices: many(invoices),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  team: one(teams, {
    fields: [articles.teamId],
    references: [teams.id],
  }),
  invoiceLines: many(invoiceLines),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
  invoicesCreated: many(invoices),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const invoiceSequencesRelations = relations(
  invoiceSequences,
  ({ one }) => ({
    team: one(teams, {
      fields: [invoiceSequences.teamId],
      references: [teams.id],
    }),
  })
);

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  team: one(teams, {
    fields: [invoices.teamId],
    references: [teams.id],
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
  supplierProfile: one(teamCompanyProfiles, {
    fields: [invoices.supplierProfileId],
    references: [teamCompanyProfiles.id],
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type TeamCompanyProfile = typeof teamCompanyProfiles.$inferSelect;
export type NewTeamCompanyProfile = typeof teamCompanyProfiles.$inferInsert;
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
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
  invitations: Invitation[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  CREATE_INVOICE = 'CREATE_INVOICE',
  UPDATE_INVOICE = 'UPDATE_INVOICE',
  FINALIZE_INVOICE = 'FINALIZE_INVOICE',
  CANCEL_INVOICE = 'CANCEL_INVOICE',
  CREATE_CREDIT_NOTE = 'CREATE_CREDIT_NOTE',
  CREATE_DEBIT_NOTE = 'CREATE_DEBIT_NOTE',
}
