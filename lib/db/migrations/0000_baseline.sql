CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"unit" varchar(20) DEFAULT 'бр.' NOT NULL,
	"tags" text,
	"default_unit_price" numeric(15, 4) DEFAULT '0' NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"type" varchar(20) DEFAULT 'service',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"legal_name" varchar(255) NOT NULL,
	"eik" varchar(13) NOT NULL,
	"vat_number" varchar(14),
	"is_vat_registered" boolean DEFAULT true NOT NULL,
	"country" char(2) DEFAULT 'BG' NOT NULL,
	"city" varchar(100) NOT NULL,
	"street" varchar(255) NOT NULL,
	"post_code" varchar(20),
	"mol" varchar(255),
	"bank_name" varchar(255),
	"iban" varchar(34),
	"bic_swift" varchar(11),
	"default_currency" char(3) DEFAULT 'EUR' NOT NULL,
	"default_vat_rate" integer DEFAULT 20 NOT NULL,
	"default_payment_method" varchar(20) DEFAULT 'bank' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"role" varchar(50) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "company_members_user_company_unique" UNIQUE("user_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"invited_by" integer NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"article_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(15, 4) NOT NULL,
	"unit" varchar(20) DEFAULT 'бр.' NOT NULL,
	"unit_price" numeric(15, 4) NOT NULL,
	"vat_rate" integer DEFAULT 20 NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"net_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"series" varchar(20) NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_sequences_company_series_unique" UNIQUE("company_id","series")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"created_by_user_id" integer,
	"referenced_invoice_id" integer,
	"partner_id" integer,
	"doc_type" varchar(30) DEFAULT 'invoice' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"series" varchar(20) DEFAULT 'INV' NOT NULL,
	"number" integer NOT NULL,
	"issue_date" date NOT NULL,
	"supply_date" date,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"fx_rate" numeric(15, 6) DEFAULT '1' NOT NULL,
	"supplier_snapshot" jsonb,
	"recipient_snapshot" jsonb,
	"items" jsonb,
	"totals" jsonb,
	"language" char(2) DEFAULT 'bg' NOT NULL,
	"payment_method" varchar(20) DEFAULT 'bank' NOT NULL,
	"payment_status" varchar(20) DEFAULT 'unpaid' NOT NULL,
	"due_date" date,
	"vat_mode" varchar(20) DEFAULT 'standard' NOT NULL,
	"no_vat_reason" text,
	"amount_in_words" text,
	"customer_note" text,
	"internal_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"linked_company_id" integer,
	"name" varchar(255) NOT NULL,
	"eik" varchar(13) NOT NULL,
	"vat_number" varchar(14),
	"is_individual" boolean DEFAULT false NOT NULL,
	"country" char(2) DEFAULT 'BG' NOT NULL,
	"city" varchar(100) NOT NULL,
	"street" varchar(255) NOT NULL,
	"post_code" varchar(20),
	"mol" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partners_company_eik_unique" UNIQUE("company_id","eik")
);
--> statement-breakpoint
CREATE TABLE "received_invoice_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"received_invoice_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" numeric(15, 4) NOT NULL,
	"unit" varchar(20) DEFAULT 'бр.' NOT NULL,
	"unit_price" numeric(15, 4) NOT NULL,
	"vat_rate" integer DEFAULT 20 NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "received_invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"uploaded_by_user_id" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"file_bucket" varchar(64) NOT NULL,
	"file_object_key" text NOT NULL,
	"file_mime_type" varchar(64) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"file_original_name" varchar(255) NOT NULL,
	"file_checksum_sha256" varchar(64),
	"raw_extraction" jsonb NOT NULL,
	"extraction_confidence" varchar(10),
	"extraction_model_id" varchar(64),
	"extracted_at" timestamp DEFAULT now() NOT NULL,
	"partner_id" integer,
	"supplier_snapshot" jsonb,
	"invoice_number" varchar(100),
	"issue_date" date,
	"supply_date" date,
	"due_date" date,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"fx_rate" numeric(15, 6) DEFAULT '1' NOT NULL,
	"net_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"gross_amount" numeric(15, 4) DEFAULT '0' NOT NULL,
	"payment_method" varchar(20) DEFAULT 'bank' NOT NULL,
	"payment_status" varchar(20) DEFAULT 'unpaid' NOT NULL,
	"accounting_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"notes" text,
	"archived_at" timestamp,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100),
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_product_id" text,
	"plan_name" varchar(50),
	"subscription_status" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_referenced_invoice_id_invoices_id_fk" FOREIGN KEY ("referenced_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_linked_company_id_companies_id_fk" FOREIGN KEY ("linked_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_invoice_lines" ADD CONSTRAINT "received_invoice_lines_received_invoice_id_received_invoices_id_fk" FOREIGN KEY ("received_invoice_id") REFERENCES "public"."received_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD CONSTRAINT "received_invoices_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_logs_company_id" ON "activity_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_activity_logs_user_id" ON "activity_logs" USING btree ("user_id") WHERE "activity_logs"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_activity_logs_timestamp" ON "activity_logs" USING btree ("timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_articles_company_id" ON "articles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_articles_company_name" ON "articles" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "companies_eik_unique" ON "companies" USING btree ("eik") WHERE "companies"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_companies_legal_name" ON "companies" USING btree ("legal_name");--> statement-breakpoint
