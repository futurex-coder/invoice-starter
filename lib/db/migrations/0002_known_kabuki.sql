CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
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
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
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
	CONSTRAINT "partners_team_id_eik_unique" UNIQUE("team_id","eik")
);
--> statement-breakpoint
CREATE TABLE "team_company_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
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
	CONSTRAINT "team_company_profiles_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "language" char(2) DEFAULT 'bg' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_method" varchar(20) DEFAULT 'bank' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_status" varchar(20) DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "vat_mode" varchar(20) DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "no_vat_reason" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "amount_in_words" text;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_company_profiles" ADD CONSTRAINT "team_company_profiles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_articles_team_id" ON "articles" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_articles_team_name" ON "articles" USING btree ("team_id","name");--> statement-breakpoint
CREATE INDEX "idx_partners_team_id" ON "partners" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_partners_team_name" ON "partners" USING btree ("team_id","name");--> statement-breakpoint
CREATE INDEX "idx_partners_team_eik" ON "partners" USING btree ("team_id","eik");--> statement-breakpoint
CREATE INDEX "idx_team_company_profiles_team_id" ON "team_company_profiles" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "idx_invoices_team_payment_status" ON "invoices" USING btree ("team_id","payment_status");