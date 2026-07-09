# Контировка — Owner UX, Сметкоплан & Gap-Closure (FINAL)

**Codename:** `OWN-2` (owner layer, consolidated) + `COA-1` (сметкоплан & account picker) + `GAP-1` (gap-closure & roadmap)
**Prepared for:** owner + счетоводител review · **Status:** FINAL · design, ready to slice · **Date:** 2026-07-09
**Consistency:** every route/component/`file:line` anchor below is code-verified on this branch; the chart seed, Drizzle shapes and picker contract are copy-paste-ready. Where anything here would conflict with `KONTIROVKA_WIRING_STRESS.md`, **that document wins** — reconciled conflicts are called out inline (e.g. `ACCOUNTING_BASES` = WIRING's 6-value enum, §A4/§B3).
**Reads on top of:**
- `KONTIROVKA_PLAN.md` — build plan, 6 slices (engine, data model, phasing)
- `KONTIROVKA_WIRING_STRESS.md` — code-verified wiring audit + 27 stress findings + Part 4 corrections. **Wins on any conflict.**
- `KONTIROVKA_ANALYSIS.md` — engine deep-dive (superseded by the plan on the engine)
- `KONTIROVKA_OWNER_UX.md` (`OWN-1`) — the first owner-UX pass. **This document folds `OWN-1` in as PART A (canonical, consolidated with the market-pattern grounding) and ADDS PART B (сметкоплан + account picker) and PART C (gap-closure + updated roadmap).**

> **The owner's ask, verbatim.** *"It must be EASY for a company **owner (NOT an accountant)** to create and post **разходи** (expenses) and **приходи** (revenue/profit), to **see aggregated data & numbers**, and to **KNOW that everything is in order and transparent."*
>
> This addendum answers that ask end-to-end in three parts:
> - **PART A — THE OWNER LAYER:** quick-create `Разход`/`Приход` that hide Дт/Кт but produce correct double-entry underneath; the plain-language category→account seam; the aggregated dashboard (приходи/разходи/печалба/ДДС/вземания/задължения) with the real-vs-прогноза + COGS honesty; and the **"Всичко изрядно"** transparency/health system. Plus the owner⇄счетоводител two-tier toggle.
> - **PART B — СМЕТКОПЛАН & ACCOUNT PICKER:** the concrete `BG_CHART_OF_ACCOUNTS` seed (клас→група→синтетична), the MVP-subset-vs-full decision, the accountant's account-picker UX, how a контировка line snapshots `{code, name, group, class}`, and the Drizzle shapes.
> - **PART C — GAP-CLOSURE:** the ranked list of everything still missing (from the audit) with audience/severity/coveredByPlan/fix/slice, a **"definition of complete"** checklist, and an updated slice roadmap folding the owner layer + chart + gap fixes into the existing slices.

---

# PART A — THE OWNER LAYER

## A0. The pattern every "accounting for non-accountants" product converges on

The best owner-facing accounting products — QuickBooks Simple Start, Xero, Wave, FreeAgent, Zoho Books, Bokio, Holded — all build the **exact two-audience architecture** the Invoicly owner is asking for: a plain-language "money in / money out" surface that **never shows raw Дт/Кт**, sitting on a correct double-entry engine that runs silently underneath. Four repeatable design moves make it work, and each maps 1:1 onto what we already have:

| Market move | What it means | Invoicly realisation |
|---|---|---|
| **1. One-tap record income/expense** | A plain form (amount + who + plain category + date). The debit/credit is **derived, never typed** (Bokio reads the doc and books it "in the right place with the correct VAT" in one click; owners never see the word *debit*). | `➕ Приход` / `➕ Разход` (§A2/A3) wrap the existing create flows; the engine derives the контировка. |
| **2. Category → account is the hidden seam** | Owner picks a human category ("Software", "Rent"); the app maps it to a GL code and posts the balanced entry. | Owner picks **Основание** (Услуга/Стока/Материал/Актив/Наем/Друго); the `basis → 70x/60x` resolver fills the account (§A4, Part B §B3). |
| **3. Confidence-gated review queue** | OCR pre-fills + a confidence score; **auto-post the confident majority, queue the uncertain minority** with the suggestion pre-filled — never silently post a low-confidence guess. | `received_invoices.extractionConfidence` gates auto-post; anything `unclassified`/foreign/CN/low-confidence is **held as a flagged draft** (§A2, closes stress #7/#9/#22). |
| **4. Trust layer** | A red/green "books in order" signal from a small set of counts, an immutable audit trail, and an accountant-review mode. Trusted products **do not over-claim** (FreeAgent openly disclaims figures it did not calculate). | The **"Всичко изрядно"** health panel (§A6): balance self-check, непроверени/неясни counts, posted/draft meter, period status, `activityLogs` audit trail, accountant-review state, honest COGS/Прогноза banners. |

**The one design idea: one ledger, two lenses.** The `journal_entries` + `journal_lines` + `journal_tax_lines` the engine produces (`PLAN §2.1`) are **identical** for both audiences. Only the *lens* differs:

| | **OWNER lens** (default) | **СЧЕТОВОДИТЕЛ lens** ("Меню Контиране") |
|---|---|---|
| Vocabulary | приход / разход / печалба / "ще внасяш ДДС" / "клиентът ти дължи" | Дебит / Кредит / сметка / клетка / основание / операция по ДДС |
| Sees Дт/Кт? | **Never** — a plain "какво се осчетоводява" summary instead | Yes — the two-panel grid, account picker, клетки |
| Classifies by | a **plain category** + a **plain ДДС question**; engine derives 70x/60x + операция + клетка | editing `vatOperation`, accounts, клетки directly |
| Posts via | one tap `Издай и осчетоводи` / `Потвърди и осчетоводи`; **anything unclassifiable is held as draft, never auto-posted** | reviews the draft, overrides, posts |
| Reads | KPI cards + "Всичко изрядно?" health panel | Хронологичен, Оборотна ведомост, Дневник продажби/покупки, Справка-декларация, Главна книга |

**~70% re-lens, not rebuild.** The owner primitives already ship: `MetricsSummary` (Приходи/Вземания/Платени разходи/Задължения, `app/(dashboard)/c/[companyId]/dashboard/_components/MetricsSummary.tsx`), `MonthCloseCard` (TRANS-2, same dir), the `/vat` Прогноза page, the invoice create flow, the received upload+review flow, the `VAT_EXEMPTION_GROUNDS` picker, and the `/activity` audit log. `OWN-2` aggregates/re-labels these + adds two quick-create wrappers. The **new engine** work (`journal_*`, `VAT_OPERATIONS`, `deriveExemptVatOperation`, period lock, posting guards) is `PLAN` Slices 2–5 and is a prerequisite.

---

## A0.1 Screen & component map — the exact routes/files each owner surface reuses

Every owner surface below is an **existing route** re-lensed, or a **new component dropped into an existing route** — no route churn. Paths are branch-verified (all under `app/(dashboard)/c/[companyId]/`; the `@/components/...` and `_components/...` files exist today). "New" = the only net-new code the owner layer needs.

| Owner surface (§) | Route (reuse) | Existing components to re-lens | New component / work |
|---|---|---|---|
| Nav shell + Изглед toggle (§A1) | `c/[companyId]/` layout | `company-layout-shell.tsx` | `ViewLensToggle` (Собственик⇄Счетоводител, keyed on `CompanyRole`); `➕ Приход`/`➕ Разход` buttons |
| Табло / dashboard (§A5, §A6) | `…/dashboard` → `dashboard/page.tsx` | `_components/`: `MetricsSummary`, `MetricCard`, `MonthCloseCard`, `InvoiceBreakdownCard`, `ReceivedBreakdownCard`, `ActivityFeed`, `CompanyHeader`, `QuickLinksCard`; `_components/queries.ts` (`getCompanyMetrics:38`, `getMonthCloseStatus:98`, `getCompanyExpenseMetrics:193`) | `ProfitCard`, `VatObligationCard`, `CashProxyCard`, `PeriodSelector`, **`HealthPanel`** (§A6); `getHealthStatus()` query |
| ➕ Приход create (§A3) | `…/invoices/new` → `invoices/new/page.tsx` | `invoices/new/_components/`: `RecipientCard`, `LineItemsCard`, `TotalsCard`, `DocumentCard`, `NotesCard`, `PaymentCard`, `ActionsBar`, **`NoVatReasonPicker`** (the `VAT_EXEMPTION_GROUNDS` picker); `use-invoice-form.ts` | `PlainCategoryPicker` (Основание cards), `PlainVatQuestion`, `WhatGetsPostedSummary` ("какво се осчетоводява"), `виж като счетоводител` link |
| Приходи list (§A5 drill) | `…/invoices` (+ `/all`, `/[invoiceId]`) | `invoices/page.tsx`, `invoices/_components/` | plain relabel only ("Приходи") |
| ➕ Разход upload (§A2) | `…/received-invoices/upload` | `@/components/received-invoices/ReceivedInvoiceUploader` | quick-create modal wrapper |
| Разход review (§A2) | `…/received-invoices/review/[id]` | `@/components/received-invoices/ReviewForm`, `PreviewPane`, `PendingReviewBanner`; `review/[id]/_components/`: `ReviewHeader`, `DuplicatesWarning`, `rowToReviewInput`; `review-form-state.ts` | plain-summary variant of `ReviewForm`; **`ExpenseManualEntry`** (received invoices have **no** manual-create path today — only upload); Тип Фактура/Кредитно известие radio (needs `received.docType`, #5) |
| Разходи list (§A5 drill) | `…/received-invoices` (+ `/[id]`) | `received-invoices/page.tsx`, `_components/` | plain relabel only ("Разходи") |
| Данъци/ДДС drill (§A5.4) | `…/vat` → `vat/page.tsx` (SWR table) | current `{month, vatIssued, vatPaid, vatNet}` table | expandable-per-month rows + chip states + `Приключи месеца` |
| Активност / audit (§A6) | `…/activity` → `activity/page.tsx` | `ActivityFeed`, `activityLogs` (`schema.ts:563`) | filter to post/reverse/close events |
| Счетоводител power view (§A1) | **NEW** `…/schetovodstvo` (`PLAN §9.3`) | — | Меню Контиране + Справки (accountant lens) |
| Onboarding / Slice 0 (§C, G02/G12) | reuse `create-company` + `dashboard/onboarding` | `create-company/page.tsx`, `dashboard/onboarding/` | opening-balances + VAT-reg-context wizard steps |

**Roles source of truth:** `CompanyRole` enum `OWNER='owner' | ACCOUNTANT='accountant'` (`schema.ts:823`), stored as `company_members.role` varchar(50) (`schema.ts:113`), one-owner-per-company unique index (`schema.ts:126`). The lens toggle and every accountant-only gate key on this.

---

## A1. The owner⇄accountant two-tier toggle (Deliverable 4)

The nav shell (`company-layout-shell.tsx`, MENU-1 horizontal nav) gains **one primary action pair** and **one gated section**. Company membership already carries the role — `CompanyRole.OWNER | ACCOUNTANT` (`schema.ts:823`), stored as `company_members.role` varchar(50) (`schema.ts:113`, with a one-owner-per-company unique index at `:126`). The toggle keys off it, remembered per user.

```
┌ Invoicly · «Моята Фирма ЕООД»                         [ Изглед: ● Собственик  ○ Счетоводител ] ┐
│  Табло   Приходи   Разходи   Данъци/ДДС   Контрагенти   …  │   [ ➕ Приход ]  [ ➕ Разход ]     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
        (Счетоводство ← appears only in Счетоводител lens / for accountant role)
```

- **`➕ Приход` / `➕ Разход`** — always-visible primary buttons (top bar + dashboard hero). The owner's two verbs.
- **Изглед: Собственик ⇄ Счетоводител** — flips the lens. `OWNER` role defaults to **Собственик** and may peek at Счетоводител; `ACCOUNTANT` role defaults to **Счетоводител**. When Счетоводител is on, a **`Счетоводство`** entry appears → the Справки + Меню Контиране power view (`PLAN §4.2/§4.3`; route `…/schetovodstvo`, `PLAN §9.3`).
- **`виж като счетоводител`** — on every plain summary and every document, a deep-link that opens the raw Меню Контиране **on the same `journal_entries` row** without forcing the global toggle. A one-off peek. The plain summary is a read-only projection of those very `journal_lines`.
- Existing routes stay; only labels get owner-friendly aliases — **no route churn**. Concretely: `…/invoices` (Фактури) → **"Приходи"** surface, `…/received-invoices` (Получени) → **"Разходи"** surface, `…/vat` → **"Данъци/ДДС"**, `…/dashboard` → **"Табло"**, `…/partners` → **"Контрагенти"**, `…/activity` → **"Активност"**. The relabel lives in `company-layout-shell.tsx`; the Счетоводител-only `…/schetovodstvo` entry is appended when the lens is Счетоводител.

**What each lens shows.** Собственик: Табло (KPIs + health), Приходи (issued docs, plain), Разходи (received docs, plain), Данъци/ДДС (Прогноза→Реално month drill), + the two ➕ actions. Счетоводител: all of the above **plus** `Счетоводство` = Меню Контиране (raw Дт/Кт) + Справки. Same underlying entries, one level of detail down.

---

## A2. `➕ Разход` — owner quick-create for an expense (Deliverable 1a)

A **Разход = a received invoice.** This is the owner's most frequent verb, so it leads. Two entry modes on one screen; **both derive the контировка and hide Дт/Кт.**

**Reuses:** the `…/received-invoices/upload` route (`ReceivedInvoiceUploader`, `@/components/received-invoices/`) → OCR → the `…/received-invoices/review/[id]` route (`ReviewForm` + `PreviewPane` + `review-form-state.ts`; `_components/ReviewHeader`, `DuplicatesWarning`, `rowToReviewInput`) → `confirmReceivedInvoice`; `extractionConfidence` (`schema.ts:454`); delete (61bea2c). **New:** a **manual разход** quick-entry screen (`ExpenseManualEntry` — received invoices have *no* manual-create path today, only upload), the plain category picker, and the plain "какво се осчетоводява" summary variant of `ReviewForm`.

```
┌ ➕ Нов разход ─────────────────────────────────────────────── [ x ] ┐
│  ( ● Качи фактура/снимка )   ( ○ Въведи ръчно )                       │
│  ┌ Качи ─────────────────────────────────────────────────────────┐  │
│  │  ⬆  Пусни PDF/снимка тук — разчита се автоматично              │  │
│  │     (ReceivedInvoiceUploader; OCR във фонов режим)             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  … → отваря прегледа (ReviewForm) когато е готово ↓                    │
└──────────────────────────────────────────────────────────────────────┘
```

After OCR (or in "Въведи ръчно"), the review shows the **owner-plain confirmation**, not the accountant grid:

```
┌ Прегледай разхода ───────────────────────────── увереност: висока ┐
│  Доставчик:  [ Мобилтел ЕАД · ЕИК 831642181 ]     (supplierSnapshot)│
│  Дата: [03.07.2026]   № на документа: [ 0000123456 ]               │
│  Тип: ( ● Фактура ) ( ○ Кредитно известие )  ← NEW received docType │
│                                                                     │
│  Какво е това? (за да го отчетем правилно)                          │
│   ┌────────┐┌────────┐┌──────────┐┌────────┐┌────────┐             │
│   │🧰 Услуга││📦 Стока ││🧱 Материал││🖥 Актив ││➕ Друго │            │
│   └────────┘└────────┘└──────────┘└────────┘└────────┘             │
│  Суми:  Основа 1 000.00   ДДС 200.00   Общо 1 200.00                 │
│                                                                     │
│ ┌ Какво се осчетоводява ───────────────────────────────────────────┐│
│ │ Дължиш на доставчика 1 200.00 лв.                                 ││
│ │  • 1 000.00 лв  разход (външна услуга)                            ││
│ │  • 200.00 лв   ДДС, което ще си приспаднеш от НАП (покупки)       ││
│ │  ✅ Записано правилно (Дебит = Кредит)          [ виж като счетоводител ]│
│ └───────────────────────────────────────────────────────────────────┘│
│         [ Запази чернова ]        [  Потвърди и осчетоводи  ]         │
└──────────────────────────────────────────────────────────────────────┘
```

**Category → account (hidden).** The owner picks a plain "what is this"; the engine maps category → `basis` → debit account and defaults the VAT op to `purchase_full_20` (full credit 20%). See §A4 for the consolidated seam; Part B §B3 for the resolver.

**Confidence-gated review queue (market move 3).** High-confidence extraction → a pre-filled draft ready to one-tap post. Low-confidence (`extractionConfidence`, `schema.ts:454`) → the item lands in a **"За преглед"** lane with the suggestion pre-filled but **not auto-posted**.

**Guards that route to `изисква преглед от счетоводител` (held draft, never owner-posted):**
- **Supplier credit note** (`received_invoices.docType`, `PLAN §2.3-A2`, stress #5) — owner marks the "Кредитно известие" radio; the engine signs it negative. If OCR detects a CN the owner missed → hold.
- **Foreign supplier** (frozen `supplierSnapshot.country ≠ BG`, #9) or a **reverse-charge hint** (#7) → hold; ВОП/чл.117/чл.82 is accountant-only (v2).
- **Low `extractionConfidence`** (#22) → may pre-fill, **may not auto-post**.
- **Exempt company** (owner makes exempt supplies) → do **not** default full credit; hold for credit-right review (#7).

Owner default stays the honest 95% case (domestic full-credit 20%); everything exotic is quietly deferred to the accountant **without blocking the owner from recording the money** — it still lands in every KPI as Прогноза.

> **Backlog (auto-categorize from history, QuickBooks pattern).** Once a supplier's expenses are booked to a `basis`, default the same mapping next time — a lightweight "last used basis for this `partnerId`" memory makes repeat разходи one-tap, no AI. Log to `REVIEW_QUEUE`/`REFACTOR_BACKLOG` as `OWN-MEM-1`.

---

## A3. `➕ Приход` — owner quick-create for revenue (Deliverable 1b)

A **Приход = an outgoing invoice.** The owner's screen is the existing invoice form, re-sequenced into **three plain questions + a plain accounting summary**. Дт/Кт never appear.

**Reuses:** the `…/invoices/new` route (`invoices/new/page.tsx` + `use-invoice-form.ts`) with its `_components/` cards — `RecipientCard`, `LineItemsCard`, `TotalsCard`, `DocumentCard`, `NotesCard`, `PaymentCard`, `ActionsBar`, and **`NoVatReasonPicker`** (the `VAT_EXEMPTION_GROUNDS` picker, inside `LineItemsCard`); `createInvoiceDraft` / `finalizeInvoice`; manual number (f2f5423). **New:** `PlainCategoryPicker` (the Основание cards), `PlainVatQuestion` (the ДДС radio over `NoVatReasonPicker`), `WhatGetsPostedSummary` ("какво се осчетоводява"), and auto-derive of the контировка on finalize.

```
┌ ➕ Нов приход ───────────────────────────────────────────────────────────── [ x ] ┐
│  1  На кого продаваш?                                                              │
│     [ Търси клиент…  ▾ ]   или  [ + Нов клиент ]        (RecipientCard, reused)    │
│     » Контрагент ООД · ЕИК 123456789 · ДДС BG123456789                             │
│                                                                                    │
│  2  Какво продаваш?                                                                │
│     ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌───────┐ ┌────────┐                     │
│     │ 🧰 Услуга│ │ 📦 Стока │ │🏭 Продукция│ │🏠 Наем │ │ ➕ Друго │  ← plain cards    │
│     └─────────┘ └─────────┘ └───────────┘ └───────┘ └────────┘                     │
│     [ Описание/артикул… ]  [ К-во ][ Ед.цена ]        (+ ред)   (LineItemsCard)    │
│                                                                                    │
│  3  ДДС?                                                                            │
│     ( ● 20% стандартно )  ( ○ 9% )  ( ○ Без ДДС / 0% … )                            │
│        └ if „Без ДДС": Защо? ▾  ┌──────────────────────────────────────────────┐   │
│              ( ) Износ извън ЕС            ( ) Продажба към фирма в ЕС (ВОД)     │   │
│              ( ) Услуга към фирма в ЕС     ( ) Освободена дейност (здраве/…)     │   │
│              ( ) Друго — ще уточня  ← free text → held for accountant           │   │
│                                                                                    │
│  Дата: [05.07.2026]   Валута: EUR    ▸ Още (номер, дата на събитие, забележка)     │
│                                                                                    │
│ ┌ Какво се осчетоводява ────────────────────────────────────────────────────────┐ │
│ │ Клиентът ти дължи 2 041.88 лв.                                                  │ │
│ │  • 1 701.57 лв  приход от услуга                                                │ │
│ │  • 340.31 лв   ДДС, което ще внесеш в НАП (продажби)                            │ │
│ │  ✅ Записано правилно (Дебит = Кредит)                     [ виж като счетоводител ]│ │
│ └────────────────────────────────────────────────────────────────────────────────┘ │
│        [ Запази чернова ]        [  Издай и осчетоводи  ]                           │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**The plain ДДС question is a skin over `VAT_EXEMPTION_GROUNDS`.** Each "Защо без ДДС?" radio writes the **exact `ref`** into `noVatReason`, so `deriveExemptVatOperation` (`PLAN §2.3-F`, the #2 keying fix) resolves the операция + клетка. The curated grounds (verified in `vat-grounds.ts`) and their plain labels:

| Plain radio (owner) | Exact `ref` written | Engine op | СД клетка | VIES |
|---|---|---|---|---|
| Продажба към фирма в ЕС (ВОД) | `ЗДДС, чл. 53, ал. 1` | `sale_ics_0` | кл.15 | ✓ |
| Услуга към фирма в ЕС | `ЗДДС, чл. 21, ал. 2` | `sale_eu_services_rc` | кл.17 | ✓ |
| Износ извън ЕС | `ЗДДС, чл. 28` | `sale_export_0` | кл.14 | – |
| Международен транспорт | `ЗДДС, чл. 30` | `sale_intl_transport_0` (**v2** → until then `unclassified`) | кл.16 | – |
| Освободена дейност (здраве/образование/финанси/имоти/застраховка) | `ЗДДС, чл. 39/40/41/44/45/46` | `sale_exempt` | кл.19 | – |
| **Друго — ще уточня** (free text) | free text | **`unclassified` → held draft** | — | – |

> **Note — no domestic reverse-charge ground (чл.163а, зърно/отпадъци) and no generic "outside scope" in the curated list.** Those route through **Друго → `unclassified` → accountant**. This is correct: never silent-default such a sale to `sale_std_20`, and **never** to `no_vat_out_of_scope` (which sets `register=NULL` and drops it from кл.19). Stress #7 safety.

**Post behaviour (honors `ANALYSIS` Q1 + stress #19).**
- **`Издай и осчетоводи`** = `finalizeInvoice` **then** auto-derive + `post` in one transaction, **iff** the op is confidently classified and the period is open → "✅ Осчетоводено".
- If op = `unclassified` / mixed-rate needing review / an unconfirmed VIES EU sale → finalize the invoice but leave the контировка **draft**, banner *"Издадено. Осчетоводяването изчаква преглед от счетоводител (неясно ДДС основание)."* The amount is still in every KPI as Прогноза.
- **`Запази чернова`** = invoice draft only, no posting. **`виж като счетоводител`** = the raw Меню Контиране on this entry.

---

## A4. The plain-language category → account mapping (the hidden seam)

This is market move 2 made concrete. The owner picks a **category card**; the engine resolves `basis → account` (revenue on a sale, expense/asset on a purchase) and the default VAT op. **The owner never sees a number** — labels like *Външна услуга / Стока / Материал* stand in for `602/304/601`. Full resolver in Part B §B3 (`BASIS_TO_ACCOUNT`); this is the owner-facing projection:

| Owner category | `basis` | Sale → 70x (Приход) | Default sale op | Purchase → 60x/30x/20x (Разход) | Default purchase op |
|---|---|---|---|---|---|
| 🧰 Услуга | `services` | **703** Приходи от услуги | `sale_std_20`/`_9` | **602** Външни услуги | `purchase_full_20` |
| 📦 Стока | `goods` | **702** Приходи от стоки | `sale_std_20` | **304** Стоки | `purchase_full_20` |
| 🏭 Продукция | `production` | **701** Приходи от продукция | `sale_std_20` | **601** Материали¹ | `purchase_full_20` |
| 🧱 Материал | `materials` | **706** Приходи от материали | `sale_std_20` | **601**/**302** Материали | `purchase_full_20` |
| 🖥 Актив (ДМА) | `fixed_asset` | **705** Приходи от ДА | `sale_std_20` | **20x** ДМА (204…) | `purchase_full_20` |
| 🏠 Наем | `services` +704² | **704** Приходи от наеми² | `sale_std_20` | **602** Външни услуги | `purchase_full_20` |
| ➕ Друго | `other` | **709** Други приходи | `sale_std_20` | **609** Други разходи | `purchase_full_20` |

> **Owner cards are a presentation layer over the 6 canonical bases.** The engine enum is **`ACCOUNTING_BASES = ['services','goods','production','materials','fixed_asset','other']`** — WIRING §2.3-B's 6-value list, which **wins over** any 7-value variant. The seven owner cards map onto those six via `OWNER_CATEGORIES` (§B3): six cards are 1:1, and **🏠 Наем is not a distinct basis** — it selects `services` (наем is a услуга for ДДС) and pre-points the *revenue* leg to `704`, exactly the re-pointable default `PLAN §2.3` describes.

¹ Продукция is not "bought"; a purchase under this basis maps to materials `601`. ² `704 Наеми` is non-standard (наеми usually 703/706/709) and is **not** a canonical basis; the Наем card rides the `services` basis with a 704 revenue override, re-pointable in the editable chart.

**Rules that keep the seam honest (`WIRING §2.1/§2.2`, `PLAN §3.3`):**
- The category default comes from `articles.type` / line text (weak — defaults `'service'`), and is **always human-confirmable**. Changing the card live re-points the `70x`/`60x` leg.
- **Sales VAT op** derives from `vatMode` + line `vatRate` + `noVatReason` via `deriveExemptVatOperation`; unknown/free-text ground → `unclassified` → manual, **never** silent `sale_std_20`.
- **Purchase VAT op is not derivable** → defaults `purchase_full_20`, mandatory confirm, `extractionConfidence`-gated.
- The VAT leg (`4531`/`4532`) is **omitted entirely** when `companies.isVatRegistered = false` (`schema.ts:59`, `PLAN §B5`).

---

## A5. The aggregated owner dashboard (Deliverable 2)

**Reuses & extends** the `…/dashboard` route (`dashboard/page.tsx`) and its `_components/`: `MetricsSummary` + `MetricCard` (already render Приходи/Вземания/Платени разходи/Задължения), `MonthCloseCard`, `InvoiceBreakdownCard`/`ReceivedBreakdownCard`, `ActivityFeed`, `QuickLinksCard`; data from `_components/queries.ts` (`getCompanyMetrics:38`, `getCompanyExpenseMetrics:193`, `getMonthCloseStatus:98`) + `getVatSummary` (`actions.ts:1451`). **New components:** `ProfitCard` (Печалба, caveated), `VatObligationCard` (Прогноза↔Реално badge + dated срок), `CashProxyCard` (Каса proxy), `PeriodSelector`, and **`HealthPanel`** (§A6).

```
┌ Табло · «Моята Фирма ЕООД»                Период: [ Този месец ▾ ]   [➕ Приход][➕ Разход] ┐
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────────────┐ ┌───────────────────────┐ │
│  │ ПРИХОДИ        │ │ РАЗХОДИ        │ │ ПЕЧАЛБА (прогнозна) ⓘ  │ │ ДДС                    │ │
│  │ 12 480.00 EUR ▸│ │  7 210.00 EUR ▸│ │  5 270.00 EUR         ▸│ │ за внасяне 2 360.00 ▸ │ │
│  │ 24 документа   │ │ 15 документа   │ │ без себест./заплати ⓘ  │ │ 🟡 Прогноза · срок 14.08│ │
│  └───────────────┘ └───────────────┘ └────────────────────────┘ └───────────────────────┘ │
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────────────┐                            │
│  │ ВЗЕМАНИЯ       │ │ ЗАДЪЛЖЕНИЯ     │ │ КАСА (нето постъпления)│  ← proxy, labelled         │
│  │  3 900.00 EUR ▸│ │  1 450.00 EUR ▸│ │  +2 010.00 EUR       ▸ │                            │
│  │ клиенти дължат │ │ дължиш на дост.│ │ реален баланс: v2      │                            │
│  └───────────────┘ └───────────────┘ └────────────────────────┘                            │
│  ┌ Всичко изрядно?  (health panel — §A6) ────────────────────────────────────────────────┐ │
│  │ 🟢 Готово за НАП · Дебит = Кредит ✅ · 0 за преглед · 0 неясни · 11/11 осчетоводени …   │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│  ↳ Последни документи · Активност                                                          │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**The seven KPI cards — five money questions + two разчети — each drill-down-able:**

| Card | Number (accrual, base ccy, CN-signed) | Source today | Drill-down |
|---|---|---|---|
| **Приходи** | Σ net revenue = Σ `70x` credit (posted) / else Σ `totals.netAmount` finalized non-proforma | `money.ts` signed sums | → Приходи list / Дневник продажби (plain) |
| **Разходи** | Σ net expense = Σ `60x/30x` debit (posted) / else Σ received `netAmount` | expense metrics | → Разходи list / Дневник покупки (plain) |
| **Печалба (прогнозна) ⓘ** | Приходи − Разходи | derived | → side-by-side breakdown |
| **ДДС** | `getVatSummary` **Прогноза**; **Реално** кл.50/60 once posted+closed; a **dated obligation** | `getVatSummary` → `journal_tax_lines` | → Данъци/ДДС month drill (§A5.4) |
| **Вземания** | Σ outstanding on issued (`411`) | `outstandingSumSql` | → неплатени фактури |
| **Задължения** | Σ outstanding on received (`401`) | `expensesOutstanding` | → неплатени разходи |
| **Каса (нето постъпления) ⓘ** | collected gross − paid gross (cash-basis **proxy**) | `collectedSumSql` − paid | → плащания; note "реален касов/банков баланс идва с плащанията (v2)" |

### A5.1 The Печалба caveat (COGS-incomplete — honest, stress #23 / `PLAN §B2`)

Печалба wears a permanent ⓘ: **"Печалбата е приблизителна — не включва себестойността на продадени стоки, заплати и амортизации, които се завеждат отделно."** For a services SMB it is ~correct; for a goods trader it is overstated (`304` not relieved). Invoicly is "a layer that posts VAT," not a full P&L (`WIRING §1.6`) — the dashboard says so rather than implying a clean net result. **The trusted products win by not over-claiming** (FreeAgent's scope-limit disclaimer); we keep this a first-class label, not fine print.

### A5.2 Прогноза ↔ Реално — the trust-critical badge (hard swap)

Every ДДС number wears one of two badges, **never both** — it is a hard swap, not additive (`WIRING §3` "Verified SOUND"):
- 🟡 **Прогноза** — from `getVatSummary`; shown until *all* the month's docs are posted **and** the month is closed. Sub-label `8/11 осчетоводени`.
- 🟢 **Реално (осчетоводено)** — the кл.50/60 from `journal_tax_lines`, once posted+closed. v1 locks `vatPeriod = issueDate month`, so the two buckets reconcile exactly (`PLAN §F4`) and the flip cannot double-count.

Where they legitimately differ (частичен ДК, reverse-charge, годишна корекция — `PLAN §5.2`), the drill-down explains it in plain BG so the owner is not alarmed by a moving number.

### A5.3 Дължимо ДДС as a **dated** obligation (FreeAgent Tax-Timeline pattern)

The single strongest "am I in order?" pattern found: show tax owed **forward-looking, with a due date**, not just a number. The ДДС card reads *"ДДС за внасяне ~2 360.00 лв — срок 14.08.2026"*, filterable All/Upcoming/Paid, mark-filed inline. НАП anchors: ДДС декларация + дневници due the **14th** of the next month; VIES the **14th**; ГДД annual. This is the read layer that becomes the **filing calendar** in Part C §G6.

### A5.4 Данъци/ДДС drill-down (evolves the existing `/vat` page, `PLAN §4.1`)

The current `/vat` SWR table (`{month, vatIssued, vatPaid, vatNet}`) becomes **expandable per month** — Slice 1 read-only, growing the post action in Slice 2:

```
▼ Юли 2026   ДДС продажби 3 480   ДДС покупки 1 120   ДДС за внасяне 2 360   🟡 Прогноза · 8/11 · срок 14.08   [ Приключи месеца ]
   [ Приходи ] [ Разходи ]                                       (Дневник/Декларация live in Счетоводител lens)
   Приходи (продажби)
    № 0000000123  05.07  Контрагент ООД  ЕИК 123…  основа 1 701.57  ДДС 340.31  20%   ✅ Осчетоводено
    № 0000000124  09.07  Друг ЕООД        ЕИК 456…  основа   900.00  ДДС   0.00  ВОД  🟡 Чернова  [ Осчетоводи ]
    № 0000000125  …                                                                   ⚪ Не е осчетоводено
   Разходи (покупки) …
   ↳ Реално за внасяне (щом всичко е осчетоводено и месецът е приключен): 2 360.00
```

Chip states ⚪ Не е осчетоводено → 🟡 Чернова → ✅ Осчетоводено.

### A5.5 Segmentation (later — Holded analytical tags)

For "aggregated data sliceable by dimension," a later enhancement adds analytical tags (project/cost-center) over the P&L so the owner can break приходи/разходи down without touching accounts. Backlog `OWN-SEG-1`; not v1.

---

## A6. "Всичко изрядно?" — the transparency / trust health system (Deliverable 3)

This is the owner's headline requirement: **KNOW everything is in order and transparent.** It ships as **`HealthPanel`** (a new `dashboard/_components/HealthPanel.tsx` that supersedes/absorbs `MonthCloseCard`, TRANS-2) rendering a red/green verdict from a single `getHealthStatus(companyId, period)` aggregate in `_components/queries.ts` — the Xero-reconcile-panel pattern adapted to контировка. It sits on the `…/dashboard` route (Собственик lens) and each signal deep-links to the exact list it counts.

```
┌ Всичко изрядно?  ·  Месец юли 2026                                    🟢 Готово за НАП ┐
│  ✅ Счетоводството е балансирано            Σ Дебит 48 210.00 = Σ Кредит 48 210.00     │  ← оборотна ведомост self-check
│  ✅ Няма получени фактури за преглед         0 непроверени                              │
│  ✅ Всички документи са осчетоводени          11 / 11   ▓▓▓▓▓▓▓▓▓▓ 100%                 │  ← posted vs draft meter
│  ✅ Всички основания са ясни                  0 документа изискват преглед              │  ← unclassified / непосочени
│  ✅ Прогноза = Реално ДДС                     2 360.00 = 2 360.00                        │  ← reconciliation, plain
│  🔓 Период юли: отворен                       [ Приключи месеца ]                        │  ← accounting_periods
│  👥 Прегледано от счетоводител                 да · Иван · 08.08                          │  ← accountant-review state
│                                                                                        │
│  Последни счетоводни действия:                                            [ виж всички ]│
│   • Иван осчетоводи № 0000000123 · преди 2 ч                                            │  ← activityLogs (post/reverse/close)
│   • Иван потвърди разход от Мобилтел · преди 3 ч                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**The signals — each links to the exact list it counts:**

1. **Оборотна ведомост self-check — Σ Дт = Σ Кт.** The free, strong integrity test (`WIRING §1.6`: Σ обороти Дт = Σ обороти Кт = хронологичен-регистър total). Green normally (the balance trigger guarantees it); **🔴 "Има несъответствие — свържи се със счетоводител"** if ever broken (a bug/tamper signal). The owner's bedrock "it adds up."
2. **N непроверени** = received invoices still `draft` (`pendingReviewCount`). → received list.
3. **N неосчетоводени** = finalized/confirmed docs not yet posted (`outgoingPendingAccounting + receivedPendingAccounting`), shown as a **posted/draft meter** X/Y.
4. **N с неясно основание/ДДС** = entries with `vatOperation='unclassified'`, missing `basis`, or owner-overridden `изисква преглед` (the #19/#7 safety count — the "Ask my accountant" holding bucket surfaced). → the filtered list the accountant clears.
5. **Прогноза = Реално** = the plain reconciliation (`PLAN §5.1` triple-check surfaced). If diverging, a plain "защо?" (частичен ДК / обратно начисляване…).
6. **Период отворен/затворен** = `accounting_periods` state. `Приключи месеца` writes the `vat_close` entry, flips Прогноза→Реално, and locks кл.50 (`PLAN §5.1`, Slice 4). Closed shows "затворен на 14.08 от Иван" + a controlled reopen (accountant only; reverses the close, #20).
7. **Прегледано от счетоводител** = the accountant-review state (Part C §G4). When the accountant opens Меню Контиране and clears an owner draft's `изисква преглед`, this ticks ✅ — the Zoho collaboration pattern, made a trust signal.

**Verdict line (top-right):** 🟢 **Готово за НАП** (balanced, 0 unreviewed, 0 unclassified, all posted or safely deferred) · 🟡 **Има недовършено (N)** · 🔴 **Има несъответствие** (balance broken). One glance = *"I KNOW it is in order."*

**Transparency-as-immutability (Zoho un-disableable audit trail).** `activityLogs` (`schema.ts:563`) records every `post`/`reverse`/`close` — who, what, when — surfaced as the human-readable feed above. Posted entries are **immutable**; a mistake is corrected by a **reversing (сторно) entry**, never a silent edit (`PLAN §2.4.2`). "Correction-by-reversal, attributable and immutable" is exactly the transparency the owner asked for.

> **The posting-existence guards are a trust *requirement*, not just plumbing.** The market's promise is "a posted entry is locked and correct." That is only truthful if `accountingStatus` cannot silently unlatch a filed row. Close stress **#1/#3/#4** (key edit/delete/cancel/toggle guards on *posting existence*, not the user-togglable `accountingStatus`) **before** any "Всичко изрядно" green can be honest. This is the Slice-2 gate.

---

## A7. How the owner layer neutralizes the owner-risk stress findings

| Finding | Owner-UX mitigation |
|---|---|
| **#19 owner mis-posting** | Owner picks plain category + plain ДДС answer; the **engine, not the human, resolves account/клетка** → a balanced-but-wrong hand posting is impossible. Unclassifiable → held draft `изисква преглед`; count surfaced in the health panel. |
| **#7 exempt-company / unmapped ground** | Exempt company → purchases **not** defaulted to full credit (held); unmapped `noVatReason` → `unclassified` (ledgered/held), never `no_vat_out_of_scope` (register=NULL). |
| **#9 `'BG'` coercion / foreign supplier** | Foreign frozen `supplierSnapshot.country` → hold as draft; classify off the **frozen snapshot**, not the mutable partner row. |
| **#5 received credit note as +ДК** | "Тип: Фактура / Кредитно известие" radio + OCR detect → engine signs negative. |
| **#22 OCR 0 lines** | Require ≥1 rated line + `extractionConfidence` gate before a purchase can auto-post. |
| **#1/#3/#4 togglable lock** | Owner delete/edit/cancel key on **posting existence**, not `accountingStatus`; a posted doc is locked until reversed (accountant). |
| **#20 backdate after close** | Health panel keeps the estimate population + shows "N добавени след приключване" + accountant-only reopen. |
| **#23 COGS-incomplete** | Печалба wears a permanent caveat; never presented as a clean финансов резултат. |
| **#27 settlement unposted** | "Каса" is labelled a proxy; the real `501/503` balance is deferred to v2 with an explicit note. |

---

# PART B — СМЕТКОПЛАН & ACCOUNT PICKER

## B0. Decisions up front

### Decision 0 — curated **MVP subset (66 synthetic accounts)**, NOT the full ~200-row national chart

Anchored to the docs:
- **The engine only ever auto-posts to three axes** (`WIRING §1.7/§1.8`, `PLAN §3.1`): the VAT leg (`4531/4532/4538/4539`), the P&L/запаси leg (`70x`/`60x`/`30x`/`20x` by Основание), and `411`/`401`. Every national account outside that reach (биологични активи `27x/31x`, репутация `23x`, финансови инструменти `226/511`, консигнация `912`, the **entire клас 9 задбалансови**) would be dead rows an invoicing+VAT product never targets. Seeding them bloats the picker and invites mis-selection (stress #19: a non-accountant can already mis-map inside a *small* list).
- **`PLAN §2.3` + `WIRING §1.5` already mandate this:** v1 ships `BG_CHART_OF_ACCOUNTS` as a national-synthetic constant, snapshots `code+name` onto each line, and defers the editable per-company chart. The subset = "the national codes we can post to, or a счетоводител would pick for an invoice-driven business."
- **It stays extensible:** the picker groups by КЛАС→ГРУПА, so adding the rest of the national chart later (or the editable table) is **additive — no migration**, because lines never FK the chart (§B4). The seed below is a deliberately *complete working set* (adds `303` per `WIRING P13`, `624/724` for FX, `123` for the year-end result, loans/payroll/tax accounts owners actually use), not a bare minimum.

### Decision 0b — currency аналитични: **NONE in the v1 seed** (synthetic-only); reconcile the `453/1·453/2` mislabel

The context lists `453/1·453/2` alongside `411/1·411/2` as "currency аналитични" — **that is a conflation.** In `ANALYSIS.md`, `453/1` = ДДС **покупки** and `453/2` = ДДС **продажби** — a **purchase-vs-sale** split, i.e. exactly the national `4531`/`4532`, **not** a currency split. VAT is filed and settled in the **reporting/base currency only** (BGN pre-2026, EUR from 2026 per `euro-adoption-2026.md`), so VAT accounts never carry a per-currency аналитичен.

| Need | v1 answer | Why |
|---|---|---|
| **Cash / bank FX** | Use the national synthetics: `501` каса лв vs **`502` каса вал**, `503` банка лв vs **`504` банка вал**. No `501/1·501/2`. | The BG chart splits lev-cash from FX-cash **at the synthetic level**. Pick the right synthetic. |
| **411 / 401 / 402 / 412** (разчети) | **Single synthetic in v1** (`411`, not `411/1·411/2`). Currency lives on the *line* as `amount` (doc ccy) + `amountBase` (× frozen `fxRate`) + `currency` (`PLAN §2.5`). | Under GEN-1 single base currency, a parallel `/1·/2` tree duplicates line data and risks `синтетична ≠ Σ аналитични` drift (`WIRING §1.5`). Reports stay correct at the synthetic level. Tag these `fxAnalytic:true` for the later editable slice. |
| **4531/4532/4538/4539** (VAT) | **Never a currency аналитичен.** Canonical = national **4-digit**; `453/x` is a **display alias** only. | Filed in reporting currency; `WIRING` uses the 4-digit codes throughout and **wins on conflict** with `ANALYSIS`'s `453/x`. |

So: **v1 seed = national synthetic codes, no currency sub-accounts.** Accounts that *would* sprout a per-currency аналитичен when the editable chart lands are tagged `fxAnalytic:true` (`411, 401, 402, 412` — the монетарни разчети that can hold an FX balance); cash/bank don't need it (`502/504` exist), VAT/revenue/expense never get it.

---

## B1. The `BG_CHART_OF_ACCOUNTS` seed — organised клас → група → синтетична

File: `src/features/kontirovka/chart-of-accounts.ts`. One typed shape drives the **picker** (`class`/`group` grouping, `code`/`name` display), the **engine** (`type`/`normalSide`/`isVat`/`autoPostable`), and the **future editable chart** (`fxAnalytic`/`contra`). Column legend: **Type** ∈ {asset, liability, equity, revenue, expense}; **Normal** = normal (closing) balance side (Dr→debit, Cr→credit, same vocabulary as `journalLines.side`); **Curr-ан.** = `fxAnalytic` (may carry a per-currency `/1·/2` аналитичен in the editable slice); **Auto** = `autoPostable` (the engine can target it; others are picker-only); **Alias** = accountant display alias; **Tier** ∈ {core = auto-posted v1, ext = grounds-derived v1, v2, picker = manual-only}.

### КЛАС 1 · Капитал и заеми

| Code | Name | Група | Type | Normal | Curr-ан. | Auto | Tier |
|---|---|---|---|---|:--:|:--:|---|
| 101 | Основен капитал | 10 Капитал | equity | Cr | – | – | picker |
| 123 | Печалби и загуби от текущата година | 12 Фин. резултати | equity | Cr | – | – | v2 (year-end) |
| 151 | Получени краткосрочни заеми | 15 Заеми | liability | Cr | – | – | picker |
| 152 | Получени дългосрочни заеми | 15 Заеми | liability | Cr | – | – | picker |

### КЛАС 2 · Дълготрайни активи (Dr on ДМА/ДНА purchases)

| Code | Name | Група | Type | Normal | Curr-ан. | Auto | Tier |
|---|---|---|---|---|:--:|:--:|---|
| 201 | Земи (терени) | 20 ДМА | asset | Dr | – | – | picker |
| 202 | Сгради и конструкции | 20 ДМА | asset | Dr | – | – | picker |
| 203 | Компютърна техника | 20 ДМА | asset | Dr | – | – | picker |
| 204 | Съоръжения | 20 ДМА | asset | Dr | – | ✓ | v1 (fixed_asset default) |
| 205 | Машини и оборудване | 20 ДМА | asset | Dr | – | – | picker |
| 206 | Транспортни средства | 20 ДМА | asset | Dr | – | – | picker |
| 207 | Офис обзавеждане | 20 ДМА | asset | Dr | – | – | picker |
| 209 | Други ДМА | 20 ДМА | asset | Dr | – | – | picker |
| 212 | Програмни продукти | 21 ДНА | asset | Dr | – | – | picker |
| 213 | Права върху интелектуална собственост | 21 ДНА | asset | Dr | – | – | picker |
| 214 | Права върху индустриална собственост | 21 ДНА | asset | Dr | – | – | picker |
| 219 | Други ДНА | 21 ДНА | asset | Dr | – | – | picker |
| 241 | Амортизация на ДМА | 24 Амортизации | asset (**contra**) | Cr | – | – | v2 (depreciation) |
| 242 | Амортизация на ДНА | 24 Амортизации | asset (**contra**) | Cr | – | – | v2 (depreciation) |

### КЛАС 3 · Материални запаси (Dr on stock purchases; Cr on COGS relief)

| Code | Name | Група | Type | Normal | Curr-ан. | Auto | Tier |
|---|---|---|---|---|:--:|:--:|---|
| 301 | Доставки | 30 Запаси | asset | Dr | – | – | picker |
| 302 | Материали | 30 Запаси | asset | Dr | – | ✓ | v1 (materials) |
| 303 | Продукция | 30 Запаси | asset | Dr | – | – | v2 (production COGS — `WIRING P13`) |
| 304 | Стоки | 30 Запаси | asset | Dr | – | ✓ | v1 (goods) |

### КЛАС 4 · Разчети

| Code | Name | Група | Type | Normal | Curr-ан. | Auto | Alias | Tier |
|---|---|---|---|---|:--:|:--:|:--:|---|
| 401 | Задължения към доставчици | 40 Доставчици | liability | Cr | ✓ | ✓ | – | **core** (purchase Cr leg) |
| 402 | Вземания от доставчици по аванси | 40 Доставчици | asset | Dr | ✓ | – | – | v2 (advances) |
| 411 | Вземания от клиенти | 41 Клиенти | asset | Dr | ✓ | ✓ | – | **core** (sale Dr leg) |
| 412 | Задължения към клиенти по аванси | 41 Клиенти | liability | Cr | ✓ | – | – | v2 (advances) |
| 421 | Задължения към персонал | 42 Персонал | liability | Cr | – | – | – | picker (manual JE) |
| 422 | Разчети с подотчетни лица | 42 Персонал | asset | Dr | – | – | – | picker |
| 452 | Разчети за корпоративни данъци | 45 Бюджет | liability | Cr | – | – | – | picker |
| **4531** | ДДС на покупките | 45 Бюджет | asset | Dr | – | ✓ | 453/1 | **v1** (input VAT) |
| **4532** | ДДС на продажбите | 45 Бюджет | liability | Cr | – | ✓ | 453/2 | **core** (output VAT) |
| **4538** | ДДС за възстановяване | 45 Бюджет | asset | Dr | – | – | 453/8 | v1 (close result) |
| **4539** | ДДС за внасяне | 45 Бюджет | liability | Cr | – | – | 453/9 | v1 (close result) |
| 454 | Разчети за данъци върху доходи на ФЛ | 45 Бюджет | liability | Cr | – | – | – | picker |
| 461 | Разчети за задължително социално осигуряване | 46 Осигурители | liability | Cr | – | – | – | picker |
| 463 | Разчети за здравно осигуряване | 46 Осигурители | liability | Cr | – | – | – | picker |
| 498 | Други дебитори | 49 Разни | asset | Dr | – | – | – | picker |
| 499 | Други кредитори | 49 Разни | liability | Cr | – | – | – | picker |

### КЛАС 5 · Финансови средства (settlement v2; FX split built into the chart)

| Code | Name | Група | Type | Normal | Curr-ан. | Auto | Tier |
|---|---|---|---|---|:--:|:--:|---|
| 501 | Каса в левове | 50 Парични средства | asset | Dr | – | – | v2 (settlement) |
| 502 | Каса във валута | 50 Парични средства | asset | Dr | – | – | v2 |
| 503 | Разплащателна сметка в левове | 50 Парични средства | asset | Dr | – | – | v2 |
| 504 | Разплащателна сметка във валута | 50 Парични средства | asset | Dr | – | – | v2 |
| 509 | Други парични средства | 50 Парични средства | asset | Dr | – | – | picker |

### КЛАС 6 · Разходи (Dr leg on purchases, by Основание)

| Code | Name | Група | Type | Normal | Auto | Tier |
|---|---|---|---|---|:--:|---|
| 601 | Разходи за материали | 60 По елементи | expense | Dr | ✓ | v1 (materials/production) |
| 602 | Разходи за външни услуги | 60 По елементи | expense | Dr | ✓ | **v1 DEFAULT purchase** |
| 603 | Разходи за амортизация | 60 По елементи | expense | Dr | – | v2 (depreciation) |
| 604 | Разходи за заплати | 60 По елементи | expense | Dr | – | picker (manual JE) |
| 605 | Разходи за осигуровки | 60 По елементи | expense | Dr | – | picker (manual JE) |
| 606 | Разходи за данъци, такси и подобни | 60 По елементи | expense | Dr | – | picker |
| 609 | Други разходи | 60 По елементи | expense | Dr | ✓ | v1 (чл.70 fallback / представителни / Друго) |
| 611 | Разходи за основна дейност | 61 За дейността | expense | Dr | – | picker |
| 614 | Административни разходи | 61 За дейността | expense | Dr | – | picker |
| 615 | Разходи за продажби | 61 За дейността | expense | Dr | – | picker |
| 621 | Разходи за лихви | 62 Финансови | expense | Dr | – | picker |
| 624 | Разходи от валутни операции | 62 Финансови | expense | Dr | – | v2 (курсови разлики) |
| 629 | Други финансови разходи | 62 Финансови | expense | Dr | – | picker |

### КЛАС 7 · Приходи (Cr leg on sales, by Основание)

| Code | Name | Група | Type | Normal | Auto | Tier |
|---|---|---|---|---|:--:|---|
| 701 | Приходи от продажби на продукция | 70 Продажби | revenue | Cr | ✓ | v1 (production) |
| 702 | Приходи от продажби на стоки | 70 Продажби | revenue | Cr | ✓ | v1 (goods) |
| 703 | Приходи от продажби на услуги | 70 Продажби | revenue | Cr | ✓ | **v1 DEFAULT sale** |
| 704 | Приходи от наеми | 70 Продажби | revenue | Cr | ✓ | v1 (rent¹) |
| 705 | Приходи от продажби на ДА | 70 Продажби | revenue | Cr | ✓ | v1 (fixed_asset) |
| 706 | Приходи от продажби на материали | 70 Продажби | revenue | Cr | ✓ | v1 (materials) |
| 709 | Други приходи от дейността | 70 Продажби | revenue | Cr | ✓ | v1 (other) |
| 721 | Приходи от лихви | 72 Финансови | revenue | Cr | – | picker |
| 724 | Приходи от валутни операции | 72 Финансови | revenue | Cr | – | v2 (курсови разлики) |
| 729 | Други финансови приходи | 72 Финансови | revenue | Cr | – | picker |

¹ `704 Наеми` is non-standard (наеми usually 703/706/709); kept as the Наем default per `PLAN §2.3`, re-pointable in the editable chart.

**66 synthetic accounts** (4 клас-1 · 14 клас-2 · 4 клас-3 · 16 клас-4 · 5 клас-5 · 13 клас-6 · 10 клас-7). `fxAnalytic:true` on `411, 401, 402, 412` only. Cash/bank FX handled by `502/504`. VAT never carries a currency аналитичен. `autoPostable:true` on 17 accounts (the engine-targetable set): `204·302·304·401·411·4531·4532·601·602·609·701·702·703·704·705·706·709`.

### The typed shape + lookups

```ts
// src/features/kontirovka/chart-of-accounts.ts
export const ACCOUNT_TYPES = ['asset','liability','equity','revenue','expense','offbalance'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type NormalSide = 'debit' | 'credit';   // same vocabulary as journalLines.side

export interface ChartAccount {
  code: string;            // синтетична, national ('411', '4532')
  name: string;            // official БГ наименование
  class: 1|2|3|4|5|6|7|9;  // РАЗДЕЛ/КЛАС
  group: string;           // ГРУПА, 2-digit ('41','45','70')
  type: AccountType;
  normalSide: NormalSide;  // Dr → 'debit', Cr → 'credit'
  isVat?: boolean;         // 4531/4532/4538/4539 — gated by companies.isVatRegistered
  contra?: boolean;        // 24x — contra-asset (credit-normal against an asset)
  fxAnalytic?: boolean;    // may carry a per-currency /1·/2 in the editable-chart slice
  autoPostable?: boolean;  // engine may target it; others are picker-only
  alias?: string;          // accountant-familiar display alias (453/1 etc.)
}

// The full 66-row seed — copy-paste-ready. Trailing comment = Tier (core|v1|v2|picker).
export const BG_CHART_OF_ACCOUNTS: readonly ChartAccount[] = [
  // ── КЛАС 1 · Капитал и заеми ──────────────────────────────────────────────
  { code: '101',  name: 'Основен капитал',                         class: 1, group: '10', type: 'equity',    normalSide: 'credit' }, // picker
  { code: '123',  name: 'Печалби и загуби от текущата година',     class: 1, group: '12', type: 'equity',    normalSide: 'credit' }, // v2 (year-end 123 close)
  { code: '151',  name: 'Получени краткосрочни заеми',             class: 1, group: '15', type: 'liability', normalSide: 'credit' }, // picker
  { code: '152',  name: 'Получени дългосрочни заеми',              class: 1, group: '15', type: 'liability', normalSide: 'credit' }, // picker

  // ── КЛАС 2 · Дълготрайни активи ───────────────────────────────────────────
  { code: '201',  name: 'Земи (терени)',                           class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '202',  name: 'Сгради и конструкции',                    class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '203',  name: 'Компютърна техника',                      class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '204',  name: 'Съоръжения',                              class: 2, group: '20', type: 'asset', normalSide: 'debit', autoPostable: true }, // v1 (fixed_asset default)
  { code: '205',  name: 'Машини и оборудване',                     class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '206',  name: 'Транспортни средства',                    class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '207',  name: 'Офис обзавеждане',                        class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '209',  name: 'Други ДМА',                               class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '212',  name: 'Програмни продукти',                      class: 2, group: '21', type: 'asset', normalSide: 'debit' }, // picker
  { code: '213',  name: 'Права върху интелектуална собственост',   class: 2, group: '21', type: 'asset', normalSide: 'debit' }, // picker
  { code: '214',  name: 'Права върху индустриална собственост',    class: 2, group: '21', type: 'asset', normalSide: 'debit' }, // picker
  { code: '219',  name: 'Други ДНА',                               class: 2, group: '21', type: 'asset', normalSide: 'debit' }, // picker
  { code: '241',  name: 'Амортизация на ДМА',                      class: 2, group: '24', type: 'asset', normalSide: 'credit', contra: true }, // v2 (depreciation)
  { code: '242',  name: 'Амортизация на ДНА',                      class: 2, group: '24', type: 'asset', normalSide: 'credit', contra: true }, // v2 (depreciation)

  // ── КЛАС 3 · Материални запаси ────────────────────────────────────────────
  { code: '301',  name: 'Доставки',                                class: 3, group: '30', type: 'asset', normalSide: 'debit' }, // picker
  { code: '302',  name: 'Материали',                               class: 3, group: '30', type: 'asset', normalSide: 'debit', autoPostable: true }, // v1 (materials)
  { code: '303',  name: 'Продукция',                               class: 3, group: '30', type: 'asset', normalSide: 'debit' }, // v2 (production COGS — WIRING P13)
  { code: '304',  name: 'Стоки',                                   class: 3, group: '30', type: 'asset', normalSide: 'debit', autoPostable: true }, // v1 (goods)

  // ── КЛАС 4 · Разчети ──────────────────────────────────────────────────────
  { code: '401',  name: 'Задължения към доставчици',               class: 4, group: '40', type: 'liability', normalSide: 'credit', fxAnalytic: true, autoPostable: true }, // core (purchase Cr leg)
  { code: '402',  name: 'Вземания от доставчици по аванси',        class: 4, group: '40', type: 'asset',     normalSide: 'debit',  fxAnalytic: true }, // v2 (advances)
  { code: '411',  name: 'Вземания от клиенти',                     class: 4, group: '41', type: 'asset',     normalSide: 'debit',  fxAnalytic: true, autoPostable: true }, // core (sale Dr leg)
  { code: '412',  name: 'Задължения към клиенти по аванси',        class: 4, group: '41', type: 'liability', normalSide: 'credit', fxAnalytic: true }, // v2 (advances)
  { code: '421',  name: 'Задължения към персонал',                 class: 4, group: '42', type: 'liability', normalSide: 'credit' }, // picker (manual JE)
  { code: '422',  name: 'Разчети с подотчетни лица',               class: 4, group: '42', type: 'asset',     normalSide: 'debit' }, // picker
  { code: '452',  name: 'Разчети за корпоративни данъци',          class: 4, group: '45', type: 'liability', normalSide: 'credit' }, // picker
  { code: '4531', name: 'ДДС на покупките',                        class: 4, group: '45', type: 'asset',     normalSide: 'debit',  isVat: true, autoPostable: true, alias: '453/1' }, // v1 (input VAT)
  { code: '4532', name: 'ДДС на продажбите',                       class: 4, group: '45', type: 'liability', normalSide: 'credit', isVat: true, autoPostable: true, alias: '453/2' }, // core (output VAT)
  { code: '4538', name: 'ДДС за възстановяване',                   class: 4, group: '45', type: 'asset',     normalSide: 'debit',  isVat: true, alias: '453/8' }, // v1 (close result)
  { code: '4539', name: 'ДДС за внасяне',                          class: 4, group: '45', type: 'liability', normalSide: 'credit', isVat: true, alias: '453/9' }, // v1 (close result)
  { code: '454',  name: 'Разчети за данъци върху доходи на ФЛ',    class: 4, group: '45', type: 'liability', normalSide: 'credit' }, // picker
  { code: '461',  name: 'Разчети за задължително социално осигуряване', class: 4, group: '46', type: 'liability', normalSide: 'credit' }, // picker
  { code: '463',  name: 'Разчети за здравно осигуряване',          class: 4, group: '46', type: 'liability', normalSide: 'credit' }, // picker
  { code: '498',  name: 'Други дебитори',                          class: 4, group: '49', type: 'asset',     normalSide: 'debit' }, // picker
  { code: '499',  name: 'Други кредитори',                         class: 4, group: '49', type: 'liability', normalSide: 'credit' }, // picker

  // ── КЛАС 5 · Финансови средства ───────────────────────────────────────────
  { code: '501',  name: 'Каса в левове',                           class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // v2 (settlement)
  { code: '502',  name: 'Каса във валута',                         class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // v2
  { code: '503',  name: 'Разплащателна сметка в левове',           class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // v2
  { code: '504',  name: 'Разплащателна сметка във валута',         class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // v2
  { code: '509',  name: 'Други парични средства',                 class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // picker

  // ── КЛАС 6 · Разходи ──────────────────────────────────────────────────────
  { code: '601',  name: 'Разходи за материали',                    class: 6, group: '60', type: 'expense', normalSide: 'debit', autoPostable: true }, // v1 (materials/production)
  { code: '602',  name: 'Разходи за външни услуги',                class: 6, group: '60', type: 'expense', normalSide: 'debit', autoPostable: true }, // v1 DEFAULT purchase
  { code: '603',  name: 'Разходи за амортизация',                  class: 6, group: '60', type: 'expense', normalSide: 'debit' }, // v2 (depreciation)
  { code: '604',  name: 'Разходи за заплати',                      class: 6, group: '60', type: 'expense', normalSide: 'debit' }, // picker (manual JE)
  { code: '605',  name: 'Разходи за осигуровки',                   class: 6, group: '60', type: 'expense', normalSide: 'debit' }, // picker (manual JE)
  { code: '606',  name: 'Разходи за данъци, такси и подобни',      class: 6, group: '60', type: 'expense', normalSide: 'debit' }, // picker
  { code: '609',  name: 'Други разходи',                           class: 6, group: '60', type: 'expense', normalSide: 'debit', autoPostable: true }, // v1 (чл.70 fallback / представителни / Друго)
  { code: '611',  name: 'Разходи за основна дейност',              class: 6, group: '61', type: 'expense', normalSide: 'debit' }, // picker
  { code: '614',  name: 'Административни разходи',                  class: 6, group: '61', type: 'expense', normalSide: 'debit' }, // picker
  { code: '615',  name: 'Разходи за продажби',                     class: 6, group: '61', type: 'expense', normalSide: 'debit' }, // picker
  { code: '621',  name: 'Разходи за лихви',                        class: 6, group: '62', type: 'expense', normalSide: 'debit' }, // picker
  { code: '624',  name: 'Разходи от валутни операции',             class: 6, group: '62', type: 'expense', normalSide: 'debit' }, // v2 (курсови разлики)
  { code: '629',  name: 'Други финансови разходи',                 class: 6, group: '62', type: 'expense', normalSide: 'debit' }, // picker

  // ── КЛАС 7 · Приходи ──────────────────────────────────────────────────────
  { code: '701',  name: 'Приходи от продажби на продукция',        class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (production)
  { code: '702',  name: 'Приходи от продажби на стоки',            class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (goods)
  { code: '703',  name: 'Приходи от продажби на услуги',           class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 DEFAULT sale
  { code: '704',  name: 'Приходи от наеми',                        class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (rent — Наем card override)
  { code: '705',  name: 'Приходи от продажби на ДА',               class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (fixed_asset)
  { code: '706',  name: 'Приходи от продажби на материали',        class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (materials)
  { code: '709',  name: 'Други приходи от дейността',              class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (other)
  { code: '721',  name: 'Приходи от лихви',                        class: 7, group: '72', type: 'revenue', normalSide: 'credit' }, // picker
  { code: '724',  name: 'Приходи от валутни операции',             class: 7, group: '72', type: 'revenue', normalSide: 'credit' }, // v2 (курсови разлики)
  { code: '729',  name: 'Други финансови приходи',                 class: 7, group: '72', type: 'revenue', normalSide: 'credit' }, // picker
] as const;

export const BG_ACCOUNTS_BY_CODE: ReadonlyMap<string, ChartAccount> =
  new Map(BG_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
export function getAccount(code: string): ChartAccount | undefined {
  return BG_ACCOUNTS_BY_CODE.get(code);
}

// picker tree labels
export const ACCOUNT_CLASS_LABELS: Record<number, string> = {
  1:'Капитал', 2:'Дълготрайни активи', 3:'Материални запаси', 4:'Разчети',
  5:'Финансови средства', 6:'Разходи', 7:'Приходи', 9:'Задбалансови',
};
export const ACCOUNT_GROUP_LABELS: Record<string, string> = {
  '10':'Капитал', '12':'Финансови резултати', '15':'Заеми',
  '20':'ДМА', '21':'ДНА', '24':'Амортизации', '30':'Материални запаси',
  '40':'Доставчици', '41':'Клиенти', '42':'Персонал и съдружници', '45':'Разчети с бюджета',
  '46':'Разчети с осигурители', '49':'Разни дебитори и кредитори', '50':'Парични средства',
  '60':'Разходи по икономически елементи', '61':'Разходи за дейността', '62':'Финансови разходи',
  '70':'Приходи от продажби', '72':'Финансови приходи',
};
```

---

## B2. MVP-subset vs full — what's in, what's out, how to grow

**IN (v1 seed):** receivables/payables (`411/401/402/412`), all revenue `70x`, all cost-element `60x` + activity `61x` + financial `62x`, запаси `30x` (incl. `303`), VAT `4531/4532/4538/4539`, cash/bank `501–504/509`, capital/loans `101/123/151/152`, ДМА/ДНА `20x/21x` + амортизации `24x`, payroll/tax разчети (`421/422/452/454/461/463/498/499`), FX `624/724`.

**Intentionally EXCLUDED from v1** (never auto-posted by an invoicing product; add via editable chart if a client needs them): клас 1 гр.11 резерви `11x`; клас 2 биологични/репутация/финансови активи `22x/23x/27x/28x/29x`; клас 3 биологични `31x`; клас 4 търговски кредити & съдебни спорове `44x`; клас 5 краткосрочни финансови активи `51x`; клас 6/7 разходи/приходи за бъдещи периоди `65x/75x`; and the **entire клас 9 задбалансови**.

**How it grows (additive, no migration):** the picker groups by КЛАС→ГРУПА, so dropping in the rest of the national chart later — or replacing the constant with the editable per-company `chart_of_accounts` table (§B5b) — is additive. **Lines never FK the chart** (§B4), so no historical posting moves when the chart is edited.

---

## B3. The account-picker UX (accountant surface) + per-operation defaults

### Two-audience framing

The raw Дт/Кт account picker is the **счетоводител surface only.** The **owner never opens it** (§A2/A3): they pick **Основание** + confirm the plain **Операция по ДДС**, and the engine fills every account underneath (stress #19 fix). The picker below powers the accountant's editable Дт/Кт grid inside Меню Контиране, and the owner layer calls it *invisibly* to resolve its defaults.

### Component: grouped command-combobox (`<AccountPicker>`)

One searchable combobox per Дт/Кт line cell, opened on focus of the "сметка" field:

```
┌ сметка ───────────────────────────────────┐
│ 🔍 Търси по номер или име…      [411    ] │   ← types "411" OR "клиент" OR "vat"
├────────────────────────────────────────────┤
│ ★ Често използвани                         │   ← per-company recents (localStorage + server)
│   411  Вземания от клиенти                  │
│   703  Приходи от продажби на услуги        │
│   4532 ДДС на продажбите            453/2   │   ← alias right-aligned, muted
├────────────────────────────────────────────┤
│ ▸ КЛАС 4 · Разчети                          │   ← collapsible КЛАС
│   ▾ 41 · Клиенти                            │     then ГРУПА
│       411  Вземания от клиенти              │
│       412  Задължения към клиенти по аванси │
│   ▾ 45 · Разчети с бюджета                  │
│       4531 ДДС на покупките          453/1  │
│       4532 ДДС на продажбите         453/2  │
│ ▸ КЛАС 7 · Приходи                          │
└────────────────────────────────────────────┘
```

**Behavior:**
- **Grouping** — КЛАС → ГРУПА via `class`/`ACCOUNT_CLASS_LABELS` and `group`/`ACCOUNT_GROUP_LABELS`, sticky collapsible headers. Relevance-first: on the **sale** side КЛАС 4/7 auto-expand; on the **purchase** side КЛАС 4/6/3; everything else collapsed.
- **Search by number OR name** — one input, two OR'd matchers: (a) numeric → `code.startsWith(q)` **and** `alias.replace('/','').startsWith(q)` (typing `411`, `4532`, or `453` all hit the right row); (b) text → case/diacritic-insensitive substring on `name` (`клиент`→`411`, `услуг`→`602/703`, `ддс`→ the `453x` block; a small `vat`/`dds` synonym map). Numeric ⇒ rank by code; text ⇒ rank by match position. Enter picks the highlighted row.
- **Recents / "Често използвани"** — the 6–8 most-used `accountCode`s pinned on top (derive from `SELECT accountCode, count(*) … GROUP BY` over `journalLines`, cached), so a services shop lands on `703`/`411`/`4532` without scrolling.
- **Display format** — every row is **`{code} {name}`** (monospace code + regular name). VAT подсметки also show the accountant alias right-aligned & muted (`4532 ДДС на продажбите · 453/2`).

```ts
export function formatAccountLabel(a: Pick<ChartAccount,'code'|'name'>): string {
  return `${a.code} ${a.name}`;                 // "4532 ДДС на продажбите"
}
export function accountAlias(a: Pick<ChartAccount,'alias'>): string | null {
  return a.alias ?? null;                         // "453/2" | null
}
```

### Component contract (`<AccountPicker>`)

File: `src/features/kontirovka/components/AccountPicker.tsx`. Controlled combobox; the surrounding Дт/Кт grid owns the value. The contract:

```ts
import type { ChartAccount } from '../chart-of-accounts';

export interface AccountPickerProps {
  /** Controlled value: the selected синтетична code ('4532'), or null when the cell is empty. */
  value: string | null;

  /** Fires ONLY with a code that resolves via getAccount() — the picker can never emit an
   *  unknown code (fail-closed at the boundary; mirrors the post-time snapshotAccount guard, §B4). */
  onChange: (code: string, account: ChartAccount) => void;

  /** Which leg this cell is. Drives relevance: debit auto-expands the debit-heavy класове, credit the credit-heavy. */
  side: 'debit' | 'credit';

  /** Sale vs purchase context → relevance ordering (sale: КЛАС 4/7 open; purchase: КЛАС 4/6/3 open).
   *  Optional; when omitted the tree renders all-collapsed. */
  dealType?: 'sale' | 'purchase';

  /** Scopes the "Често използвани" recents query. */
  companyId: number;

  /** v1: BG_CHART_OF_ACCOUNTS. Later slice: the per-company chart_of_accounts rows (§B5b). Default BG_CHART_OF_ACCOUNTS. */
  accounts?: readonly ChartAccount[];

  /** Hide non-postable synthetic parents (only relevant once the editable chart has them). Default true. */
  postableOnly?: boolean;

  /** Pre-resolved recents (codes, most-used first). When omitted, the component fetches via useAccountRecents(companyId). */
  recents?: readonly string[];

  /** Field wiring / a11y. */
  name?: string;
  disabled?: boolean;
  autoFocus?: boolean;

  /** Validation surface — e.g. a stored code no longer present in the chart. */
  error?: string | null;
}

export function AccountPicker(props: AccountPickerProps): JSX.Element;

// Supporting contracts the component composes (both unit-testable without React):

/** Case- & diacritic-insensitive, number-OR-name matcher (the two OR'd matchers described above).
 *  Numeric query ⇒ code/alias prefix, ranked by code; text query ⇒ name substring, ranked by match position. */
export function matchAccounts(
  query: string,
  opts: { accounts: readonly ChartAccount[]; side?: 'debit' | 'credit'; dealType?: 'sale' | 'purchase' },
): ChartAccount[];

/** 6–8 most-used accountCodes for a company, from `journal_lines GROUP BY account_code` (cached). */
export function useAccountRecents(companyId: number): { recents: string[]; isLoading: boolean };
```

**Guarantees the caller can rely on:** (1) `onChange` never fires with an unknown code — invalid input is held as `error`, the grid stays unposted (fail-closed); (2) keyboard-complete — ↑/↓ move, Enter picks the highlighted row, Esc closes; (3) recents pin on top; (4) VAT подсметки show their `alias` right-aligned & muted; (5) the picker reads the **live** chart, but a picked code is later **snapshotted** onto the line (§B4), so post-hoc chart edits never move a posted row. The owner layer calls `matchAccounts`/`BASIS_TO_ACCOUNT` to resolve its defaults **without ever mounting `<AccountPicker>`** (stress #19).

### Per-operation smart defaults (what pre-fills before the picker is touched)

The engine seeds the whole grid from `(vatOperation, basis, isVatRegistered, docType)`; the picker only edits an already-correct draft. Basis→account resolves through one table:

```ts
// Canonical engine enum — WIRING §2.3-B's 6-value list (wins over any 7-value variant).
// This is what journal_entries.basis / received_invoice_lines.nature store.
export const ACCOUNTING_BASES = ['services','goods','production','materials','fixed_asset','other'] as const;
export type AccountingBasis = (typeof ACCOUNTING_BASES)[number];

export const BASIS_TO_ACCOUNT: Record<AccountingBasis, { sale: string; purchase: string }> = {
  services:    { sale: '703', purchase: '602' },   // default
  goods:       { sale: '702', purchase: '304' },
  production:  { sale: '701', purchase: '601' },    // production isn't "bought"; materials→601
  materials:   { sale: '706', purchase: '601' },    // or 302 (stock) — accountant re-points
  fixed_asset: { sale: '705', purchase: '204' },    // 20x — accountant re-points to the exact asset
  other:       { sale: '709', purchase: '609' },
};

// Owner presentation cards → canonical basis (+ optional account re-point).
// The 7 owner cards are NOT 7 bases: six are 1:1; 🏠 Наем rides `services` with a 704 revenue override.
export const OWNER_CATEGORIES = [
  { id: 'services',    label: 'Услуга',    icon: '🧰', basis: 'services'    },
  { id: 'goods',       label: 'Стока',     icon: '📦', basis: 'goods'       },
  { id: 'production',  label: 'Продукция', icon: '🏭', basis: 'production'  },
  { id: 'materials',   label: 'Материал',  icon: '🧱', basis: 'materials'   },
  { id: 'fixed_asset', label: 'Актив',     icon: '🖥', basis: 'fixed_asset' },
  { id: 'rent',        label: 'Наем',      icon: '🏠', basis: 'services', saleAccountOverride: '704' },
  { id: 'other',       label: 'Друго',     icon: '➕', basis: 'other'       },
] as const satisfies readonly {
  id: string; label: string; icon: string; basis: AccountingBasis;
  saleAccountOverride?: string; purchaseAccountOverride?: string;
}[];
```

Resulting default grids (net **N**, VAT **V**, gross **G = N+V**; sign per docType — CN negates every leg):

| Operation (default trigger) | Дебит (default) | Кредит (default) |
|---|---|---|
| **Sale 20%/9%** `sale_std_20/9` (outgoing, `vatMode='standard'` + line rate) | **411** `G` | **`BASIS.sale`** `N` + **4532** `V` |
| **Sale 0% / ВОД / EU-услуги / освободена** (from `deriveExemptVatOperation`) | 411 `N` | `BASIS.sale` `N` (no 4532) |
| **Sale, non-VAT-registered** (`isVatRegistered=false`) | 411 `N=G` | `BASIS.sale` `N` (no VAT leg, no tax line) |
| **Purchase full-credit 20%/9%** `purchase_full_*` (received default, human-confirm, confidence-gated) | **`BASIS.purchase`** `N` + **4531** `V` | **401** `G` |
| **Purchase no-credit чл.70** `purchase_no_credit` | `BASIS.purchase` `G` (VAT capitalised into the cost's nature, not a blanket 609 — `PLAN §A6`) | 401 `G` |

Honest-about-signal notes (`PLAN §3.3`, `WIRING §2.1/§2.2`): Основание default is weak (`articles.type`, defaults `'service'`) and always confirmable; sales op derives via `deriveExemptVatOperation` keyed on the exact `ref` (unknown → `unclassified` → manual pick, never silent `sale_std_20`); purchase op is not derivable → `purchase_full_20` + mandatory confirm; the VAT leg is omitted when `!isVatRegistered`; every chosen `accountCode` must resolve via `getAccount()` or the post is refused.

---

## B4. How a контировка LINE stores the account — **snapshot, not FK**

**Each `journal_lines` row stores a frozen snapshot of `code + name + group + class` — it does NOT foreign-key the chart.** This is the load-bearing immutability property: if the chart is later edited (a `602` rename, a re-group, or the editable per-company table replacing the constant), every **already-posted** статия keeps the account exactly as it read at post time, so the Оборотна ведомост / Главна книга / дневник (which group and label by `accountGroup`/`accountClass`) stay bit-stable and audit-faithful.

This **extends `PLAN §2.1`** (which snapshots only `accountCode`+`accountName`) by **adding `accountGroup` and `accountClass`** — required because the trial balance groups by клас/група and must not re-derive them from a mutable chart.

```ts
// src/features/kontirovka/engine.ts — materialising a draft line into a journal_lines insert
import { getAccount } from './chart-of-accounts';

function snapshotAccount(code: string) {
  const a = getAccount(code);
  if (!a) throw new Error(`Unknown account ${code} — not in BG_CHART_OF_ACCOUNTS`); // post refused (fail-closed)
  return {
    accountCode:  a.code,   // '4532'
    accountName:  a.name,   // 'ДДС на продажбите'  (frozen — survives later chart edits)
    accountGroup: a.group,  // '45'  → Оборотна ведомост / дневник grouping
    accountClass: a.class,  // 4     → report section (Разчети)
  };
}
```

Reports read the **snapshot columns**, never the constant, for any posted row. The live `BG_CHART_OF_ACCOUNTS` is consulted **only** while a статия is still a **draft** (to offer the picker and validate a new pick).

---

## B5. Drizzle shapes

### (a) v1 — no chart table; the constant is the source of truth, lines snapshot it

Add the four snapshot columns to `journal_lines` (`PLAN §2.1` shape + `accountGroup`/`accountClass`). Conventions match `schema.ts`: `serial` PK, `integer` FK `onDelete:'cascade'`, **varchar not pg-enum**, `numeric(15,4)` money.

```ts
// lib/db/schema.ts — journal_lines (Дебит/Кредит редове) — счетоводната истина
export const journalLines = pgTable('journal_lines', {
  id: serial('id').primaryKey(),
  journalEntryId: integer('journal_entry_id').notNull()
    .references(() => journalEntries.id, { onDelete: 'cascade' }),
  side: varchar('side', { length: 6 }).notNull(),                 // 'debit' | 'credit' (JOURNAL_SIDES)

  // ── frozen account snapshot (NOT an FK to any chart) ──
  accountCode:  varchar('account_code',  { length: 20 }).notNull(),   // '4532'
  accountName:  varchar('account_name',  { length: 255 }).notNull(),  // 'ДДС на продажбите' — frozen
  accountGroup: varchar('account_group', { length: 2 }).notNull(),    // '45'  [ADDED vs plan §2.1]
  accountClass: integer('account_class').notNull(),                   // 4     [ADDED vs plan §2.1]

  description: varchar('description', { length: 500 }),
  amount:     numeric('amount',      { precision: 15, scale: 4 }).notNull(), // doc ccy
  amountBase: numeric('amount_base', { precision: 15, scale: 4 }).notNull(), // × frozen fxRate (GEN-1)
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [
  index('idx_jl_entry').on(t.journalEntryId),
  index('idx_jl_account').on(t.journalEntryId, t.accountCode),
  index('idx_jl_class_group').on(t.accountClass, t.accountGroup),   // trial-balance grouping
]);
```

No chart table, no seed migration, no FK — the `BG_CHART_OF_ACCOUNTS` **TS constant** is the only chart in v1 (`PLAN §F5a`, `WIRING §1.5`). The engine validates `accountCode` against it and snapshots the four columns.

### (b) Later slice — editable per-company `chart_of_accounts` (still no FK from lines)

When per-company customization + аналитични arrive, add a table seeded from the constant. Crucially, **`journal_lines` still does not FK it** — it keeps snapshotting — so historical postings never move. The table only powers the *picker/validation for new drafts*:

```ts
export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 20 }).notNull(),                 // '411' or аналитичен '411/2'
  name: varchar('name', { length: 255 }).notNull(),
  class: integer('class').notNull(),                               // РАЗДЕЛ 1..9
  group: varchar('group', { length: 2 }).notNull(),               // ГРУПА
  parentCode: varchar('parent_code', { length: 20 }),             // '411/2'.parent = '411'
  type: varchar('type', { length: 12 }).notNull(),                // ACCOUNT_TYPES
  normalSide: varchar('normal_side', { length: 6 }).notNull(),    // 'debit' | 'credit'
  currency: char('currency', { length: 3 }),                      // per-currency аналитичен (411/2='EUR'); null on synthetic
  isVat: boolean('is_vat').notNull().default(false),
  isPostable: boolean('is_postable').notNull().default(true),     // synthetic parents can be non-postable
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('coa_company_code_unique').on(t.companyId, t.code),
  index('idx_coa_company_class_group').on(t.companyId, t.class, t.group),
  index('idx_coa_parent').on(t.companyId, t.parentCode),
]);
```

### App-level enums (`src/features/kontirovka/constants.ts`, mirroring `schema.ts:820+`, `as const`)

```ts
export const ACCOUNT_TYPES    = ['asset','liability','equity','revenue','expense','offbalance'] as const;
export const JOURNAL_SIDES    = ['debit','credit'] as const;   // journalLines.side & ChartAccount.normalSide
export const ACCOUNTING_BASES = ['services','goods','production','materials','fixed_asset','other'] as const; // 6 — WIRING §2.3-B (canonical)
```

---

## B6. Key reconciliations & anchors (so nobody re-litigates)

- **Canonical VAT codes are the national 4-digit `4531/4532/4538/4539`** (`WIRING` wins over `ANALYSIS`'s `453/1·453/2`); `453/x` is a display `alias` only.
- **`453/1·453/2` is a purchase/sale split, not currency** (Decision 0b).
- **Currency аналитични: none in v1** (GEN-1 puts currency on the line as `amount`/`amountBase`/`currency`/`fxRate`); cash/bank FX handled by national `502/504`; `fxAnalytic:true` marks `411/401/402/412` for the later editable slice.
- **`303 Продукция` is in the seed** (`WIRING P13`); **`accountGroup`+`accountClass` are new snapshot columns** beyond `PLAN §2.1`.
- **Lines snapshot, never FK the chart** — the immutability guarantee (§B4).

---

# PART C — GAP-CLOSURE ("no gaps")

## C0. The two structural blind spots

The three prior docs are an accountant-grade double-entry + real-ДДС engine, deep and legally careful on the **posting spine** (create→contra→post→дневник→декларация→export), and the 27 stress findings harden that spine. Measured against *"the best invoicing+accounting software, no gaps, for BOTH an owner and an accountant across the full lifecycle,"* two things were missing that the 27 findings do not touch:

1. **The OWNER HALF was asserted but never designed.** The prior docs were ~95% raw Дт/Кт/дневник/клетки. **PART A of this addendum closes that** — the owner surface, aggregated dashboard, and trust/health system now have a data source, a UX, and slices.
2. **The plan STOPS AT THE MONTHLY VAT CLOSE.** Everything after — onboarding (opening balances, VAT-registration context), the non-invoice reality (manual journals, depreciation, settlement→разчети aging + bank rec), the filing lifecycle around the numbers (НАП deadlines, immutable filed-return snapshots, чл.126 corrections), годишно приключване (123/ОПР/баланс/ГДД), and enterprise hygiene (10-year retention, export/backup/GDPR, a real permission + accountant-review model) — is missing or only disclaimed.

None of the gaps below duplicate the 27 stress findings; a few sit adjacent (G07 vs #20 backdate; G13 vs #27 settlement; G09 vs the delete-guard) and are scoped to the distinct, uncaptured part. **Two are blockers for the product's own headline:** `G01` (owner has no owner-layer — **closed by PART A**) and `G02` (an accountant literally cannot onboard an existing client because opening balances have no entry point, so the Оборотна ведомост / Главна книга / разчети are wrong for every non-greenfield company).

---

## C1. The ranked gap list

Ranked severity-first (blocker → important → nice-to-have). **CoveredByPlan:** `no` / `partial` (the plan touches it but leaves the load-bearing part open) — none are fully covered. **Closed-by** flags which gaps this addendum already resolves. Slices reference the roadmap in §C3.

### BLOCKERS

| ID | Gap | Audience | CoveredByPlan | Fix | Slice |
|---|---|---|:--:|---|---|
| **G01** | The owner-facing aggregated layer (приходи Σ70x / разходи Σ60x / печалба / дължимо ДДС) with plain-language postings — the reason for this whole pass — had no data model, UX, or slice. | owner | no | **CLOSED by PART A.** An owner dashboard + quick-create over the same `journal_*` the accountant reads; raw Дт/Кт behind the Счетоводител toggle. Consumes the accountant ledger, never a parallel number. | Owner slices (§C3), riding Slices 2/5 |
| **G02** | **No opening balances / начални салда.** Оборотна ведомост has начално-салдо columns structurally always 0 — no entry point when a company adopts the system mid-life. Every balance-sheet account (`411/401/501/503/капитал/ДМА`) starts at 0, so trial balance / Главна книга / разчети are wrong for any existing client. **An accountant cannot onboard a real client.** | accountant | no | Add an opening-balances mechanism — a `kind='opening'` balanced `journal_entry` per account as of a start date (or an `account_opening_balances` table) captured in onboarding; feed начално салдо from it; enforce `Σ Дт opening = Σ Кт opening` with the same balance trigger. | **NEW Slice 0** |

### IMPORTANT

| ID | Gap | Audience | CoveredByPlan | Fix | Slice |
|---|---|---|:--:|---|---|
| **G03** | **"Books-in-order" health-check** named as a core owner requirement but never specified — no ✅/⚠ signal states or placement. | owner | no | **CLOSED by PART A §A6.** A monthly health aggregate {all docs posted, Σ Дт=Σ Кт, 0 unclassified/`изисква преглед`, month closed & filed, accountant-reviewed}; reuse the оборотна-ведомост triple-equality as the free integrity proof. | Cross-cutting w/ owner slice |
| **G04** | **No accountant-review/approval workflow and no accounting-permission model.** `company_members.role ∈ {owner,accountant}` exists (`schema.ts:113`) but gates nothing — anyone can post/reverse/close. The owner's "accountant review" trust signal has no state and no gate. | both | no | Add a review dimension to `journal_entries` (`reviewedByUserId`/`reviewedAt` or a `posted→reviewed` state) + role-keyed permission gates on post/reverse/closePeriod (BG norm: owner may draft, accountant posts/closes — log the policy to `REVIEW_QUEUE`). Surface "прегледано от счетоводител" as a health signal (§A6.7). | Slice 2 (gates) + cross-cutting |
| **G05** | **No manual journal-entry flow.** `kind='manual'` is in the enum but there is no form/engine/wiring. An accountant must post non-invoice статии — заплати (`604/Cr 421,45x`), осигуровки (`605`), амортизации (`603/Cr 241`), банкови такси/лихви (`602/621`), корекции. Without them the Оборотна ведомост is only invoices + VAT — not real books. | accountant | partial | Ship a free-form Меню Контиране (any accounts, N:M lines) reusing the balance/immutability/period triggers, gated to the accountant role. Documents and manual entries share `journal_entries`; validate `Σ Дт=Σ Кт` and open-period identically. | NEW (after Slice 2 spine) |
| **G06** | **НАП filing calendar, deadlines and 14-то-число reminders are absent.** ДДС декларация + дневници due the 14th of next month; VIES the 14th; ГДД annually. `MonthCloseCard` shows "what's left" but never "due in N days / overdue." | both | no | A filing-calendar service deriving per-obligation due dates from period + regime, + reminders in `MonthCloseCard`/notification bell ("ДДС за юли — остават 5 дни до 14-ти"). Record a period's "подадена" state + filing date. **The owner read-layer is §A5.3.** | NEW (after Slices 4/5) |
| **G07** | **Filed declaration/дневник is never snapshotted** — every report is a live `GROUP BY` over `journal_tax_lines`. Once filed, the exact submitted кл. values + дневник rows must be frozen; a later reversal in a reopened period silently changes "the declaration." The дневник `№ по ред` has no frozen sequence. *(Extends beyond #20, which is only the backdate-after-close banner.)* | compliance | no | On close/file, persist a `filed_returns` snapshot (period, all кл. values, ordered дневник rows + `№ по ред`, file hash, `filed_at/by`). Render "as filed" from the snapshot and "current" from live; diff to drive corrections + auditor drill-through. | Slice 4 (close) / Slice 5 (declaration) |
| **G08** | **End-to-end correction of an ALREADY-FILED period (сторно per ЗДДС чл.126) is unspecified.** The reversal entity exists, but the legal routing is not: error increasing liability → уведоми НАП (чл.126 ал.3); other errors → correct in the current period; and the owner journey "spotted a wrong posted expense → fix it" (reverse→unlock→edit→re-post) is undocumented. *(Distinct from #20, the backdate-estimate banner/reopen.)* | both | partial | Define the correction flow: reversing a filed-period entry books the сторно in the **current open period** by default, or triggers a "уведоми НАП" path when liability increases; expose an owner-level "Поправи" orchestrating reverse→edit→repost under role gates, recorded against the filed snapshot (G07). | Slices 4/5 + owner slice |
| **G09** | **No 10-year archival/retention or immutable issued-document store** (ЗСч чл.12). Each issued фактура + filed дневник/декларация must be byte-stable for 10y. Outgoing invoices re-render from data (EDIT-RULE even permits editing a finalized-but-not-accounted invoice → the issued PDF changes retroactively) and delete-invoice removes rows. *(Distinct from the posting-immutability trigger and the orphan-delete guard.)* | compliance | no | Freeze and store the rendered PDF + hash at finalize; forbid mutation of any finalized document once it has entered a filed period; define a 10-year retention policy + an archive/export bundle; reconcile with the GDPR-erasure tension (G10). | Slices 5/6 + cross-cutting |
| **G10** | **Data export / backup / GDPR is absent, and collides with retention.** No CSV/Excel/company export (`PLATFORM_GAPS §3`), no "download all my data," no backup story. Partners store ЕГН of physical persons (`isIndividual`) = GDPR personal data with no retention/erasure/DPA. GDPR erasure directly conflicts with 10-year accounting retention — unadjudicated. | compliance | no | Ship structured export (CSV/Excel per register + full company JSON) + a backup/restore path; state retention as the legal basis that overrides erasure for filed documents; add erasure for non-document PII (unused partners); add a processor note covering accountant access. | NEW cross-cutting + Slice 6 (export) |
| **G11** | **The full годишно приключване / ОПР / баланс stage is out of scope with no plan.** The plan ships only the monthly VAT close and disclaims any финансов резултат (no `123` year-end close, no ОПР/P&L, no баланс, no ГДД/ЗКПО). The owner's "печалба" is only приходи−разходи, COGS/payroll-incomplete. | both | partial | Add a post-v1 stage: `123` приключвателни статии, ОПР + баланс from `journal_lines` by account class (1–5 balance-sheet, 6–7 P&L), годишна корекция (кл.43), a ГДД feed — gated on manual journals (G05), opening balances (G02), and an inventory/COGS + depreciation (G17) module. At minimum a roadmap slice, not just a banner. | NEW post-Slice-6 stage (v2) |
| **G12** | **VAT-registration context and threshold monitoring are missing.** `companies` has only `isVatRegistered` bool (`schema.ts:59`) — **no `vatRegisteredFrom/Until`, no режим, no дерегистрация** (verified `:50–79`). So дневници could start before registration; a company crossing the задължителна-регистрация threshold (чл.96) gets no warning; a newly-registered company can't be onboarded correctly. | both | no | Add `vatRegisteredFrom/Until` + `vatRegime` to `companies`; gate дневник generation to the registered window; add a rolling 12-month turnover monitor warning an unregistered owner near the чл.96 threshold. | NEW Slice 0 + cross-cutting |
| **G13** | **Разчети (per-partner sub-ledger / aging) and bank-statement reconciliation are missing for the owner.** Beyond the "settlement not posted / 411-401 never clear" limitation (#27): even once settlement lands there is no per-partner вземания/задължения aging and no bank import→match→reconcile. The owner's "whom do I owe / who owes me / cash position" can't be answered from the accounting layer. | owner | partial | After settlement postings (v2) add a разчети sub-ledger grouped by partner with aging buckets, and a bank-statement import→auto-match→reconcile feeding `503/501`; surface a cash-position + вземания/задължения tile on the owner dashboard. | v2 (after settlement) — scopes `BANK-1` |
| **G19** | **Euro-adoption boundary: opening balances & comparatives are not redenominated.** From 2026-01-01 the base/reporting currency is EUR (fixed **1 EUR = 1.95583 BGN**; НАП files in EUR; invoices ≤2025-12-31 stay BGN with **no** retroactive conversion — `docs/knowledge/euro-adoption-2026.md`). GEN-1 handles the steady state, but a company onboarded mid-2026 with pre-2026 history has **начални салда in BGN** and prior-period comparatives (Главна книга / ОПР / баланс) straddling the 01-01 boundary — none converted at the fixed rate. *(Newly found in this FINAL pass; adjacent to G02/G12 but distinct — it's the currency of the openings, not their existence.)* | both / compliance | partial | Capture openings as-of the start date in the company base currency; when start date < 2026-01-01, redenominate BGN openings at the fixed rate (÷ 1.95583, half-up) via `lib/fx/convert.ts` `EUR_BGN_FIXED` (already shipped — `0007_backfill_fx_rate.sql` uses it), pinned by a test; freeze the pre-2026-BGN / post-2026-EUR document boundary; redenominate comparatives when the annual stage (G11) lands. | **Slice 0** (+ G11) |

### NICE-TO-HAVE

| ID | Gap | Audience | CoveredByPlan | Fix | Slice |
|---|---|---|:--:|---|---|
| **G14** | **Concurrent draft-контировка editing has no concurrency control.** `je_source_unique` prevents a double POST and posted entries are immutable, but two members editing the same DRAFT контировка (or editing the source doc while a draft posting exists) is last-write-wins — one silently clobbers the other's classification. | data-integrity | no | Add optimistic concurrency (version/`updatedAt` guard) on `journal_entries` draft edits and the edit-source-while-draft-posting path, with a "променено от X" conflict prompt. | Slice 2 |
| **G15** | **Касова отчетност (cash-accounting VAT regime, глава 17а ЗДДС) is unsupported and un-flagged.** The engine assumes accrual (ДДС изискуем при данъчно събитие); on the cash regime ДДС е изискуем при плащане, so every `vatPeriod`/изискуемост would be wrong. *(Distinct from the аванс timing sub-case.)* | accountant | no | Add the `vatRegime` flag (G12); if 'cash', derive изискуемост/`vatPeriod` from payment date (needs settlement postings) and label it. Until built, name cash regime as explicitly **out-of-scope** on the company so no one files on the wrong basis. | Later (v2); flag on the company now |
| **G16** | **Опис на наличните активи при регистрация (ЗДДС чл.74–76** — right to deduct input VAT on assets/stock on hand at the VAT-registration date, via a протокол-опис filed within 45 days) has no data model, flow, or клетка mapping. | accountant | no | Add an onboarding "опис при регистрация" producing the protocol + a purchase-side posting (`Dr 4531 / Cr 401` or капитал) into the first open period; depends on the VAT-registration date (G12). | NEW Slice 0 / v2 |
| **G17** | **Depreciation / амортизация is absent.** Purchases can post to `20x` (ДМА) but nothing depreciates them — no счетоводен/данъчен амортизационен план, no monthly амортизация journal (`603/Cr 241`). Оборотна ведомост overstates assets, understates разходи; ГДД/ЗКПО cannot be produced. | accountant | no | Add an assets register + depreciation schedule generating monthly manual journals (depends on G05); feed ОПР; declare it a dependency of the годишно-приключване stage (G11). | v2 stage |
| **G18** | **VIES декларация (and Intrastat) as first-class monthly deliverables, not just an export column.** The plan treats VIES only as a v2 `VIES.TXT` column, but VIES-декларацията is its own monthly return (ВОД + услуги чл.21 ал.2) due the 14th, with its own reconciliation. Intrastat (intra-EU goods thresholds) is unmentioned. | accountant | partial | Model VIES as a monthly deliverable with its own reconciliation (Σ ВОД + чл.21 base against the sales ledger) + deadline in the filing calendar (G06); note Intrastat as threshold-gated / out-of-scope until a user needs it. | Slice 5/6 + G06 |
| **G20** | **No external/multi-client accountant workspace.** The BG reality is an обслужваща счетоводна кантора serving many client companies. `company_members.role='accountant'` (`schema.ts:113`) lets an accountant join **per company**, but there is no cross-company "моите клиенти" home, no filing calendar merged across clients (G06), no client-switcher — the accountant persona's own scale is unaddressed. *(Newly found in this FINAL pass.)* | accountant | no | Add an accountant home aggregating the companies where the user is a member with role `accountant`: a client list with per-client health (§A6) + a merged filing calendar (G06) + a client-switcher; reuse the existing membership model (no new tenancy). Growth feature — scope after the single-company accountant lens ships. | v2 (growth) |

---

## C2. Definition of complete — the checklist

The product is "complete for both audiences across the full lifecycle" when every box below is ticked. `✅` = designed & specced in the doc family (this addendum or the plan). `☐` = still open (gap ID + slice). The line an implementer runs against.

> ### The owner's contract — hold us to this
> When this ships, **you (the owner, without an accountant and without ever seeing Дт/Кт) can:**
> 1. **Record any разход or приход in ≤3 taps** and watch it land in the totals immediately (§A2/A3).
> 2. **Read your month at a glance** — приходи · разходи · (прогнозна) печалба · **дължимо ДДС с срок** · вземания · задължения · каса — each number drillable to the exact documents behind it (§A5).
> 3. **See one 🟢/🟡/🔴 "Всичко изрядно?" verdict that is _true_** — books balance (Σ Дт = Σ Кт), nothing is unreviewed, nothing is unclassified, the month is closed & filed, your accountant has signed off (§A6).
> 4. **Trust that a posted document is locked** and every change is an attributable сторно, never a silent edit (§A6, stress #1/#3/#4).
> 5. **Hand your accountant a complete, НАП-ready ledger** — дневници + справка-декларация кл.50/60 + export files — built from the _very same entries_ you saw in plain language (Part B, PLAN §5/§6).
>
> **"Complete" = every `☐` below is `✅`.** Each open box names the gap ID and the slice that closes it, so there is no ambiguity about what is promised vs. pending. Two `☐` are true blockers to even the owner's headline: **G02** opening balances and **G01** the owner layer (the latter already `✅` via Part A).

**1 — Owner capture (money in / money out)**
- ✅ One-tap `➕ Приход` / `➕ Разход` that never show Дт/Кт (§A2/A3)
- ✅ Plain category → account seam, engine-derived double entry (§A4, Part B §B3)
- ✅ Confidence-gated OCR review queue; low-confidence held, not auto-posted (§A2)
- ☐ Manual разход entry (received invoices have no manual path today) — **Slice 3**
- ☐ Per-partner "last used basis" memory (`OWN-MEM-1`) — backlog

**2 — Aggregated numbers the owner asked for**
- ✅ Приходи / Разходи / Печалба(caveated) / ДДС / Вземания / Задължения / Каса(proxy) (§A5)
- ✅ ДДС as a **dated** obligation (срок 14-то) (§A5.3)
- ✅ Прогноза↔Реално hard-swap badge, honest divergence explainer (§A5.2)
- ☐ Segmentation by project/cost-center (`OWN-SEG-1`) — backlog

**3 — Trust & transparency ("всичко изрядно")**
- ✅ Оборотна-ведомост self-check Σ Дт=Σ Кт (§A6.1)
- ✅ непроверени / posted-vs-draft / неясни counts (§A6.2–4)
- ✅ Прогноза=Реално reconciliation, period open/closed (§A6.5–6)
- ✅ Immutable audit trail (`activityLogs`), correction-by-reversal (§A6)
- ☐ Accountant-review state + permission gates — **G04, Slice 2**

**4 — Accountant ledger & VAT lifecycle**
- ✅ Balanced double-entry engine, three orthogonal axes, immutability/period triggers (`PLAN §2.4/§3`)
- ✅ Меню Контиране + account picker over `BG_CHART_OF_ACCOUNTS` (Part B)
- ✅ Хронологичен / Оборотна ведомост / Главна книга (`PLAN §4.3`)
- ✅ Дневник продажби/покупки + Справка-декларация кл.50/60 (`PLAN §5`)
- ✅ vat-grounds keying fix (`deriveExemptVatOperation`, #2) — **Slice 1/2**
- ✅ Posting-existence guards (edit/delete/cancel/toggle, #1/#3/#4) — **Slice 2**
- ✅ Received `docType` + CN sign (#5); mixed-rate tax lines (#6) — **Slice 3/5**
- ☐ Manual journal entries (заплати/осигуровки/амортизации/корекции) — **G05**
- ☐ НАП export files (`DEKLAR/PRODAGBI/POKUPKI/VIES.TXT`) — **Slice 6**
- ☐ VIES as a first-class monthly deliverable — **G18, Slice 5/6**
- ☐ External/multi-client accountant workspace (обслужваща кантора) — **G20, v2**

**5 — Onboarding (the non-greenfield reality)**
- ☐ Opening balances / начални салда — **G02, Slice 0 (BLOCKER)**
- ☐ VAT-registration context (`vatRegisteredFrom/Until`, `vatRegime`) + threshold monitor — **G12, Slice 0**
- ☐ Euro-adoption boundary: BGN opening-balance redenomination at the fixed rate — **G19, Slice 0**
- ☐ Опис при регистрация (чл.74–76) — **G16, Slice 0/v2**

**6 — Filing lifecycle around the numbers**
- ☐ Filing calendar / deadlines / 14-то reminders — **G06**
- ☐ Immutable filed-return snapshot (кл. values + дневник `№ по ред` + hash) — **G07**
- ☐ чл.126 correction of an already-filed period (owner "Поправи") — **G08**

**7 — Post-close / annual**
- ☐ Settlement postings (`501/503`) → 411/401 clear (#27) — **v2**
- ☐ Разчети per-partner aging + bank reconciliation — **G13, v2 (`BANK-1`)**
- ☐ Depreciation / амортизация register + schedule — **G17, v2**
- ☐ Годишно приключване: `123` / ОПР / баланс / ГДД — **G11, v2**
- ☐ Inventory/COGS module (relieve `304/303`; remove the Печалба caveat) — **v2**

**8 — Enterprise hygiene**
- ☐ 10-year retention + immutable issued-PDF store — **G09**
- ☐ Export / backup / GDPR (+ retention-vs-erasure adjudication, DPA) — **G10**
- ☐ Draft-edit concurrency control — **G14, Slice 2**
- ☐ Касова отчетност regime (or explicit out-of-scope flag) — **G15**

---

## C3. Updated slice roadmap — owner layer + chart + gap fixes folded into the existing slices

Extends `PLAN §7` with a **NEW Slice 0 (onboarding)** and folds every owner deliverable, the chart, and the gap fixes into place. Each slice stays independently shippable and verifiable per CLAUDE.md (build→run→observe→fix, assert numbers, no console/network errors, desktop+mobile).

| Slice | Engine / accountant (from PLAN) | + Owner layer (PART A) | + Chart (PART B) | + Gap fixes (PART C) | New tables | Gate |
|---|---|---|---|---|---|---|
| **0 — Onboarding ★NEW** | — | company setup wizard framing | — | **G02 opening balances** (`kind='opening'` balanced entry / `account_opening_balances`); **G12 VAT-reg context** (`vatRegisteredFrom/Until`, `vatRegime`) + чл.96 monitor; **G19 euro-boundary redenomination** (fixed-rate BGN→EUR openings, `convert.ts`); **G16 опис** (v2 hook) | `account_opening_balances` (or reuse `journal_entries`); `companies` cols | `Σ Дт opening = Σ Кт opening`; дневник gated to registered window |
| **1 — Read-only month drill-down ★** | `getSalesLedger`/`getPurchaseLedger` in `dnevnik.ts` (reuse `money.ts`); read-only лists | Данъци/ДДС month drill (§A5.4, Прогноза only) + plain "изведена операция" label | **`BG_CHART_OF_ACCOUNTS` constant lands** (powers labels/validation; read-only) | **#2 vat-grounds keying fix** (`deriveExemptVatOperation`); scope the purchase acceptance test to CN-free months (#5) | none | `Σ(sales)==vatIssued`; `Σ(purchase)==vatPaid` (CN-free) |
| **2 — Sales posting spine** | `journal_entries/lines/tax_lines/sequences`; `VAT_OPERATIONS`; rule-engine (Rows 1/2/10 + grounds 3/4/6/9); balance + immutability triggers; Меню Контиране; post→lock→`activityLogs`; Хронологичен + Оборотна | **`➕ Приход` end-to-end** (derive-draft→plain summary→post); "виж като счетоводител" bridge; health-panel balance self-check + unclassified count; dashboard KPIs start on `MetricsSummary` | **account snapshot columns** (`accountGroup`/`accountClass`, §B4); `<AccountPicker>`; `BASIS_TO_ACCOUNT` defaults | **posting-existence guards #1/#3/#4/#26/#25**; **G04 review dimension + role gates**; **G14 draft-edit concurrency**; per-row deferred balance trigger (#12); reversal whitelist (#13) | `0008` + triggers | Slice-2 gate (`WIRING §3.1`): keying · guards · mixed-rate · trigger grain · reversal · zero/proforma |
| **3 — Purchases (assisted-manual)** | Rows 11/12/13: full-credit-20% default (confirm, confidence-gated) + чл.70; Оборотна/Главна книга gain purchase side | **`➕ Разход`** (upload + **manual entry**); category→60x; hold-for-review guards | `304/601/602/609/20x` purchase defaults; received-line `nature`/`articleId` | **#5 received `docType`+CN sign**; **#9 stop `'BG'` coercion**; **#22 ≥1 rated line**; **G05 manual journal-entry flow** (rides here) | received cols (`docType`) | plain domestic full-credit wires; exotic → held draft |
| **4 — Period lock + close → real кл.50/60** | `accounting_periods` + `prevent_closed_period_posting`; `vat_close` entry; flip Прогноза→real on same key; `vatPeriod` override | Прогноза→**Реално** badge flip; `Приключи месеца`; период state in health panel | — | **#8 close/post race** (`FOR UPDATE`); **G06 filing calendar/14-то reminders**; **G07 filed-return snapshot**; **G08 чл.126 correction** (owner "Поправи"); #20 backdate banner | `accounting_periods`, `filed_returns` | close serialized; filed snapshot frozen |
| **5 — Дневник + Декларация** | ДДС дневник продажби/покупки + Справка-декларация as `GROUP BY journal_tax_lines`; кл.50/60 sign split + carry-forward | owner "Реално" ДДС sourced from декларация; accountant Справки | reports read **snapshot columns**, not the constant | **G18 VIES as monthly deliverable** + reconciliation; **G09 immutable issued-PDF/retention** (start); #15 per-line rounding basis | none | **hard-gated on accountant клетка sign-off** (`PLAN §8.2`) |
| **6 — НАП export** | `DEKLAR/PRODAGBI/POKUPKI(/VIES).TXT`, CP-1251 fixed-width, gap-free 1..N | export surfaced to owner as "файлове за счетоводителя" | uses дневник column ordinals, not СД клетки | **G10 export/backup/GDPR** (CSV/Excel + company JSON + retention-vs-erasure); **G09 10-year archive bundle** | none | one-char width error = НАП rejects → byte tests |
| **v2 stages** | Протокол чл.117 dual-ledger (ВОП/чл.82); частичен ДК (кл.33/42/43); авансови; межд. транспорт/тристранни; settlement + курсови разлики (624/724); шаблони/автоконтиране; AI-OCR one-click + bulk | разчети aging + cash-position tiles; per-partner memory; segmentation | editable per-company `chart_of_accounts` + currency аналитични (`411/2` etc.) | **G11 годишно приключване (123/ОПР/баланс/ГДД)**; **G13 разчети + bank rec (`BANK-1`)**; **G17 depreciation**; **G15 касова отчетност**; **G16 опис**; **G20 multi-client accountant workspace**; inventory/COGS | `chart_of_accounts`, assets register, `filing_calendar` | per-feature |

**Cross-cutting (span multiple slices):** the two-tier Изглед toggle (Slice 2 on, refined through 5); the "Всичко изрядно" health system (grows one signal per slice: balance/unclassified in 2, posted-meter in 3, Прогноза=Реално + period in 4, accountant-review in 2→4); the `activityLogs` audit trail (every post/reverse/close from Slice 2); the honesty banners (COGS-incomplete, Прогноза-vs-real, unposted-settlement) as first-class trust signals, not fine print.

**Bottom line.** PART A closes the owner-layer blocker (`G01`) and the health-check gap (`G03`) as a ~70% re-lens of shipped surfaces + two quick-create wrappers over the same balanced double entry. PART B gives the engine its chart — a curated 66-account national-synthetic seed (copy-paste-ready `BG_CHART_OF_ACCOUNTS`), snapshotted (never FK'd) onto every line, with a contract-specified accountant picker and owner-invisible defaults. PART C shows the remaining road: a **NEW Slice 0** (opening balances + VAT-registration context) is the second true blocker — without it no existing client can be onboarded — and the post-close lifecycle (filing calendar, filed snapshots, чл.126 corrections, retention/export/GDPR, годишно приключване, depreciation, разчети/bank-rec) is scheduled into the slices and v2 stages rather than left as a disclaimer. Ship Slice 1 now; hold posting until the Slice-2 gate is closed.
