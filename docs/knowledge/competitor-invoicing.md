# Competitor Invoicing Research — by Capability

> How established invoicing products actually work: numbering, lifecycle, FX, VAT, payments,
> dunning, exports, bulk, filters, roles, audit, expense capture, compliance. Supports
> **RESEARCH-1**; informs OI-*, GEN-1, RV-1/RV-3, VAT-1, D-CANCEL, D-EDIT, D-FX.

**Researched:** 2026-07-07 (3 parallel agents; sources cited per section).
**Products:** BG: inv.bg · fakturi.bg (ProSystems) · Microinvest (Invoice Pro desktop + InvoicePro.bg cloud + Делта Pro accounting). International: Stripe Invoicing · Xero · QuickBooks Online · FreshBooks · Zoho Invoice · **Invoice Ninja** (open source — schema read from the actual v5 codebase).

**Primary sources worth revisiting:** inv.bg APIv3 spec `https://api.inv.bg/v3/swagger/bg.yaml` (their whole data model is public) · Invoice Ninja `database/schema/mysql-schema.sql` @ v5-develop · docs.stripe.com/api/invoices.

---

## 1. Invoice numbering

| Product | Model |
|---|---|
| **inv.bg** | Integer sequential; next-free proposed, **manually overridable + editable after issue**. Opt-in **multiple series («кочани»)** `{name, from, to, is_default}`; **per-employee number ranges** (e.g. 1000000001–1999999999). Credit/debit notes draw from the invoice pool. |
| **Microinvest cloud** | Per-doc-type `{prefix, last_number, digit_count}`; help states BG tax docs have **10 digits**; multiple ranges (groups A/B/C) per doc type, assignable per user. |
| **fakturi.bg** | Auto with multiple ranges; desktop assigns the number **only at save-commit** to prevent gaps/duplicates in network mode. |
| **Stripe** | Number **assigned at finalization** (null while draft), **immutable after**. Account-level sequence is the **EU default (VAT gapless expectations)** vs customer-level prefixes elsewhere. |
| **Xero / QBO** | Single editable sequence, gaps tolerated, duplicates only warned. Xero: invoices + credit notes **share one sequence** (top user complaint). |
| **Zoho** | **Multiple named series** as a first-class config per doc type; void keeps the number "so the sequence is not disturbed". |
| **Invoice Ninja** | Counters in settings JSON (company/group/client scoped), pattern strings (`INV-{$year}-{$counter}`), collision-checked assignment w/ retry, number assigned **at mark-sent** by default; deleting renames number to `{number}_deleted` to free the unique slot. UNIQUE `(company_id, number)` incl. soft-deleted. |

**Invoicly takeaways:** our 10-digit sequential `getNextInvoiceNumber` matches BG norms (inv.bg ranges, Microinvest digit-count). Multiple series/кочани is a real BG-market expectation (all 3 BG products) — candidate backlog item. Number-at-finalize (Stripe/Ninja) is the safest gapless model; we already finalize-assign.

## 2. Status & lifecycle (incl. cancel / credit notes)

