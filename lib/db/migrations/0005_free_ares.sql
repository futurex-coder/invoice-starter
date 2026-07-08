ALTER TABLE "received_invoices" ALTER COLUMN "status" SET DEFAULT 'analyzing';--> statement-breakpoint
ALTER TABLE "received_invoices" ALTER COLUMN "raw_extraction" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "received_invoices" ALTER COLUMN "extracted_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "received_invoices" ALTER COLUMN "extracted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD COLUMN "analysis_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "received_invoices" ADD COLUMN "analysis_error" text;