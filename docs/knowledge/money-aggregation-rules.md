# Money-aggregation rules — the canonical map (DASH-1)

> Every place that sums money, the rule it follows, and the known gaps. The rules
> themselves are CODE — `lib/db/queries/money.ts` — this doc is the map + rationale.
> Written 2026-07-08 (AGG-1 shipped the fixes the FUNC-AUDIT found). Supports DASH-1,
> GEN-1 ADR, VAT-1.

## The rules (as of AGG-1)

**Outgoing documents** (`invoices` table — invoice / credit_note / debit_note):

1. Only **finalized** documents carry financial weight. Drafts and cancelled docs never count.
2. **Signed amounts**: credit notes SUBTRACT their gross, invoices and debit notes ADD it.
3. `paymentStatus` buckets — **'paid' → collected** ("revenue" — a *cash* view, not accrual);
   **anything else (unpaid | partial) → outstanding**. A partially-paid document is money
   still being collected; it must never vanish from both buckets (it used to).
4. On notes, `paymentStatus` = "has the refund/offset been settled": a paid CN reduces
   collected cash; an unpaid CN reduces the receivable.
5. Overdue is a **count** of not-fully-paid invoices past due date (incl. partial).

**Received documents** (`receivedInvoices`): only **confirmed + non-archived** rows count;
'paid' → expensesPaid, `<> 'paid'` → expensesOutstanding (partial already handled).
Discarded/draft rows never count.

## Where money is summed (all sites, 2026-07-08)

| Site | What | Rule source |
|---|---|---|
| `lib/db/queries/money.ts` | `collectedSumSql`, `outstandingSumSql`, `overdueCountSql` | **canonical** — new aggregates must build on these |
| `lib/db/queries/dashboard.ts` → `getDashboardMetrics` | cross-company dashboard cards + totals | money.ts fragments; expense CASEs inline |
| `app/(dashboard)/c/[companyId]/dashboard/_components/queries.ts` → `getCompanyMetrics` / `getCompanyExpenseMetrics` | company dashboard | money.ts fragments; expense CASEs inline |
| `src/features/received-invoices/actions.ts` → `getPaymentsOverview` | payments page KPIs (received side): toPay list, `overdueCount`, `overdueAmount` | `<> 'paid'` incl. partial ✓; dueDate-based overdue |
| list pages (`listInvoices`, `listReceivedInvoices`) | no money aggregates today (pagination counts only) | — |

Verified: a real-DB integration suite (`lib/db/queries/money.integration.test.ts`) pins the
ledger `{paid 1000, unpaid 600, partial 300, CN paid 200, CN unpaid 150, DN 50, draft, cancelled}`
→ collected **800**, outstanding **800**, overdue **2**. The live dev data reconciles by hand:
Алфа = collected **1440** (1920 − 480), outstanding **360** (600 − 600 + 360).

## Known gaps / edges (deliberate, tracked)

1. **Currency-blind sums (GEN-1, blocked on D-FX).** All sums add documents in their own
   currencies and the UI labels the result with `companies.defaultCurrency`. Cross-company
   totals add BGN to EUR raw. Fix = convert via frozen `fxRate` at finalize — that lands
   INSIDE `money.ts` so every consumer inherits it.
2. **CN against a cancelled parent still counts.** Cancelling an invoice does not cancel its
   credit notes — a finalized CN keeps subtracting while its parent contributes 0. Surfaced
   by the invoice-11 incident (below). Pairs with **D-CANCEL**: when cancel semantics are
   decided, decide whether notes follow their parent.
3. **Overdue is a count, not an amount.** A fully credit-noted invoice stays "overdue" until
   its paymentStatus is resolved. Netting only happens in the sums.
4. **"Revenue" is a cash view** (paid only). Accrual revenue (all finalized) is a different
   number — VAT-1 will need the accrual/base split per month; build it on `money.ts`.
5. **No payment amounts.** `partial` is a label without a number until PAY-1 (payment
   ledger) exists — outstanding treats a 99%-paid invoice the same as an untouched one.

## Incident note (2026-07-08, dev DB)

During preview-driven UI testing, a stray synthetic click cancelled seed invoice 11
(Алфа № 0000000001, paid, 1920) — caught immediately because the new signed aggregates
made company 5's "collected" go **negative** (−480: the paid CN kept subtracting while its
cancelled parent stopped counting). Restored to `finalized` (its known prior state) via a
guarded SQL update; activity log retains the CANCEL_INVOICE entry (user 7, 20:46Z).
Two lessons: (a) the aggregation rules surfaced real data corruption instantly — they work;
(b) edge #2 above is real and needs the D-CANCEL decision.