- **inv.bg — orthogonal flags, not one state machine**: `is_draft`, payment `status` (paid|unpaid|partially-paid), `is_annulled` (**reversible** — «Махни анулирането»), `is_locked`, `send_status` (unsent|sent|resent), `confirmation` (client accept/reject via portal), `is_signed`, archived, **«осчетоводена» (accounted)** as a bulk-settable list state. Docs can also be hard-deleted. Credit/debit notes created from an invoice **or against an external invoice** (`related_invoice {id, number, date}` entered manually). Proforma is a first-class type + custom document types.
- **Microinvest cloud**: no draft concept; **logical delete** — number never freed, restorable, prints with «АНУЛИРАН» watermark. Paid/partial/unpaid auto-derived (cash/card docs auto-paid). Separate **Сторно** sequence on desktop.
- **Stripe**: `draft → open → paid | void | uncollectible`. **Finalization locks everything**; corrections only via credit notes (first-class, own number `-CN-01`, pre/post-payment types, reason enum). `uncollectible` is a distinct write-off-ish state that can still be paid.
- **Xero**: `DRAFT → SUBMITTED (awaiting approval) → AUTHORISED → PAID`, terminal VOIDED/DELETED — unique **approval step**. Paid invoices can't be voided until payment removed. Credit notes **allocate** (partially) across invoices.
- **QBO**: **no status enum at all** — status projected from `Balance` + `DueDate` + `EmailStatus` + linked txns. Void zeroes amounts but keeps the record.
- **FreshBooks**: status enum encodes payment-processor outcomes (retry/failed/auto-paid/deposit-partial…); **no void — soft delete only**.
- **Zoho**: draft/sent/viewed/unpaid/overdue/partially_paid/paid/void + **Write-Off operation** (reports as paid, cancellable).
- **Invoice Ninja** (most instructive for D-CANCEL/D-EDIT):
  - `DRAFT(1) SENT(2) PARTIAL(3) PAID(4) CANCELLED(5) REVERSED(6)`, virtual `OVERDUE(-1)`/`UNPAID(-2)` computed, never stored.
  - **Cancel** (from SENT/PARTIAL): zero the unpaid remainder, save `{adjustment, previous status}` into an in-row `backup` JSON → **exactly undoable**. Paid amounts stay paid.
  - **Reverse** (accountant-grade, from SENT/PARTIAL/CANCELLED/PAID): unwinds payments into unapplied client funds, zeroes balance+paid_to_date, terminal.
  - **Delete**: financial unwinding + number renamed `_deleted`; **Archive** is a separate pure-visibility tier.
  - **Invoice locking setting**: `off | when_sent | when_paid | end_of_month` — enforced at validation (GoBD-style compliance). *Directly relevant to D-EDIT.*
  - Race-safe transitions: conditional `UPDATE ... WHERE status_id = DRAFT`, check affected rows.

**Invoicly takeaways:** our cancelled-immutable + credit-note model matches Stripe/BG practice. For **D-CANCEL**: inv.bg's cancel is *reversible*; Invoice Ninja separates reversible cancel vs terminal reverse — a reversible cancel (with an undo) is likely what Koceto expects. For **D-EDIT**: Ninja's `lock_invoices` setting is the compromise pattern (editable until sent/paid/month-end). The «accounted» list state in inv.bg validates OI-1 exactly.

## 3. Currency & FX

- **inv.bg**: 18 currencies; **ECB reference rate**, updated each working day by 18:00 (help recommends issuing after 18:00; recurring invoices generate at **18:30** for that reason). Invoice stores `currency_rate` + `date_rate`. Payment allocations store **their own** currency+rate (FX at payment time ≠ FX at issue). Post-euro: dedicated **dual EUR/BGN display** chapter, fixed 1.95583 both ways, rounding-difference guidance, `rounding_precision {price, totals}` stored per invoice.
- **Microinvest**: БНБ fixing auto-suggested, editable, stored per doc. From 01.01.2026 **EUR is the base currency**; BGN removed as selectable on new docs; company DB converted to EUR with a BGN archive copy.
- **Xero**: XE.com hourly; rate overridable per transaction; **realized G/L auto-posted at payment; unrealized G/L on open items; dedicated FX reports**.
- **QBO**: IHS Markit every 4h; home-currency adjustments (revaluation) book unrealized G/L.
- **Stripe / FreshBooks / Zoho Invoice**: per-document currency, **no revaluation/base-currency story** (Stripe converts at payout; FreshBooks reports per-currency only).
- **Invoice Ninja**: docs stored in client currency; `exchange_rate` (default 1.0) **frozen at creation**; reports multiply by the stored rate so historical totals never drift; daily rate refresh.

**Invoicly takeaways (GEN-1/D-FX):** ECB-daily + freeze-at-finalize is exactly what inv.bg does — strong validation of the D-FX recommendation. Store the rate **and its date** on the document; consider a separate rate on payment records later. Post-euro dual display (EUR primary, BGN reference at 1.95583) is a BG-market must-have both leaders ship.

