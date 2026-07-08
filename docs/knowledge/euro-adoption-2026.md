# Euro adoption (BG, 2026-01-01) — what it means for Invoicly

**One-liner:** from **2026-01-01** Bulgaria's accounting/invoicing currency is the **euro**.
Invoices are issued in **EUR only** and are **legally EXEMPT from dual BGN/EUR display**.
This makes GEN-1 ("one company currency, convert everything to it") both the simplest and
the compliant path. Written 2026-07-09 (RESEARCH, run 2). Supports GEN-1, VAT-1, NAP-1.

## The rules that matter for an invoicing app

1. **Fixed, irrevocable rate: 1 EUR = 1.95583 BGN**, both directions. Convert BGN→EUR by
   **dividing by 1.95583 then rounding half-up to 2 decimals** (worked example from the
   accountants' guide: `653.96 BGN / 1.95583 = 334.36 EUR`). Never use ECB for BGN↔EUR.
   → `lib/fx/convert.ts` `EUR_BGN_FIXED` + `roundTo` (half-up). Pinned by a test.
2. **Invoices are issued in EUR from 2026-01-01.** Legal base: Закон за счетоводството чл.5
   ал.1 (euro = base currency of accounting docs). Invoices dated ≤ 2025-12-31 stay in BGN;
   **no retroactive conversion of old documents** — historical rows keep their currency.
3. **Dual BGN/EUR display is NOT required on invoices / credit-debit notes / accounting
   documents** — explicit exemption **ЗВЕРБ чл.15 ал.3 т.5** (docs under чл.112 ал.1 ЗДДС).
   Dual display is mandatory only for **consumer-facing prices** (price tags, menus, catalogs,
   ads), in the window ~2025-08-08 → 2026-08-08. **None of that touches the invoice PDF.**
   → Do **not** build mandatory dual-currency into the invoice template. A BGN reference line
   at the fixed rate is a *courtesy* only (off-by-default / transition year, if at all).
4. **Dual-circulation cash period 2026-01-31 only** is a fiscal-device / касова бележка
   concern (receipts), **not** an invoicing-app concern. Don't build for it.
5. **НАП reporting is in EUR from 2026-01-01** (VAT declarations etc.).
6. Real foreign currencies (USD, GBP, …) still need **ECB daily** reference rates — only the
   BGN↔EUR leg is fixed. → `lib/fx/rates.ts`.

## What the BG leaders shipped
- **Microinvest:** hard EUR-base migration on 01.01.2026 — BGN removed as selectable on new
  docs; company DB converted to EUR with a BGN archive copy. (Validates GEN-1's single-base model.)
- **inv.bg:** added a dual EUR/BGN display chapter driven by *consumer pricing* rules, not the
  invoice PDF; stores a per-invoice rounding precision.

## GEN-1 decision (locked)
- Company base currency (`companies.defaultCurrency`) is **the** currency; everything displays
  + aggregates in it. Documents keep their own `currency` (foreign suppliers stay USD, pre-2026
  BGN stays BGN) but store a **frozen `fxRate` (doc→base)** and are shown converted.
- `fxRate` canonical meaning is repurposed to **amount_base = amount_doc × fxRate** (it used to
  be a EUR→BGN print multiplier — that print dual line now uses the fixed constant directly, and
  is a non-mandatory courtesy).
- The invoice PDF does **not** show dual currency by requirement.

Sources: kik-info accountants' guide; BillBox vendor guide (чл.15 ал.3 т.5); НАП euro Q&A;
ECB Bulgaria changeover; inv.bg help. (Full URLs in the run-2 research notes.)
