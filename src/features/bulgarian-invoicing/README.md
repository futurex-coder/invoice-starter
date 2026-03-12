# Bulgarian Invoicing Domain Module

Pure TypeScript business logic for Bulgarian invoicing, independent of any database or framework.

## Module Structure

```
src/features/bulgarian-invoicing/
  types.ts           Domain types (DocType, PartySnapshot, LineItem, etc.)
  rules.ts           Business rules (VAT rates, UIC validation, date limits)
  calculator.ts      Line item and totals computation (pure functions)
  validator.ts       Full document validation with structured errors
  formatter.ts       Display formatting (numbers, dates, party info)
  index.ts           Barrel re-export
  *.test.ts          Tests (vitest)
```

## Usage

```ts
import {
  calculateInvoice,
  validateInvoice,
  formatDocumentTitle,
} from '@/src/features/bulgarian-invoicing';
```

### Calculate

```ts
const result = calculateInvoice([
  { description: 'Consulting', quantity: 10, unit: 'hours', unitPrice: 80, vatRate: 20 },
  { description: 'Travel', quantity: 1, unit: 'trip', unitPrice: 200, vatRate: 20, discountPercent: 10 },
]);
// result.items — computed LineItem[]
// result.totals — { netAmount, vatAmount, grossAmount, vatBreakdown }
```

### Validate

```ts
const vr = validateInvoice(invoiceDoc);
if (!vr.valid) {
  console.log(vr.errors);
  // [{ code: 'INVALID_UIC', field: 'supplier.uic', message: '...' }]
}
```

### Format

```ts
formatInvoiceNumber(42);        // '0000000042'
formatMoney(1234.5);            // '1 234.50'
formatDateBg('2026-02-28');     // '28.02.2026'
formatDocTypeLabel('invoice');  // 'Фактура'
```

## Validation Error Codes

| Code | Fields | Description |
|------|--------|-------------|
| `REQUIRED` | any | Missing required field |
| `INVALID_DOC_TYPE` | `docType` | Unknown document type |
| `INVALID_STATUS` | `status` | Unknown status |
| `INVALID_NUMBER` | `number` | Not a valid invoice number (1..9999999999) |
| `INVALID_UIC` | `*.uic` | UIC not 9-10 digits |
| `INVALID_VAT_NUMBER` | `*.vatNumber` | Doesn't match BG + 9-10 digits |
| `INVALID_CURRENCY` | `currency` | Not a 3-letter ISO code |
| `INVALID_FX_RATE` | `fxRate` | Not a positive number |
| `INVALID_DATE` | `issueDate`, `supplyDate` | Not YYYY-MM-DD |
| `ISSUE_DATE_TOO_LATE` | `issueDate` | More than 5 days after supply |
| `INVALID_QUANTITY` | `items[n].quantity` | Not positive |
| `INVALID_UNIT_PRICE` | `items[n].unitPrice` | Negative |
| `INVALID_VAT_RATE` | `items[n].vatRate` | Not 20, 9, or 0 |
| `INVALID_DISCOUNT` | `items[n].discountPercent` | Outside 0-100 |
| `REFERENCE_REQUIRED` | `referencedInvoiceNumber` | Credit/debit note missing reference |
| `TOTALS_MISMATCH` | `totals.*` | Totals don't match line item sums |

## Running Tests

```bash
npx vitest run src/features/bulgarian-invoicing/
```

Or in watch mode:

```bash
npx vitest src/features/bulgarian-invoicing/
```

## DB Migration Checklist

The invoicing tables (`invoices`, `invoice_sequences`) are defined in
`lib/db/schema.ts` and managed by Drizzle migrations in `lib/db/migrations/`.

### 1. Set the connection string

`POSTGRES_URL` in `.env` must point to your Supabase database:

```
POSTGRES_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Find it in: Supabase Dashboard > Project Settings > Database > Connection string (URI, pooling mode).

### 2. Apply migrations

```bash
pnpm db:migrate
```

### 3. Verify tables exist

**Option A** -- Supabase SQL Editor (Dashboard > SQL Editor):

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('invoices', 'invoice_sequences');
```

Both rows must appear.

**Option B** -- Drizzle Studio:

```bash
pnpm db:studio
```

Open the URL it prints and confirm `invoices` and `invoice_sequences` are listed.

**Option C** -- Quick query from the app (Node):

```bash
npx tsx -e "
  import { db } from './lib/db/drizzle';
  import { invoices } from './lib/db/schema';
  const rows = await db.select().from(invoices).limit(0);
  console.log('invoices table OK');
  process.exit(0);
"
```

If the table doesn't exist you'll see `relation "invoices" does not exist`.