CREATE UNIQUE INDEX "company_members_one_owner_per_company" ON "company_members" USING btree ("company_id") WHERE "company_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "idx_company_members_user_id" ON "company_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_company_members_company_id" ON "company_members" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_company_id" ON "invitations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_invitations_email" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_invoice_lines_invoice_id" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_lines_article_id" ON "invoice_lines" USING btree ("article_id") WHERE "invoice_lines"."article_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_invoice_sequences_company_id" ON "invoice_sequences" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_company_series_number_unique" ON "invoices" USING btree ("company_id","series","number") WHERE "invoices"."doc_type" = 'invoice';--> statement-breakpoint
CREATE INDEX "idx_invoices_company_id" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_company_status" ON "invoices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_invoices_company_doc_type" ON "invoices" USING btree ("company_id","doc_type");--> statement-breakpoint
CREATE INDEX "idx_invoices_company_issue_date" ON "invoices" USING btree ("company_id","issue_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_invoices_company_payment_status" ON "invoices" USING btree ("company_id","payment_status");--> statement-breakpoint
CREATE INDEX "idx_invoices_created_by_user_id" ON "invoices" USING btree ("created_by_user_id") WHERE "invoices"."created_by_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_invoices_partner_id" ON "invoices" USING btree ("partner_id") WHERE "invoices"."partner_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_invoices_referenced_invoice_id" ON "invoices" USING btree ("referenced_invoice_id") WHERE "invoices"."referenced_invoice_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_partners_company_id" ON "partners" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_partners_company_name" ON "partners" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "idx_partners_company_eik" ON "partners" USING btree ("company_id","eik");--> statement-breakpoint
CREATE INDEX "idx_partners_linked_company_id" ON "partners" USING btree ("linked_company_id") WHERE "partners"."linked_company_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_received_inv_lines_inv" ON "received_invoice_lines" USING btree ("received_invoice_id");--> statement-breakpoint
CREATE INDEX "idx_received_inv_company_status" ON "received_invoices" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_received_inv_company_acc" ON "received_invoices" USING btree ("company_id","accounting_status");--> statement-breakpoint
CREATE INDEX "idx_received_inv_company_pay" ON "received_invoices" USING btree ("company_id","payment_status");--> statement-breakpoint
CREATE INDEX "idx_received_inv_company_issue" ON "received_invoices" USING btree ("company_id","issue_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_received_inv_dedup" ON "received_invoices" USING btree ("company_id","partner_id","invoice_number","issue_date");--> statement-breakpoint
CREATE INDEX "idx_received_inv_checksum" ON "received_invoices" USING btree ("company_id","file_checksum_sha256");