## 4. VAT / tax

- **inv.bg**: invoice-level `vat {percent, reason_without}` **plus optional per-line `vat_percent` override** (all-lines-or-nothing). Reusable **legal-grounds list** for 0%/exempt (BG+EN texts) in settings. **OSS regime** end-to-end (flag, registers, VAT report). Касова отчетност supported. **No ДДС дневници generation** — that's delegated to accountant software via export.
- **Microinvest**: per-line rates; explicit guidance that exempt ≠ fake 0% — use "no VAT" checkbox + basis. ДДС дневници + НАП files live in **Делта Pro**, not the invoicing tools. VAT Protocols (ВОП) as doc types.
- **Stripe**: reusable TaxRate objects — **immutable percentage** (archive+recreate to change) so history never drifts; per-line (≤10) or doc default; inclusive+exclusive can mix; customer `exemption_status` incl. `reverse` (prints "Reverse charge").
- **Xero**: per-line `TaxType`, each line rounded separately; doc-level `LineAmountTypes` Exclusive/Inclusive/NoTax.
- **Invoice Ninja**: up to 3 named taxes at both doc and line level, values **copied inline** (never FK'd); inclusive vs exclusive = per-doc boolean dispatching to two calculators; newer rules engine snapshots computed `tax_data` onto the doc.
- **FreshBooks**: 2 tax slots per line. **Zoho**: per-line + inclusive/exclusive preference.

**Invoicly takeaways:** our per-line vatRate + `noVatReason`/`vatMode` matches the BG leaders. The reusable **exempt-grounds list** (inv.bg settings) is a small, high-value add for VAT-1 era. Tax values copied inline (never joined) is already our model via snapshots — keep it.

## 5. Payment tracking

- **inv.bg (richest)**: payments are **first-class, M:N with invoices** — allocation rows `{payment_id, invoice_id, amount, currency, currency_rate, parent_id}`; one bank transfer pays many invoices; splits supported; payments have **income/expense type**; invoice carries `balance_paid`/`balance_due`; 14 payment methods; per-client default payment terms; каса (cashbox) module; **bank statement import + auto-matching + match suggestions API**.
- **Invoice Ninja**: `amount/balance/paid_to_date` triple on the invoice (invariant `amount = balance + paid_to_date`); `paymentables` polymorphic join w/ per-allocation `refunded`; overpayment stays on the payment as **unapplied client funds** (`payment_balance` denormalized on client); `partial + partial_due_date` = requested-deposit; `idempotency_key` UNIQUE per company; every mutation writes a **company_ledgers** append-only delta row (drift detector).
- **Xero**: part-payments; **Overpayment/Prepayment as distinct transaction types**; bank-feed reconciliation is the core loop.
- **QBO**: Receive-payment across invoices; Undeposited Funds → Bank deposit grouping ("Deposited" stage).
- **Stripe**: amount_due/paid/remaining/overpaid; partial via API/dashboard only (hosted page can't part-pay); overpayment → customer credit balance.

**Invoicly takeaways:** we have a payments table per invoice; the M:N allocation model (inv.bg/Ninja) is where this goes long-term (one bank transfer → many invoices) — not MVP, but don't paint the schema into a corner. The **balance triple + ledger** pattern is the money-correctness gold standard for DASH-1/GEN-1 aggregate design.

## 6. Reminders / dunning + recurring

- **inv.bg**: overdue reminders with day-offsets from issue/due date, **3 escalating templates**, semi-automatic (manual "send reminders" trigger over the overdue list). **Recurring («периодични») invoices**: templates + schedule, draft-or-issue mode, auto-email, **«магически думи»** (period placeholders in основание), pause/resume, issued at 18:30 after ECB fixing.
- **Microinvest Invoice Pro**: шаблони with weekly/monthly auto-execution + auto-email. **fakturi.bg: none.**
- **Xero**: up to 5 reminders, days-after-due. **QBO**: 3 reminders, up to 90 days before/after due. **FreshBooks**: 3 reminders + **native late fees** (flat/%). **Zoho**: due-date or expected-payment-date based. **Invoice Ninja**: 3 fixed reminders + **endless reminders** on a frequency; late fees injected as a line item (or a new invoice if locked).
- **Stripe**: reminder emails around due date; subscriptions generate invoices with a ~1h draft edit window.

**Invoicly takeaways:** recurring invoices are table stakes everywhere including BG (missing from our roadmap entirely — candidate item). Reminders matter less for the accountant-transparency wedge but are expected later. Late fees: skip.

## 7. Exports (accountant handoff)

- **inv.bg**: PDF (BG/EN, original/copy), XLS lists/reports, **20+ Bulgarian accounting-software export targets** (Микроинвест Делта Pro, Ажур, Бизнес Навигатор, Плюс-Минус, …) — one help article per target; imports from Ажур, Microinvest Invoice Pro (2 Excel files), bank statements; **НАП Н-18 Приложение 38 XML** (e-shop audit file, corporate plan).
- **Microinvest**: documents **auto-flow to Делта Pro via Sendera** (their doc-exchange cloud w/ OCR) with per-product-group account mappings; Борика/eFaktura e-invoices; PDF/XLS reports. **Делта Pro** is where ДДС дневници + НАП files happen.
- **International**: CSV/Excel exports everywhere; accountant handoff is **role-based live access**, not files (see §10).

**Invoicly takeaways:** in BG the accountant handoff is **export to Делта/Ажур** (file formats) — this is PRODUCT_CONTEXT integration #3 and the research confirms Делта Pro is the hub. But our differentiator (owner↔accountant in one app) can *replace* the export for accountants willing to work in-app — the export matters for the ~300-client accountant who consolidates in Делта.

## 8. Bulk actions

- **inv.bg**: checkbox-select → bulk **email, e-sign, status set (paid/unpaid/partial/accounted/archived), annul/un-annul, delete, PDF download, print, XLS export**.
- **FreshBooks**: print ≤50, mark-sent ≤150, add payments ≤30, archive/delete/email. **Zoho**: mark-sent, PDF, print, delete. **Xero**: bulk approve/delete/email/print (no bulk void). **Stripe/QBO**: thin.

**Invoicly takeaways:** BULK-1 (row select + bulk email) matches the leader's surface; bulk *status set* (paid/accounted) is cheap once OI-9 inline setters exist and hugely accountant-relevant.

## 9. Filtering & views

- **inv.bg**: type[], payment status[], draft, annulled, sent-status, currency, signed, archived, number, client (wildcards), note, PO; period from/to; НАП XML is **by month**; 17 report types (turnover by client/item/employee, FX invoices, client debt, account statement).
- **Xero**: status **tabs** (Draft/Awaiting Approval/Awaiting Payment/Paid). **Zoho/QBO/Stripe**: status+date filters. Saved views: nobody has them properly.
- **Invoice Ninja**: virtual statuses (overdue/unpaid) as filters, not stored.

**Invoicly takeaways:** month-first filtering (OI-5) matches how the BG products report (period = month for НАП). Status tabs + accounted filter (OI-4) align with inv.bg's list states.

## 10. Permissions & roles (accountant access models)

- **inv.bg**: **very granular per-employee rights** — per-module access, per-bank-account/каса scope, *own documents only*, *proformas only*, *number-range restricted*, *blocked clients*, log access, API access. Plans gate user counts.
- **Microinvest**: cloud — user↔company M:N with **owner approval** (request by ЕИК → Разрешен) + per-user numbering; desktop — shared-DB real-time accountant workflow is a selling point.
- **Xero**: external accountant = **Adviser role** on the org + **Xero HQ** partner console for all clients. **QBO**: separate **accountant-firm invitation** channel — admin-level access **without consuming a seat**, extra tools (undo reconciliation, reclassify, write-off), firm-side client list (QBOA). **FreshBooks**: dedicated Accountant role (CoA, bank rec, journals). **Stripe/Zoho Invoice**: no accountant concept.
- **Invoice Ninja**: `is_owner/is_admin` + comma-separated `{action}_{entity}` permission string + owned/assigned record access.

**Invoicly takeaways:** our owner/accountant roles are the right primitive. QBO's "accountant doesn't consume a seat + gets a cross-client console" and Xero HQ are the patterns for the future accountant-side dashboard (~300 companies per accountant — PRODUCT_CONTEXT §2). Microinvest's request-by-EIK + owner-approves flow is a neat BG-native invite alternative.

## 11. Audit trail

- **inv.bg**: full action log (create/edit/delete/send/**download**), filter by period/employee/doc/action, Excel export, per-invoice history endpoint + webhooks (invoice.created/updated/accepted/rejected/downloaded, payment events).
- **Xero**: History & Notes on every transaction **with old and new values**; deleted transactions stay visible. **QBO**: audit log w/ before/after + per-transaction version history. **Zoho**: per-invoice Comments & History + org audit trail with **field-level diffs + compare versions**. **FreshBooks**: recent, invoices+expenses only.
- **Invoice Ninja**: ~140 activity types; every doc mutation also snapshots **rendered HTML** of the document (backups side-car); `token_id` records *which API key* acted.

**Invoicly takeaways:** our activity log is the right foundation (TRANS-1 builds on it). The "old value → new value" diff (Xero/QBO/Zoho) is the credibility feature for the owner↔accountant trust story; a per-document history view is a natural RV/OI follow-up.

## 12. Received / expense invoice capture ⭐ (our AI wedge)

- **BG products: essentially absent.** inv.bg — none (portal accept/reject between inv.bg firms + expense-type payments only). fakturi.bg — none. Microinvest — receiving e-docs between platform users; **OCR lives in Sendera → Делта Pro** (accounting side), not the invoicing tools.
- **Xero**: email-to-bills (`bills.[code]@xerofiles.com`) + Hubdoc OCR (free in all plans) → **draft bill → review → approve** pipeline.
- **QBO**: receipt snap/email → **"For review"** queue → **suggests matches to bank-feed transactions** → match-or-create, editable before confirm.
- **FreshBooks**: OCR (Sensibill) → Uploads queue → convert to Expense/Bill.
- **Invoice Ninja**: expenses w/ **derived status** (logged/pending/invoiced/paid from 3 columns), vendors, expense→invoice rebill link, e-mail-in inbox, bank-transaction matching rules.
- **Stripe/Zoho Invoice**: none.

**Invoicly takeaways:** **no BG competitor has in-product AI capture of received invoices** — our AI-extract → review → confirm flow is genuinely differentiated locally; the international benchmark UX is "inbox/queue → review screen → approve" (validates RV-3's direction). Email-in ingestion (unique address per company) is the standard acquisition channel for documents (supports EMAIL-2 scoping). Bank-feed matching is the endgame (later).

## 13. Compliance (НАП, e-invoicing, SAF-T)

- **inv.bg**: "одобрено от НАП" marketing; **Н-18 Приложение 38 XML** monthly audit file (e-shops, corporate plan); SAF-T — **explainer article only** (BG rollout 2026→2030), no generation; no fiscal-printer story (invoicing ≠ СУПТО).
- **Microinvest**: InvoicePro.bg "одобрена от НАП" (Н-18, ЗСч, ЗДДС); Invoice Pro has an optional **СУПТО variant** (auditor profile, QR on docs, fiscal devices); SAF-T absent from changelog (verified); ДДС files via Делта Pro.
- **Euro adoption is the live compliance topic**: both BG leaders shipped dual EUR/BGN display, fixed-rate 1.95583 conversion guidance, and (Microinvest) hard EUR-base migration on 01.01.2026.
- **Invoice Ninja**: e-invoice JSON columns (UBL/PEPPOL/Verifactu), per-country validation — the EU e-invoicing direction.

**Invoicly takeaways (NAP-1):** nobody generates SAF-T yet — the 2026-2030 rollout is a **greenfield opportunity** to be first; "НАП-safe" positioning matches what leaders market. Dual EUR/BGN display needs an explicit check against our documents (post-adoption invoices in EUR with BGN reference). The actual NAP.pdf remains the source of truth (NAP-DOC still blocked).

## 14. Pricing snapshot (context for §5 business model, deferred)

- **inv.bg**: freemium — €0 (5 cl/5 inv/1 user) → €4 → €8 (150/150/10) → €28 (1000/1000/25) → corporate. Per-firm.
- **fakturi.bg**: €57.50/yr flat. **Microinvest invoicing: free** (monetizes Делта Pro €298 / SUB + СУПТО).
- International: per-user/month tiers; Stripe: % of invoice volume; Invoice Ninja: OSS + hosted plans.

## 15. Data-model lessons (for schema evolution)

From Invoice Ninja's production schema (12 patterns worth stealing — full detail in the research transcript):
1. **`amount / balance / paid_to_date` triple** on money documents + denormalized client aggregates + append-only ledger with running balance (drift detection).
2. **In-row `backup` JSON for reversible transitions** (cancel stores `{adjustment, previous status}` → exact undo). *→ D-CANCEL.*
3. **Race-safe status claims** via conditional UPDATE + affected-rows check. *→ our finalize.*
4. **Virtual statuses** (overdue/unpaid) computed, never stored — no cron flips.
5. **Copied-inline snapshot data** (tax rates, party details) so history never drifts — we already do this; keep.
6. **Two-tier soft delete** (archive = hide; delete = financial unwind + number freed via `_deleted` rename).
7. **Invitation rows** per contact carrying sent/viewed/opened/delivery-status — one table for links, tracking, and email state. *→ TRANS-1 + client links.*
8. **Settings-blob cascade** (client → group → company → defaults) — zero migration churn for preferences.
9. `idempotency_key` UNIQUE per company on payments.
10. Line items as JSON with **frozen computed fields** (their choice; we use a lines table — fine, but keep computed totals frozen on finalize as we do).
11. Polymorphic **documents-attach-to-anything**.
12. Audit rows record **which API token** acted.

inv.bg model highlights: payments↔invoices M:N with per-allocation currency+rate & `parent_id` splits; `number_sets` (кочани); orthogonal status flags; `related_invoice` for notes against external docs; per-invoice `rounding_precision`.

## 16. Gaps we're missing entirely (fed into roadmap as candidates)

1. **Proforma invoices** — first-class in all 3 BG products; BG-market table stakes. (→ new item)
2. **Recurring invoices** — everywhere incl. BG leaders (templates + auto-email + placeholders). (→ new item)
3. **Multiple numbering series (кочани)** — all 3 BG products. (→ new item, waits on real user demand)
4. **Dual EUR/BGN display** post-euro-adoption (1.95583) — both BG leaders. (→ verify what we print today; likely small)
5. **Reusable 0%/exempt legal-grounds list** in settings — inv.bg. (→ small, pairs with VAT-1)
6. **Overdue reminders** — everywhere. (→ later, after TRANS-1)
7. **Client-facing document links + accept/reject + viewed tracking** — inv.bg confirmation flow / Ninja invitations. (→ later; pairs with EMAIL-1)
8. **Bank statement import + payment auto-match** — inv.bg. (→ future endgame)
9. **Per-document history view w/ old→new diffs** — Xero/QBO/Zoho. (→ pairs with TRANS-1)
10. **Accounting-software export (Делта Pro first)** — the accountant hub in BG. (already PRODUCT_CONTEXT integration #3)
11. **Bulk status set (paid/accounted) on selection** — inv.bg. (→ cheap extension of OI-9/BULK-1)
12. **E-signature (B-Trust/InfoNotary/StampIt)** — inv.bg. (→ future)
