# Контировка — the OWNER-FACING layer (wireframe-level design)

**Codename:** `OWN-1` (owner accounting UX over `KONT-1`/`RVAT-1`)
**Prepared for:** owner + счетоводител review · **Status:** design, ready to slice · **Date:** 2026-07-09
**Reads on top of:** `KONTIROVKA_PLAN.md` (build plan, 6 slices) · `KONTIROVKA_WIRING_STRESS.md` (**wins on any conflict** — 27 stress findings, esp. **#19 owner mis-posting**) · `KONTIROVKA_ANALYSIS.md` (engine).

> **The new requirement.** A company **owner (not an accountant)** must be able to (1) create & post **разходи**/**приходи** without ever seeing Дт/Кт, (2) see aggregated numbers (приходи/разходи/печалба/ДДС/вземания/задължения/cash), and (3) **KNOW the books are in order**. The raw Дт/Кт **Меню Контиране** stays — behind an accountant toggle. This doc is the two-audience UX; the double-entry engine underneath is unchanged (`PLAN §3`).

---

## 0. The two-audience model (the one design idea)

**One ledger, two lenses.** The `journal_entries` + `journal_lines` + `journal_tax_lines` produced by the engine are identical for both audiences. What differs is the *lens*:

| | OWNER lens (default) | СЧЕТОВОДИТЕЛ lens ("Меню Контиране") |
|---|---|---|
| Vocabulary | приход / разход / печалба / "ще внасяш ДДС" / "клиент ти дължи" | Дебит / Кредит / сметка / клетка / основание / операция по ДДС |
| Sees Дт/Кт? | **Never** — a plain "какво се осчетоводява" summary instead | Yes — the two-panel grid, account picker, клетки |
| Classification | picks a **plain category** + answers a **plain ДДС question**; engine derives 70x/60x + операция + клетка | edits `vatOperation`, accounts, клетки directly |
| Posting | one tap "Издай и осчетоводи" / "Запиши разхода"; **anything the engine can't confidently classify is held as draft, never auto-posted** | reviews the draft, overrides, posts |
| Reports | KPI cards + "Всичко изрядно?" health panel | Хронологичен, Оборотна ведомост, Дневник продажби/покупки, Справка-декларация, Главна книга |

**Why this is mostly a re-lens, not a rebuild:** the codebase already ships the owner primitives — `MetricsSummary` (Приходи/Вземания/Платени разходи/Задължения), `MonthCloseCard` (TRANS-2 "имаш ли всичко за НАП?"), the VAT `Прогноза` page, the invoice create flow, the received-invoice upload+review flow, the ЗДДС-grounds picker, and the activity/audit log. `OWN-1` **aggregates and re-labels** these, adds two quick-create wrappers, and gates the raw ledger behind a toggle. The genuinely new engine work (`journal_*` tables, `VAT_OPERATIONS`, `deriveExemptVatOperation`, period lock, posting guards) is `PLAN` Slices 2–5 and is a prerequisite, not owner-specific.

### 0.1 The load-bearing safety rule (this is the answer to stress #19)

> **#19 (MED):** "a non-accountant owner can post услуги to 702 or 20% as `sale_exempt`; the only gate is Σ Дт=Σ Кт."

The owner UX neutralizes #19 structurally, four ways:

1. **The owner never touches an account or a клетка.** They pick a plain category and answer a plain ДДС question. The engine — not the human — resolves 70x/60x and the операция/клетка. A balanced-but-wrong hand posting is impossible because there is no hand posting.
2. **Confidence gate → hold as draft.** If the engine returns `unclassified` (free-text ЗДДС ground, §2.3-F), or the received doc is a foreign supplier / reverse-charge hint / low `extractionConfidence` / a supplier credit note, the контировка is created **draft** and flagged **"изисква преглед от счетоводител"** — it is **never auto-posted** (covers #7, #9, #22). Owner still sees the money in every aggregate; only the *posting* waits.
3. **Overrides are marked.** If an owner overrides a derived category, the entry carries `изисква преглед`; the health panel counts it.
4. **The mis-classification is never silent.** The health panel surfaces **"N документа с неясно основание/ДДС"** as a first-class transparency count, so a wrong map is visible, not buried.

Net: owner gets a *derive-draft → plain-confirm → post* path; the accountant gets the raw override. The double entry underneath is always the engine's, always balanced.

---

## 1. Information architecture & the accountant toggle (Deliverable 4)

### 1.1 Navigation — owner default, accountant opt-in

The nav shell (`company-layout-shell.tsx`, MENU-1 horizontal nav) gains **one primary action pair** and **one gated section**. `companies` membership already carries `CompanyRole.OWNER | ACCOUNTANT` (`schema.ts:823`) — the toggle keys off it, remembered per user.

```
┌ Invoicly · «Моята Фирма ЕООД»                         [ Изглед: ● Собственик  ○ Счетоводител ] ┐
│  Табло   Приходи   Разходи   Данъци/ДДС   Контрагенти   … │   [ ➕ Приход ]  [ ➕ Разход ]      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
        (Счетоводство ← appears only in Счетоводител lens / for accountant role)
```

- **`➕ Приход` / `➕ Разход`** are always-visible primary buttons (top bar + dashboard hero). They are the owner's two verbs.
- **Изглед toggle** (Собственик ⇄ Счетоводител): flips the lens. Owner role defaults to Собственик and *may* peek at Счетоводител; accountant role defaults to Счетоводител. When Счетоводител is on, a **`Счетоводство`** nav entry appears → the Справки + Меню Контиране power view (§6). Route: `…/schetovodstvo` per `PLAN §9.3`.
- Existing routes are kept; only labels get owner-friendly aliases (Фактури→"Приходи" surface, Получени→"Разходи" surface). This is cosmetic over MENU-1; no route churn.

### 1.2 What each lens shows

- **Собственик:** Табло (KPIs + health), Приходи (issued docs, plain), Разходи (received docs, plain), Данъци/ДДС (Прогноза→Реално month drill), + the two ➕ actions.
- **Счетоводител:** everything above **plus** `Счетоводство` = Меню Контиране (raw Дт/Кт posting) + Справки (Хронологичен, Оборотна ведомост, Дневник продажби/покупки, Справка-декларация, Главна книга). Same underlying entries.

---

## 2. ➕ Приход — owner quick-create for revenue (Deliverable 1a)

**Reuses:** `createInvoiceDraft` / `finalizeInvoice` (`bulgarian-invoicing/actions.ts`), `RecipientCard`, `LineItemsCard`, `TotalsCard`, the ЗДДС `VAT_EXEMPTION_GROUNDS` picker, `getNextNumber`/manual number (f2f5423). **New:** the plain **category picker**, the plain **ДДС question**, the **"какво се осчетоводява"** summary, and auto-derive of the контировка on finalize.

A **Приход = an outgoing invoice**. The owner's screen is the existing invoice form, re-sequenced into three plain questions + a plain accounting summary. Дт/Кт never appear.

```
┌ ➕ Нов приход ───────────────────────────────────────────────────────────── [ x ] ┐
│                                                                                    │
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
│                                                                                    │
│        [ Запази чернова ]        [  Издай и осчетоводи  ]                           │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Mapping under the hood (owner never sees it):**

| Owner picks | → Основание (`basis`) | → 70x credit | Engine op | ДДС leg |
|---|---|---|---|---|
| 🧰 Услуга | Услуги | `703` | `sale_std_20`/`_9` | Cr `4532` |
| 📦 Стока | Стоки | `702` | `sale_std_20` | Cr `4532` (+ COGS caveat, §4.3) |
| 🏭 Продукция | Продукция | `701` | `sale_std_20` | Cr `4532` |
| 🏠 Наем | Наеми | `704` | `sale_std_20` | Cr `4532` |
| Без ДДС → Износ извън ЕС | — | `70x` | `sale_export_0` (кл.14) | none |
| Без ДДС → Продажба към ЕС (ВОД) | — | `70x` | `sale_ics_0` (кл.15, **VIES**) | none |
| Без ДДС → Услуга към ЕС | — | `703` | `sale_eu_services_rc` (кл.17, VIES) | none |
| Без ДДС → Освободена дейност | — | `70x` | `sale_exempt` (кл.19) | none |
| Без ДДС → **Друго (free text)** | — | `70x` | **`unclassified` → draft, "изисква преглед"** | none |

The "Защо?" radios are a **plain-language skin over `VAT_EXEMPTION_GROUNDS`** — each writes the exact `ref` (`'ЗДДС, чл. 28'` etc.) into `noVatReason`, so `deriveExemptVatOperation` (the `PLAN §2.3-F` keying fix, #2) resolves it correctly. "Друго" writes free text → `unclassified` → the safety path. **This is why the #2 keying bug must ship before ➕ Приход can post 0%/exempt sales.**

**Post behavior (honors ANALYSIS Q1 + #19):**
- **`Издай и осчетоводи`** = `finalizeInvoice` **then** auto-derive + `post` the контировка in one transaction, **iff** the op is confidently classified and the period is open. The owner sees "✅ Осчетоводено".
- If op = `unclassified` / mixed-rate needing review / VIES-flagged EU sale the owner didn't confirm → finalize the invoice but leave the контировка **draft**, banner: *"Издадено. Осчетоводяването изчаква преглед от счетоводител (неясно ДДС основание)."* The amount is still in every KPI as Прогноза.
- **`Запази чернова`** = invoice draft only; no posting.
- **`виж като счетоводител`** opens the raw Меню Контиране (§6) on this exact entry — the plain summary is a read-only projection of those `journal_lines`.

---

## 3. ➕ Разход — owner quick-create for expense (Deliverable 1b)

**Reuses:** `ReceivedInvoiceUploader` + `ReviewForm` + `confirmReceivedInvoice` (the whole upload→OCR→review flow), `extractionConfidence`, the delete feature (61bea2c). **New:** a **manual разход** quick-entry (received invoices have *no* manual-create path today — only upload), the plain category picker, and the plain summary.

A **Разход = a received invoice**. Two entry modes on one screen:

```
┌ ➕ Нов разход ─────────────────────────────────────────────── [ x ] ┐
│  ( ● Качи фактура/снимка )   ( ○ Въведи ръчно )                       │
│                                                                      │
│  ┌ Качи ─────────────────────────────────────────────────────────┐  │
│  │  ⬆  Пусни PDF/снимка тук — разчита се автоматично              │  │
│  │     (ReceivedInvoiceUploader, reused; OCR във фонов режим)      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  … → отваря прегледа (ReviewForm) когато е готово ↓                    │
└──────────────────────────────────────────────────────────────────────┘
```

After OCR (or in "Въведи ръчно"), the review shows the owner-plain confirmation — **not** the accountant grid:

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
│                                                                     │
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

**Mapping (hidden):** category → `basis` → debit account, default op `purchase_full_20` (full credit 20%):

| Owner picks | → 60x/30x/20x debit | ДДС leg |
|---|---|---|
| 🧰 Услуга | `602` Външни услуги | Dr `4531` (data credit) |
| 📦 Стока | `304` Стоки | Dr `4531` |
| 🧱 Материал | `601`/`302` | Dr `4531` |
| 🖥 Актив | `20x` (ДМА) | Dr `4531` |
| ➕ Друго | `609` | Dr `4531` |

**Guards that route to "изисква преглед от счетоводител" (draft, never owner-posted):**
- Supplier **credit note** (`docType`, `PLAN §2.3-A2`, #5) — owner marks the "Кредитно известие" radio; the engine signs it negative. If OCR detects a CN the owner missed, hold.
- **Foreign supplier** (frozen `supplierSnapshot.country` ≠ BG, #9) or a **reverse-charge hint** (#7) → hold; чл.117/ВОП/чл.82 is accountant-only (v2).
- **Low `extractionConfidence`** (#22) → may pre-fill, **may not auto-post**.
- **Exempt company** (owner makes exempt supplies) → do **not** default full credit; hold for credit-right review (#7).

Owner default stays the honest 95% case (domestic full-credit 20%); everything exotic is quietly deferred to the accountant without blocking the owner from recording the money.

---

## 4. The aggregated OWNER DASHBOARD (Deliverable 2)

**Reuses & extends** `MetricsSummary` + `MetricCard` (already renders Приходи/Вземания/Платени разходи/Задължения) and the `getCompanyMetrics`/`getCompanyExpenseMetrics`/`getMonthCloseStatus` queries. **New:** Печалба (with caveat), the ДДС Прогноза↔Реално badge, the Каса proxy, and a period selector.

```
┌ Табло · «Моята Фирма ЕООД»                Период: [ Този месец ▾ ]   [➕ Приход][➕ Разход] ┐
│                                                                                            │
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────────────┐ ┌───────────────────────┐ │
│  │ ПРИХОДИ        │ │ РАЗХОДИ        │ │ ПЕЧАЛБА (прогнозна) ⓘ  │ │ ДДС                    │ │
│  │ 12 480.00 EUR ▸│ │  7 210.00 EUR ▸│ │  5 270.00 EUR         ▸│ │ за внасяне 2 360.00 ▸ │ │
│  │ 24 документа   │ │ 15 документа   │ │ без себест./заплати ⓘ  │ │ 🟡 Прогноза (8/11)     │ │
│  └───────────────┘ └───────────────┘ └────────────────────────┘ └───────────────────────┘ │
│  ┌───────────────┐ ┌───────────────┐ ┌────────────────────────┐                            │
│  │ ВЗЕМАНИЯ       │ │ ЗАДЪЛЖЕНИЯ     │ │ КАСА (нето постъпления)│  ← proxy, labelled         │
│  │  3 900.00 EUR ▸│ │  1 450.00 EUR ▸│ │  +2 010.00 EUR       ▸ │                            │
│  │ клиенти дължат │ │ дължиш на дост.│ │ реален баланс: v2      │                            │
│  └───────────────┘ └───────────────┘ └────────────────────────┘                            │
│                                                                                            │
│  ┌ Всичко изрядно?  (health panel — §5) ─────────────────────────────────────────────────┐ │
│  │ 🟢 Готово за НАП · Дебит = Кредит ✅ · 0 за преглед · 0 неясни · 11/11 осчетоводени …   │ │
│  └────────────────────────────────────────────────────────────────────────────────────────┘ │
│  ↳ Последни документи · Активност                                                          │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Each KPI, its source, and its drill-down:**

| Card | Number (accrual, base ccy, CN-signed) | Source today | Drill-down |
|---|---|---|---|
| **Приходи** | Σ net revenue = Σ `70x` credit (posted) / else Σ `totals.netAmount` finalized non-proforma | `money.ts` signed sums | → Приходи list / Дневник продажби (plain) |
| **Разходи** | Σ net expense = Σ `60x/30x` debit (posted) / else Σ received `netAmount` | expense metrics | → Разходи list / Дневник покупки (plain) |
| **Печалба (прогнозна) ⓘ** | Приходи − Разходи | derived | → side-by-side breakdown |
| **ДДС** | `getVatSummary` **Прогноза**; **Реално** кл.50/60 once month posted+closed | `getVatSummary` → `journal_tax_lines` | → Данъци/ДДС month drill (§4.4) |
| **Вземания** | Σ outstanding on issued (411) | `outstandingSumSql` | → неплатени фактури |
| **Задължения** | Σ outstanding on received (401) | `expensesOutstanding` | → неплатени разходи |
| **Каса (нето постъпления) ⓘ** | collected gross − paid gross (cash-basis **proxy**) | `collectedSumSql` − paid | → плащания; note "реален касов/банков баланс идва с плащанията (v2)" |

### 4.1 The Печалба caveat (COGS-incomplete — #23 / §B2, honest)

Печалба carries a permanent ⓘ: **"Печалбата е приблизителна — не включва себестойността на продадени стоки, заплати и амортизации, които се завеждат отделно."** For a services SMB it is ~correct; for a goods trader it is overstated (304 not relieved, `PLAN §3.5`). Invoicly is "a layer that posts VAT," not a full P&L (`WIRING §1.6`) — the dashboard says so rather than implying a clean net result.

### 4.2 Прогноза ↔ Реално — the trust-critical badge

Every ДДС number wears one of two badges (never both, it is a **hard swap**, `WIRING §3` "Verified SOUND"):
- 🟡 **Прогноза** — from `getVatSummary`; shown until *all* the month's docs are posted **and** the month is closed. Sub-label `8/11 осчетоводени`.
- 🟢 **Реално (осчетоводено)** — the кл.50/60 from `journal_tax_lines`, once posted+closed. Because v1 locks `vatPeriod = issueDate month`, the two buckets reconcile exactly (`PLAN §F4`) and the flip cannot double-count.

Where the two legitimately differ (частичен ДК, reverse-charge, годишна корекция — `PLAN §5.2`), the drill-down explains it in plain BG so the owner isn't alarmed by a moving number.

### 4.3 Period selector

`Този месец / Това тримесечие / Тази година / Избери`. Drives every card. ДДС is monthly (НАП filing period); печалба/приходи/разходи roll up over the selected range.

### 4.4 Данъци/ДДС drill-down (evolves the existing `/vat` page, `PLAN §4.1`)

The current `/vat` SWR table (`{month, vatIssued, vatPaid, vatNet}`) becomes **expandable per month**:

```
▼ Юли 2026   ДДС продажби 3 480   ДДС покупки 1 120   ДДС за внасяне 2 360   🟡 Прогноза · 8/11 осчетоводени   [ Приключи месеца ]
   [ Приходи ] [ Разходи ]                                            (Дневник/Декларация live in Счетоводител lens)
   Приходи (продажби)
    № 0000000123  05.07  Контрагент ООД  ЕИК 123…  основа 1 701.57  ДДС 340.31  20%   ✅ Осчетоводено
    № 0000000124  09.07  Друг ЕООД        ЕИК 456…  основа   900.00  ДДС   0.00  ВОД  🟡 Чернова  [ Осчетоводи ]
    № 0000000125  …                                                                   ⚪ Не е осчетоводено
   Разходи (покупки) …
   ↳ Реално за внасяне (щом всичко е осчетоводено и месецът е приключен): 2 360.00
```

Chip states ⚪ Не е осчетоводено → 🟡 Чернова → ✅ Осчетоводено. This is Slice 1 (read-only, zero new tables) growing the post action in Slice 2.

---

## 5. "Всичко изрядно?" — the transparency / trust panel (Deliverable 3)

**Reuses & extends** `MonthCloseCard` (TRANS-2) — already a shared owner↔accountant "what's left this month" card with a готово/недовършено verdict. `OWN-1` adds the **balance self-check**, the **unclassified count**, the **posted/draft meter**, and the **period-open/closed** state, and links the **audit log**.

```
┌ Всичко изрядно?  ·  Месец юли 2026                                    🟢 Готово за НАП ┐
│                                                                                        │
│  ✅ Счетоводството е балансирано            Σ Дебит 48 210.00 = Σ Кредит 48 210.00     │  ← оборотна ведомост self-check
│  ✅ Няма получени фактури за преглед         0 непроверени                              │
│  ✅ Всички документи са осчетоводени          11 / 11   ▓▓▓▓▓▓▓▓▓▓ 100%                 │  ← posted vs draft meter
│  ✅ Всички основания са ясни                  0 документа изискват преглед              │  ← непосочени основания / unclassified
│  ✅ Прогноза = Реално ДДС                     2 360.00 = 2 360.00                        │  ← reconciliation, plain
│  🔓 Период юли: отворен                       [ Приключи месеца ]                        │  ← accounting_periods
│                                                                                        │
│  Последни счетоводни действия:                                            [ виж всички ]│
│   • Иван осчетоводи № 0000000123 · преди 2 ч                                            │  ← activityLogs (post/reverse/close)
│   • Иван потвърди разход от Мобилтел · преди 3 ч                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**The six signals (each links to the exact list):**

1. **Оборотна ведомост self-check — Σ Дт = Σ Кт.** The free, strong integrity test (`WIRING §1.6`). Green normally (the balance trigger guarantees it); 🔴 **"Има несъответствие — свържи се със счетоводител"** if ever broken (a bug/tamper signal). This is the owner's bedrock "it adds up".
2. **N непроверени** = received invoices still `draft` (`pendingReviewCount`). → received list.
3. **N неосчетоводени** = finalized/confirmed docs not yet posted (`outgoingPendingAccounting + receivedPendingAccounting`), shown as a **posted/draft meter** `X/Y`.
4. **N с неясно основание/ДДС** = entries with `vatOperation='unclassified'` or missing `basis`, or owner-overridden "изисква преглед" (the #19/#7 safety count). → filtered list the accountant clears.
5. **Прогноза = Реално** = the plain reconciliation (`PLAN §5.1` triple-check surfaced). If diverging, a plain "защо?" (частичен ДК/обратно начисляване…).
6. **Период отворен/затворен** = `accounting_periods` state. `Приключи месеца` writes the `vat_close` entry, flips Прогноза→Реално, and locks the кл.50 (`PLAN §5.1`, Slice 4). Closed shows "затворен на 14.08 от Иван" + a controlled reopen (accountant only, reverses the close, #20).

**Verdict line (top-right):** 🟢 **Готово за НАП** (balanced, 0 unreviewed, 0 unclassified, all posted or safely deferred) · 🟡 **Има недовършено (N)** · 🔴 **Има несъответствие** (balance broken). One glance = "I KNOW it is in order."

---

## 6. The accountant power-view — Меню Контиране (Deliverable 4 detail)

Flipping **Изглед → Счетоводител** reveals the `Счетоводство` section, which is exactly the `PLAN §4.2`/`§4.3` UI, unchanged:

- **Меню Контиране** — the two-panel Дт/Кт posting form (account picker over `BG_CHART_OF_ACCOUNTS`, editable `vatOperation` = the 16-code registry, клетки, VIES, Месец за експорт, `Общо Дт = Общо Кт` gate, `Осчетоводи`). Opening it on any owner document loads **the same `journal_entries` row** the owner's plain summary projected. Accountant edits/overrides here; the change writes `activityLogs` and, if it corrects an owner draft, clears the "изисква преглед" flag → the owner's health panel ticks **"проверено от счетоводител ✅"**.
- **Справки:** Хронологичен регистър · Оборотна ведомост (with the P&L-incomplete banner, #23) · Дневник продажби / покупки · Справка-декларация (кл.50/60 + carry-forward) · Главна книга. Server components per `PLAN §4.3`.

The owner's "виж като счетоводител" links (on every ➕ summary and every document) deep-link here without forcing the global toggle — a one-off peek. Nothing the accountant sees contradicts the owner view; it is the same ledger, one level of detail down.

---

## 7. Reuse vs. new (Deliverable 5)

### 7.1 Reused as-is or lightly re-labelled (already shipped)

| Existing surface | Role in OWN-1 |
|---|---|
| `createInvoiceDraft`/`finalizeInvoice` + `RecipientCard`/`LineItemsCard`/`TotalsCard` | body of **➕ Приход** |
| `ReceivedInvoiceUploader` + `ReviewForm` + `confirmReceivedInvoice` + `extractionConfidence` | body of **➕ Разход** (upload mode) |
| `VAT_EXEMPTION_GROUNDS` / `NoVatReasonPicker` | the plain "Защо без ДДС?" radios (skin over the same `ref`s) |
| Manual invoice number (f2f5423) | under "▸ Още" in ➕ Приход |
| Delete invoice / received (1e6fd64, 61bea2c) | owner delete **until posted**; must add posting-existence guard (#1/#3/#4) |
| `getVatSummary` | the **Прогноза** KPI + month table |
| `MetricsSummary` / `MetricCard` (Приходи/Вземания/Разходи/Задължения) | the dashboard KPI grid |
| `MonthCloseCard` (TRANS-2) + `getMonthCloseStatus` | base of the **"Всичко изрядно?"** panel |
| `activityLogs` + `/activity` page + `ACTIVITY_LABELS` | the audit-trail signal (add post/reverse/close actions, `PLAN §2.7`) |
| `CompanyRole` owner/accountant (`schema.ts:823`) | the **Изглед** toggle default |

### 7.2 New UI (owner-specific)

- The **➕ Приход / ➕ Разход** primary actions + the plain **category cards** (→ `basis` → 70x/60x).
- The plain **ДДС question** (→ `vatOperation`) that replaces the raw Операция-по-ДДС dropdown for owners.
- The **"Какво се осчетоводява"** plain-summary component (renders `journal_lines` in plain BG; read-only projection).
- A **manual разход** quick-entry (received invoices have no manual-create path today).
- Dashboard additions: **Печалба** (COGS caveat), **ДДС Прогноза↔Реално badge**, **Каса proxy**, **period selector**.
- Health-panel additions: **balance self-check**, **unclassified count**, **posted/draft meter**, **period open/closed**.
- The **Изглед toggle** + the gated **Счетоводство** section wiring.

### 7.3 New engine/data (prerequisite, from PLAN — not owner-specific but required)

`journal_entries`/`journal_lines`/`journal_tax_lines`/`journal_sequences` + triggers (Slice 2) · `VAT_OPERATIONS` registry + `BG_CHART_OF_ACCOUNTS` · **`deriveExemptVatOperation`** (the #2 keying fix — gates ➕ Приход 0%/exempt posting) · `received_invoices.docType`/`docTypeCode` (#5, gates ➕ Разход CN) · **posting-existence guards** on edit/delete/cancel/toggle (#1/#3/#4) · `accounting_periods` + close (Slice 4, gates Прогноза→Реално).

---

## 8. How OWN-1 neutralizes the owner-risk stress findings

| Finding | Owner-UX mitigation |
|---|---|
| **#19 owner mis-posting** | Owner picks plain category + plain ДДС answer; engine (not human) resolves account/клетка; unclassifiable → draft "изисква преглед"; count surfaced in health panel. No hand Дт/Кт. |
| **#7 exempt-company / unmapped ground** | Exempt company → purchases not defaulted to full credit (held for review); unmapped `noVatReason` → `unclassified` (ledgered/held), never `no_vat_out_of_scope`. |
| **#9 `'BG'` coercion / foreign supplier** | Foreign `supplierSnapshot.country` → hold as draft; classify off the frozen snapshot, not the mutable partner row. |
| **#5 received credit note as +ДК** | "Тип: Фактура / Кредитно известие" radio + OCR detect → engine signs negative. |
| **#22 OCR 0 lines** | Require ≥1 rated line + `extractionConfidence` gate before a purchase can auto-post. |
| **#1/#3/#4 togglable lock** | Owner delete/edit/cancel key on **posting existence**, not `accountingStatus`; a posted doc is locked until reversed (accountant). |
| **#20 backdate after close** | Health panel keeps the estimate population + shows "N добавени след приключване" + accountant-only reopen. |
| **#23 COGS-incomplete** | Печалба wears a permanent caveat; never presented as a clean финансов резултат. |
| **#27 settlement unposted** | "Каса" is labelled a proxy; real 501/503 balance deferred to v2 with an explicit note. |

---

## 9. Build sequencing (maps onto PLAN §7 slices)

| When | Owner deliverable | Rides on |
|---|---|---|
| **Slice 1** (read-only) | Данъци/ДДС month drill (§4.4, Прогноза only) + the plain "изведена операция" label (needs the #2 keying fix) | `dnevnik.ts`, no new tables |
| **Slice 2** (sales posting) | **➕ Приход** end-to-end (derive-draft → plain summary → post), the "виж като счетоводител" bridge, health-panel balance self-check + unclassified count; posting-existence guards | `journal_*`, engine, Меню Контиране |
| **Slice 3** (purchases) | **➕ Разход** (upload + manual), received `docType`, category→60x, hold-for-review guards | assisted-manual purchase engine |
| **Slice 4** (period close) | Прогноза→**Реално** badge flip, `Приключи месеца`, период open/closed in health panel | `accounting_periods`, `vat_close` |
| **Slice 5** (дневник/декларация) | Owner dashboard "Реално" ДДС sourced from декларация; accountant Справки | `GROUP BY journal_tax_lines` |
| **Dashboard KPIs** (Печалба/Каса/period selector) | ship incrementally on the existing `MetricsSummary` from Slice 2 onward | reuse metrics queries |

**Bottom line:** the owner layer is ~70% a re-lens of shipped surfaces (`MetricsSummary`, `MonthCloseCard`, VAT page, invoice/received flows, grounds picker, activity log) + two plain quick-create wrappers, sitting on the same balanced double entry the accountant sees in Меню Контиране. The only owner-specific correctness risk is #19, and it is designed out by never letting the owner touch an account and by holding anything `unclassified` as a flagged draft instead of auto-posting it.
