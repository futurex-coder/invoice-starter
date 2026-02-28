CREATE TABLE "invoice_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"series" varchar(20) NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_sequences_team_series_unique" UNIQUE("team_id","series")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"created_by_user_id" integer,
	"referenced_invoice_id" integer,
	"doc_type" varchar(30) DEFAULT 'invoice' NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"series" varchar(20) DEFAULT 'INV' NOT NULL,
	"number" integer,
	"issue_date" date NOT NULL,
	"supply_date" date,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"fx_rate" numeric(15, 6) DEFAULT '1' NOT NULL,
	"supplier_snapshot" jsonb,
	"recipient_snapshot" jsonb,
	"items" jsonb,
	"totals" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_sequences" ADD CONSTRAINT "invoice_sequences_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_referenced_invoice_id_invoices_id_fk" FOREIGN KEY ("referenced_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_invoice_sequences_team_id" ON "invoice_sequences" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_invoices_team_series_number_unique" ON "invoices" USING btree ("team_id","series","number") WHERE "invoices"."number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_invoices_team_id" ON "invoices" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_team_status" ON "invoices" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "idx_invoices_team_issue_date" ON "invoices" USING btree ("team_id","issue_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_invoices_created_by_user_id" ON "invoices" USING btree ("created_by_user_id") WHERE "invoices"."created_by_user_id" IS NOT NULL;