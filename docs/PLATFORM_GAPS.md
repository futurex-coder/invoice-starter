# Platform gaps & build plan — BG accountant software (run 3)

Gap analysis of Invoicly as **Bulgarian счетоводител + SMB** software, from the run-3 inventory
(+ `knowledge/competitor-invoicing.md`, `euro-adoption-2026.md`, `ux-audit-2026-07.md`).
Ordered for an overnight run: **lowest risk first**. Tick items as they ship; commit atomically.

## 0. BG localization — every user-facing string in Bulgarian ✅ DONE (ee5fb7c, +primitives b0deeb6)
The app prints perfect Bulgarian invoices but its whole chrome is English — the #1 distrust
signal for the target user. Hardcode BG (no i18n catalog; glossary: `knowledge/bg-glossary.md`).
Order: shared primitives (activity-labels, format.relativeTime, list-page pills/pagination/search,
StatusBadge, confirm-dialog defaults) → nav/chrome → per area. Leave already-BG files alone
(formatter.ts, InvoicePrintPreview, vat/page, MonthCloseCard). This sweep also **fixes several
raw-enum bugs** (see §1). Verify: build + grep for leftover English + tests.

## 1. Low-risk correctness / polish (do with or right after localization)
- [x] **Finalized invoice shows raw "finalized"** — detail `STATUS_LABELS` keys `issued` not
      `finalized` (`invoices/[invoiceId]/page.tsx`). BG pill fixed it. **LOW/bug** → ee5fb7c
- [x] **"All documents" list renders raw enums** (`unpaid`/`pending`/`finalized` via capitalize,
      `invoices/all/page.tsx`) — now uses the same pills as the outgoing list. **LOW** → ee5fb7c
- [x] **ReviewForm shows raw enum values** for method/payment/accounting status. **LOW** → ee5fb7c
- [x] **Payments page consolidated into received-invoices** — first added it to the nav
      (ad52da1), then (owner call) removed the standalone page entirely: it only duplicated the
      received-invoices list (which already has payment-status filter + row mark-paid). Its one
      unique widget — the owed/paid/overdue money KPIs — now sits atop received-invoices; the
      dashboard tiles point to `received-invoices?paymentStatus=…`. **LOW** → this commit
- [x] **Hardcoded " EUR"** in `SummaryGrid` + `PaymentKpiGrid` (GEN-1-LABELS in REVIEW_QUEUE) —
      now reads the base currency; cross-company grid flags mixed currencies. **LOW** → this commit
- [x] **Proforma DB enum tidy** — added `PROFORMA` to the `schema.ts` `DocType` enum + column
      comment. Confirmed `doc_type` is a free varchar(30) with no CHECK constraint, so proforma
      inserts fine (PROF-1 flow). **LOW** → this commit
- [x] **Reusable 0%/exempt legal-grounds list** (VAT-2) — replaced the free-text "Reason for no
      VAT" with a curated ЗДДС dropdown (`vat-grounds.ts`) + "Друго" free-text fallback. List
      seeded (10 grounds) + logged for accountant review (VAT-2-GROUNDS). **LOW** → this commit
- [x] **Two diverging `formatMoney`** — dashboard used browser locale, docs used deterministic
      `1 234.56`. Unified: one impl in `lib/format`, re-exported by the invoice formatter. **LOW-MED** → this commit

## 2. Core BG compliance artefacts (MED, high value — the accountant's real job)
- [ ] **ДДС дневник продажби / покупки** — per-document sales & purchase ledgers in НАП column
      format (over existing `invoices`/`receivedInvoices`). The monthly deliverable; the VAT
      page only nets — an accountant can't file from it. **MED**
- [ ] **НАП export** — dnevnik `.txt`/CSV (Делта/Ажур-importable) + later декларация/VIES. **MED**;
      SAF-T **HIGH** (2026-2030, greenfield).
- [ ] **Протокол по чл.117** (self-charge/reverse-charge for ВОП + EU services) — new doc type;
      `vatMode` only `standard|no_vat` today. **MED**
- [ ] **Mixed VAT rates per invoice** — new-invoice UI forces one rate on all lines though the
      schema/calculator support per-line. A 20%+9% invoice is impossible today. **MED**
- [ ] **Finish proforma→invoice conversion** — today "Convert" just copies to a draft; mark the
      proforma converted + link. **LOW-MED**
- [ ] **Credit/debit note vs an external (supplier) invoice** — notes only reference own
      finalized invoices. **LOW-MED**

## 3. SMB expectations (MED)
- [ ] **Email an invoice to the client** (PDF/link) — only invite-email exists; SMTP wired
      (fix the stale "Invoice Manager" sender). **MED** (needs D-EMAIL provider decision)
- [ ] **Export lists to CSV/Excel; invoice PDF as a file** (not just browser-print). **LOW-MED**, top value
- [ ] **Reports** — revenue by client/period, expense by supplier, simple P&L. **MED**
- [ ] **Recurring / periodic invoices** (templates + schedule). **MED**
- [ ] **Payment reminders / overdue dunning; per-client statement**. **MED / LOW**
- [ ] **Client autofill by ЕИК** (Търговски регистър / VIES). Biggest keystroke sink. **MED** (external API)
- [ ] **Per-document history with old→new diffs** (owner↔accountant trust); keep the cancel
      reason (dropped today). **LOW-MED**
- [ ] **Dashboard 3-tile money row** (Вземания / Задължения / ДДС този месец) + invoice-list
      status tabs (Всички/Чернови/Неплатени/Просрочени/Платени) — from ux-audit. **LOW-MED**

## 4. Endgame (HIGH — later, own ADRs)
Bank import + reconciliation · e-invoicing СЕФ/PEPPOL mandate · SAF-T · e-signature. Deferred.

---
**Run-3 order:** §0 localization (with the §1 enum-bug fixes folded in) → the rest of §1 →
§2 ДДС дневници (the highest-value accountant feature) → §3 exports → onward. Each verified by
running + committed atomically.
