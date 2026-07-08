ALTER TABLE "partners" DROP CONSTRAINT "partners_company_eik_unique";--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "eik" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "partners_company_eik_unique" ON "partners" USING btree ("company_id","eik") WHERE "partners"."eik" IS NOT NULL;