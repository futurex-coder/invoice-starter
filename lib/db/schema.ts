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
    index('idx_invoices_created_by_user_id')
      .on(t.createdByUserId)
      .where(sql`${t.createdByUserId} IS NOT NULL`),
  ]
);

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  invoiceSequences: many(invoiceSequences),
  invoices: many(invoices),
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
export type InvoiceSequence = typeof invoiceSequences.$inferSelect;
export type NewInvoiceSequence = typeof invoiceSequences.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
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
