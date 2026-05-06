# Received invoices

Company-scoped feature for invoices RECEIVED from suppliers (i.e. expenses
the company needs to record).

## Lifecycle

```
upload → AI extracts → draft → review → confirmed | discarded
                                  └── never confirmed: not counted in totals
```

- **draft** — uploaded + AI-extracted, awaiting human review.
- **confirmed** — reviewer signed off; counts toward dashboard aggregations.
- **discarded** — soft-rejected; never counts.

`archived_at` lets confirmed rows be hidden from default views without
deleting; aggregation rule is `status = 'confirmed' AND archived_at IS NULL`.

## Storage

- Files live in the **Supabase Storage** bucket `received-invoices` (private).
- Object key: `{companyId}/{yyyy}/{mm}/{uuid}.{ext}`.
- Access via server-issued signed URLs (10 min TTL) — no direct client access.
- 10 MB hard cap. Image files (JPG/PNG/WebP) are compressed client-side
  (Canvas → WebP, max 2400px long edge, q=0.75) before upload. PDFs uploaded as-is.

## Manual setup steps

1. In Supabase dashboard → SQL Editor, run the migration named
   `create_received_invoices` (DDL). Already applied in the dev project via the
   Supabase MCP.
2. Confirm the bucket exists: Project → Storage → `received-invoices` (private,
   10 MB limit, allowed mime types: pdf/jpeg/png/webp).
3. Set environment variables:
   - `SUPABASE_URL` — Project Settings → API → Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → service_role key.
     SERVER ONLY. Never expose to the client.
   - `CLAUDE_API_KEY` — used by the extraction route.

## Files

| Path | Purpose |
|---|---|
| `lib/db/schema.ts` | `received_invoices` + `received_invoice_lines` tables |
| `lib/ai/extract-invoice.ts` | Pure AI extraction helper (used by both routes) |
| `lib/supabase/storage.ts` | Server-only Supabase Storage client |
| `src/features/received-invoices/types.ts` | Domain types |
| `src/features/received-invoices/schema.ts` | Zod validators |
| `src/features/received-invoices/calculator.ts` | Line/total math |
| `src/features/received-invoices/actions.ts` | Server actions |
| `app/api/received-invoices/upload/route.ts` | Multipart upload + extract + draft |
| `app/api/received-invoices/[id]/file/route.ts` | Signed URL for preview |
| `app/(dashboard)/c/[companyId]/received-invoices/page.tsx` | List + filters |
| `app/(dashboard)/c/[companyId]/received-invoices/upload/page.tsx` | Multi-file dropzone |
| `app/(dashboard)/c/[companyId]/received-invoices/review/[id]/page.tsx` | Side-by-side review |
| `app/(dashboard)/c/[companyId]/received-invoices/[id]/page.tsx` | Detail view |
| `components/received-invoices/*` | UI components |

## Aggregation

Confirmed received invoices are the company's expenses. To compute totals
in BGN, multiply `gross_amount` by `fx_rate` for non-BGN rows.

```sql
SELECT
  SUM(gross_amount * fx_rate) AS total_expenses_bgn
FROM received_invoices
WHERE company_id = $1
  AND status = 'confirmed'
  AND archived_at IS NULL;
```
