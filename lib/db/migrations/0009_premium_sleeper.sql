DROP INDEX "je_source_invoice_unique";--> statement-breakpoint
DROP INDEX "je_source_received_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "je_source_invoice_unique" ON "journal_entries" USING btree ("source_invoice_id") WHERE "journal_entries"."source_invoice_id" IS NOT NULL AND "journal_entries"."status" <> 'reversed';--> statement-breakpoint
CREATE UNIQUE INDEX "je_source_received_unique" ON "journal_entries" USING btree ("source_received_invoice_id") WHERE "journal_entries"."source_received_invoice_id" IS NOT NULL AND "journal_entries"."status" <> 'reversed';