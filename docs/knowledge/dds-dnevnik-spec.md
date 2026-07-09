# ДДС дневник (VAT sales/purchase ledger) — implementation spec

**Status:** scoped, not built. This is the headline §2 item in `docs/PLATFORM_GAPS.md`
("the highest-value accountant feature"). The VAT page (`/c/[id]/vat`) only **nets**
per month (`getVatSummary`); an accountant cannot *file* from a net number — they need
the per-document дневник продажби (sales) and дневник покупки (purchases) in the НАП
column format. This doc captures everything needed to build it correctly.

## What НАП expects
Two monthly registers (ППЗДДС, Приложение №10 продажби / №11 покупки), one **row per
document**, plus a справка-декларация (Приложение №13) that sums the ledger cells. Filing
today is a fixed-width/delimited export importable by Делта/Ажур and the НАП portal.

Document-type codes (вид на документа), both ledgers:
- `01` фактура (invoice)
- `02` дебитно известие (debit_note)
- `03` кредитно известие (credit_note) — entered with **negative** base/VAT
- (`proforma` is NOT a ДДС document → excluded entirely)

## Data sources (already in the DB — no new columns needed for the core)
Outgoing (дневник продажби) — table `invoices`:
- Amounts live in the **`totals` JSONB** column: `totals->>'netAmount'` (данъчна основа),
  `totals->>'vatAmount'` (начислен ДДС), `totals->>'grossAmount'`. NOT the flat
  `net/vat/gross` columns — those are on `invoice_lines` (per line). **Confirm the exact
  `totals` shape** before building (see `bulgarian-invoicing/parsers.ts`
  `parseInvoiceTotalsStrict`).
- `docType`, `number` (format via `formatInvoiceNumber` → 10 digits), `issueDate`.
- Counterparty from the **frozen party snapshot** (name, ЕИК, ДДС №) — see how the print
  model reads it in `formatter.ts` (`parsePartySnapshotStrict`), not the live `partners` row.
- `noVatReason` (now a curated ЗДДС ground, see `vat-grounds.ts`) → drives which
  0%/освободени/ВОД/износ cell a no-VAT line belongs to.
- Rate/vatMode: today a document is single-rate (`vatMode` standard|no_vat). **Mixed rates
  per invoice is a separate §2 item** — until it lands, one document = one rate, so the
  ledger's rate split is trivial. Build the ledger to read per-line so it's already correct
  when mixed rates arrive.

Incoming (дневник покупки) — table `received_invoices`: has **flat** `netAmount`,
`vatAmount`, `grossAmount`, `vatRate` columns + `supplierSnapshot`, `invoiceNumber`,
`issueDate`. Only `status='confirmed' AND archivedAt IS NULL` count (matches
`getVatSummary`'s vatPaid).

## Rules to REUSE (do not reinvent — they encode hard-won decisions)
`lib/db/queries/money.ts` is the single source of truth for outgoing aggregation (AGG-1):
- Only `finalized`, `docType <> 'proforma'` count. **Accrual basis** (all finalized,
  regardless of payment) — see `issuedVatSumSql`.
- Credit notes **subtract** (`signedVatSql`, `signedGrossSql`).
- **GEN-1**: every amount is `× fxRate` into the company base currency.
- **Reconciliation invariant (write a test for this):** summing the sales-ledger rows for a
  month must equal `getVatSummary`'s `vatIssued` for that month; purchases must equal
  `vatPaid`. If they diverge, the ledger is wrong.

## The compliance-precise part — DO NOT GUESS
The mapping of amounts → НАП **клетки** (cell numbers: ДО 20% кл.11, ДДС кл.21/22, ДО 9%,
ДО 0% по чл.28/29/30, ВОД по чл.7 кл.15, тристранни, освободени кл.24, ВОП/protokol, etc.)
is a legal spec. **Verify against the current ППЗДДС appendices or an accountant (Koceto)
before writing the export** — a wrong cell makes the filing not reconcile. Also confirm:
- **Filing currency.** GEN-1 stores base currency; НАП filing is BGN until euro adoption,
  then EUR (see `knowledge/euro-adoption-2026.md`). The export currency ≠ necessarily the
  display base — pin this down.
- **Credit-note sign convention** in the register (negative base/VAT vs dedicated reduction
  columns).

## Recommended build order (each a verifiable, atomic commit)
1. **Data layer** — `getSalesLedger({from,to})` + `getPurchaseLedger({from,to})` returning
   typed per-document rows (docTypeCode, number, date, counterparty {name,eik,vat}, base,
   vat, rate, category). Reuse the money.ts sign/currency rules. **Test:** rows reconcile to
   `getVatSummary` for a seeded month (assert the numbers, per CLAUDE.md).
2. **UI drill-down** — on the ДДС page, expand a month into its sales + purchase document
   lists (base + VAT per doc). High value on its own, zero НАП-spec risk.
3. **Formal НАП export** — клетка mapping + fixed-width/CSV files (Делта/Ажур importable).
   Gated on the spec confirmation above. This is the "accountant can file" milestone.

## Related open items
- Mixed VAT rates per invoice (§2) — build the ledger per-line so it's mixed-rate-ready.
- Протокол по чл.117 (§2) — ВОП/reverse-charge self-invoices feed the purchase ledger + a
  separate dnevnik line; new doc type. Out of scope for v1 ledger.
