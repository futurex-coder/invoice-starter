# Контировка — wiring audit & stress test (FINAL)

**Prepared by:** lead architect · **For:** owner + счетоводител review · **Status:** FINAL · **Date:** 2026-07-09
**Anchored to:** `docs/KONTIROVKA_PLAN.md` (accountant-critiqued build plan) + `docs/KONTIROVKA_ANALYSIS.md` (engine deep-dive).
**Verification:** every load-bearing claim below is checked against branch code at `file:line`. Claims marked **[V]** are code-verified; unmarked claims are design/theory. Where the plan text disagrees with the code, the **code wins** and the discrepancy is logged in the plan-corrections register (Part 4).

This document supersedes the working draft. Three things were hardened for the final:
1. **Every wiring field carries an unambiguous verdict token** — `HAVE` / `DERIVE` / `MISSING → ADD-X` (legend below), so there is no prose ambiguity about what is buildable today.
2. **Every CRITICAL/HIGH stress finding maps to a concrete, code-level fix and an explicit plan slice** (Part 3).
3. **The "what we must add" list is copy-paste-actionable** — exact Drizzle columns, exact app-level enum arrays, exact OCR schema fields, the exact chart-of-accounts row, and the exact `ref → VatOperation` keying map (Part 2.3).

### Verdict-token legend (used in Part 2)

| Token | Meaning | Engine action |
|---|---|---|
| **HAVE** | Present as a frozen/stored field, directly usable at posting time. | Read it. |
| **DERIVE** | Not stored directly, but computable from existing frozen fields. The derivation is named. | Compute it. |
| **DERIVE (weak)** | Derivable, but the source signal is nullable/unvalidated/low-trust. | Compute + human-confirm + harden. |
| **DERIVE (BROKEN)** | The plan specifies a derivation, but it is defective as written (wrong key / format mismatch). | Fix the derivation before relying on it. |
| **MISSING → ADD-X** | Not present anywhere. The exact column/field/enum to add is `X`. | Add `X`, then read/derive. |

---

## BLUF — the one-paragraph verdict

The plan's **double-entry spine is sound and legally faithful** — the three-orthogonal-axes engine (VAT leg = f(vatOperation), P&L/запаси leg = f(basis), sign = f(docType)) balances Σ Дт = Σ Кт in every case, and `companies.isVatRegistered` **[V]** (`schema.ts:59`) cleanly gates the VAT legs. **The money-carrying legs are fully wired today:** net/VAT/gross are frozen (`invoices.totals` JSONB / `received_invoices.{net,vat,gross}Amount`), per-line `vatRate` exists on **both** sides (`invoice_lines.vatRate` **[V]** `schema.ts:383`, `received_invoice_lines.vatRate` **[V]** `schema.ts:540`), and `fxRate` is frozen. **A plain domestic 20% sale posts correctly right now.** But almost every *classification* input is absent, unfrozen, free-text, or format-mismatched — and several are **genuine, code-confirmed defects, not documented limitations**:

1. The single most important sales classifier is **silently broken**. Plan §3.3 claims to key the `sale_export_0`/`sale_ics_0`/`sale_eu_services_rc`/`sale_exempt` derivation on "the strings actually in `vat-grounds.ts`," yet it uses tokens like `чл.53 ал.1`. The actual `VAT_EXEMPTION_GROUNDS[].ref` **[V]** is `'ЗДДС, чл. 53, ал. 1'` and the value stored in `invoices.noVatReason` **[V]** is `'ЗДДС, чл. 53, ал. 1 — …'` (`vatGroundValue` = `` `${ref} — ${description}` `` **[V]** `vat-grounds.ts:65`). A substring test on `чл.53 ал.1` never matches → **ВОД / износ / EU-services / освободени all fall through to standard 20%** with a phantom output-VAT leg.
2. The edit/delete/cancel immutability guards proxy through a **user-togglable** `accountingStatus` flag, and `cancelInvoice` has **no guard at all** (`actions.ts:849-888` **[V]** — only `canTransition`). `updateInvoiceAccountingStatus` (`actions.ts:1073` **[V]**) flips `accounted → pending` on any finalized doc with no posting check, so the lock unlatches itself.
3. `received_invoices` has **no `docType` column** **[V]** (`schema.ts:424-526`), so a supplier **credit note books as a positive ДК** and inflates кл.40.

Fix the classifier keying, the posting-existence guards (edit/delete/cancel/toggle), the received-side `docType`/sign, and the mixed-rate tax-line emission before enabling posting. **Slice 1 (read-only) survives the stress test essentially intact** — it needs only the keying fix folded in and a scoped acceptance test.

---

## PART 1 — WHAT IS КОНТИРОВКА

### 1.1 The atomic act

A **контировка** is one *balanced double-entry accounting record* (**счетоводна статия**): the act of deciding, before writing anything, which accounts a business event touches, then writing the pair **сметка Дебит / сметка Кредит + сума**. That written record *is* the счетоводна статия; the link between the debited and credited accounts is **кореспонденция на сметките**; the whole act of posting a document this way is **осчетоводяване**. In Invoicly terms: **one document (invoice or received_invoice) = one контировка = one `journal_entries` header + its Дебит/Кредит `journal_lines`.**

### 1.2 The double-entry axiom and the one hard invariant

**Двустранно / двойно счетоводство** rests on the axiom that every economic operation has a **dual effect** — recorded simultaneously on the **Дебит** (left) of one account and the **Кредит** (right) of another, in equal amounts. Structurally each сметка is a T-account: left = Дебит, right = Кредит. The universal, load-bearing invariant: **nothing posts unless Σ Дебит = Σ Кредит.** (Двустранно is legally mandated for търговски дружества; ЕТ under a threshold may use едностранно.)

**Дебит/Кредит are *positions*, not +/−.** "Debit" and "credit" carry no fixed increase/decrease meaning — the sign depends on the account *type* (below). This is the single most common beginner confusion and the rule the engine encodes.

### 1.3 The активна/пасивна rule (the rule the engine hard-codes)

| Account family | Increases on | Normal (closing) balance | Invoicly accounts |
|---|---|---|---|
| **Активни** (assets) | **Дебит** | Debit | `411` вземания, `501/503` cash/bank, `302/304` inventory, `20x` ДМА, **`4531` ДДС на покупките** |
| **Пасивни** (liab./equity) | **Кредит** | Credit | `401` доставчици, `10x` капитал, **`4532` ДДС на продажбите**, **`4539` ДДС за внасяне** |
| **Приходни** (revenue) → behave like пасивни | **Кредит** | Credit | `70x` |
| **Разходни** (expense) → behave like активни | **Дебит** | Debit | `60x` |
| **Активно-пасивни** (bivalent) | either | side depends on period result | `453` net → `4539` (pay) *or* `4538` (refund) |

This is *why* input VAT (`4531`) accumulates on Дт and output VAT (`4532`) on Кт — and therefore why the month-end close **Dr 4532 / Cr 4531** is a legitimate счетоводна статия, not a hack.

### 1.4 Проста vs сложна статия — why lines are a child table

A **проста** статия has exactly one account on each side. A **сложна** статия has one account on one side and several on the other. **A standard VAT sale is a сложна статия** — `Дт 411 (gross) / Кт 70x (net) + Кт 4532 (VAT)` — one debit, two credits. This is precisely why `journal_lines` is a multi-row child table, not two columns on the header.

### 1.5 Сметкоплан — синтетични / подсметки / аналитични

The **Национален сметкоплан** is a 4-level code hierarchy: **РАЗДЕЛ** (1 digit) → **ГРУПА** (2) → **ПОДГРУПА** (3) → **СИНТЕТИЧНА СМЕТКА** (4). The nine **раздели**: 1 Капитал · 2 Дълготрайни активи · 3 Материални запаси · 4 Разчети (401/411/453) · 5 Финансови средства · **6 Разходи** · **7 Приходи** · 8 free (enterprise-specific) · 9 задбалансови. **Раздели 1–5 are balance-sheet accounts (carry forward); 6–7 are P&L accounts closed every period.**

- **Синтетични** сметки give aggregated, money-only info for a homogeneous group (e.g. `411` as a whole).
- **Подсметки** are an intermediate synthetic level (`453` → `4531/4532/4538/4539`).
- **Аналитични** sub-accounts break a synthetic down by a feature — partner, **currency** (`411/1` лева vs `411/2` евро), material — and may use natural units. Rule: **синтетична = Σ аналитични.**

**Consequence for us:** v1 ships `BG_CHART_OF_ACCOUNTS` as national **synthetic** codes and snapshots code+name on each line; per-currency аналитични (`411/1·411/2`, `453/1·453/2` from ANALYSIS.md) and per-partner analytics are a later editable-chart slice — theory permits this because reports stay correct at the synthetic level.

### 1.6 How a контировка is recorded, proved, and closed

1. **Хронологично** — each статия is registered in strict time order in the **хронологичен регистър** (journal), gap-free.
2. **Систематично** — turnovers carried per account into the **Главна книга** (general ledger): opening balance, оборот Дт, оборот Кт, closing balance.
3. **Оборотна ведомост** (trial balance) — the control instrument, enforcing three equalities: Σ начални Дт = Σ начални Кт; **Σ обороти Дт = Σ обороти Кт = хронологичен регистър total**; Σ крайни Дт = Σ крайни Кт. This is a *free, strong integrity test* worth surfacing as a self-check banner.
4. **Приключване** — at year-end, приключвателни статии close 60x → 61x, then 70x and expenses into **123 Печалби и загуби**; the balance on 123 *is* the financial result (Кт = печалба, Дт = загуба). **The monthly ДДС "close" is a narrow subset of this** — it settles only `4532` against `4531` (§1.9).

> **Scope honesty (from theory):** because a full 123 close needs COGS + payroll (604/605) + depreciation + non-invoice entries, **Invoicly must not claim a P&L / финансов резултат in v1** — it produces the *VAT close* only. It is an accounting **layer that posts VAT**, not a full счетоводна система.

### 1.7 ПРИХОДИ статии — Дт/Кт templates with ДДС mechanics

Notation: **N** = данъчна основа (net), **V** = ДДС, **G = N + V**. `70x` picked by **Основание**. Cells are Приложение-13 (справка-декларация) клетки.

| Case (op) | Дебит | Кредит | База→ДДС клетка | Notes |
|---|---|---|---|---|
| **Услуги 20%** `sale_std_20` | 411 (G) | **703 (N) + 4532 (V)** | кл.11 → **кл.21** | сложна статия; **no COGS** |
| **Услуги 9%** `sale_std_9` | 411 (G) | 703 (N) + 4532 (V@9) | кл.13 → **кл.23** ✅fix (not кл.24) | |
| **Стоки 20%** `sale_std_20` (Основание=Стоки) | 411 (G) | 702 (N) + 4532 (V) | кл.11 → кл.21 | **+2nd entry required** ↓ |
| — себестойност (COGS) | **702 (cost)** | **304 (cost)** | — | **not derivable from invoice** |
| **Продукция** (701) | 411 (G) | 701 (N) + 4532 (V) | кл.11 → кл.21 | COGS: **Dr 701 / Cr 303** — *303 missing from seed chart* |
| **Износ чл.28** `sale_export_0` | 411 (N) | 70x (N) | кл.14 → — | G=N, no 4532 |
| **Межд. транспорт чл.30** `sale_intl_transport_0` | 411 (N) | 70x (N) | **кл.16** → — | 0%, right to credit; v2 |
| **ВОД чл.53 ал.1** `sale_ics_0` | 411 (N) | 702 (N) | кл.15 → — | **VIES ✓** |
| **Услуги ЕС чл.21 ал.2** `sale_eu_services_rc` | 411 (N) | 703 (N) | кл.17 → — | **VIES ✓** |
| **Освободени чл.39–46** `sale_exempt` | 411 (N) | 70x (N) | кл.19 → — | no 4532 |
| **Извън обхвата / нерегистриран** `no_vat_out_of_scope` | 411 (N=G) | 70x (N) | **register=NULL** | *only* op with no дневник row; a 4532 leg with register=NULL is **forbidden** |
| **Кредитно известие** | 411 (−G) | 70x (−N) + 4532 (−V) | negative | червено сторно; НАП **03**; matches `signedVatSql`/`signedGrossSql` **[V]** |

**Worked example (Miro Row 1, услуги 20%):** net 1701.57, VAT 340.31, gross 2041.88 → **Dr 411 2041.88 | Cr 703 1701.57 + Cr 4532 340.31** — balanced; emits one tax line `{register: sales, base 1701.57→кл.11, vat 340.31→кл.21}`.

### 1.8 РАЗХОДИ статии — Дт/Кт templates (the VAT leg is what varies)

One template, variable VAT leg: net → `60x/30x/20x`, gross → `Cr 401` is constant; only the credit leg changes.

| Regime | Дебит | Кредит | База→ДДС клетка |
|---|---|---|---|
| **Услуги, пълен ДК 20%** `purchase_full_20` | **602 (N) + 4531 (V)** | **401 (G)** | кл.31 → кл.41 |
| **Материали** | 601 or 302 (N) + 4531 (V) | 401 (G) | кл.31 → кл.41 |
| **Стоки** | 304 (N) + 4531 (V) | 401 (G) | кл.31 → кл.41 · COGS relief Dr 702/Cr 304 **not derivable** |
| **ДМА (СС 16)** | 20x (N) + 4531 (V) | 401 (G) | кл.31 → кл.41 |
| **Без право на ДК, чл.70** `purchase_no_credit` | **60x/20x (G — VAT capitalised into the cost's nature)** | 401 (G) | **кл.30 → —** (no VAT cell); *not* a blanket 609 |
| **Частичен ДК, чл.73** `purchase_partial` (v2) | 60x (N) + **4531 (V×коеф)** + 60x/609 (V×(1−коеф)) | 401 (G) | кл.32 → кл.42 (коеф→**кл.33**) |
| **Обратно начисляване (ВОП/чл.117/чл.82)** (v2, dual-ledger) | 60x/30x (N) + **4531 (V)** | 401 (N) + **4532 (V)** | прод. кл.12/22 **и** пок. кл.31/41 |

**Reverse charge is the only dual-ledger case:** one document fills *both* registers; net cash-VAT effect is zero under full credit; requires a generated Протокол по чл.117 number (v2).

### 1.9 ДДС as a контировка chain → the REAL VAT

- **Sale** posts output VAT to **`4532`** (пасивна, accumulates Кт). **Purchase** (full credit) posts input VAT to **`4531`** (активна, accumulates Дт).
- **Month-end close** (`kind='vat_close'`, one статия per `vatPeriod`): **Dr 4532 (Σ output) / Cr 4531 (Σ input)** for the lesser; the remainder splits by sign — output > input → **Cr 4539 ДДС за внасяне (кл.50)**; input > output → **Dr 4538 ДДС за възстановяване (кл.60)**. After close, **4531 and 4532 net to zero every month** (a leftover balance is a bug signal).
- **Справка-декларация (Прил. 13):** **кл.20** output = кл.21 (20%) + кл.22 (ВОП/чл.82) + кл.23 (9%); **кл.40** input = кл.41 (пълен) + кл.42×кл.33 (частичен) + кл.43 (годишна корекция); **result кл.50/60 = кл.20 − кл.40** with a sign split, **plus** carry-forward кл.80/81/82 and the чл.92 procedure. *(External research CONFIRMS the plan's кл.50/60; `KONTIROVKA_ANALYSIS.md §9`'s кл.40/50 is superseded — the plan wins.)*
- **кл.50/60 is the REAL VAT that replaces `getVatSummary`.** The estimate equals the real number **only** in the trivial case: all input full-credit, no reverse-charge, no частичен ДК, no годишна корекция — i.e. the micro-SMB. The divergence cases *are the whole reason the engine exists.*

---

## PART 2 — WIRING VERDICT (field-by-field)

### 2.1 OUTGOING invoices → приходна контировка

| Контировка input | Verdict | Evidence / derivation | Fix (if not HAVE) |
|---|---|---|---|
| dealType = Продажба | **DERIVE** | `source ∈ invoices` ⇒ sale (§A2); no field needed | — |
| N / V / G | **HAVE** | `invoices.totals` JSONB `{netAmount,vatAmount,grossAmount}` **[V]** `schema.ts:303`; `parseInvoiceTotalsStrict` | — |
| per-**rate** split (mixed-rate) | **HAVE** | `invoice_lines.vatRate` **[V]** `schema.ts:383` **+** `totals.vatBreakdown[]` from `computeVatBreakdown` **[V]** `calculator.ts:67` | data present; engine must *emit* it (stress #6) |
| currency + fxRate (frozen) | **HAVE** | `invoices.currency` char(3) **[V]** `schema.ts:294` + `invoices.fxRate` numeric(15,6) **[V]** `schema.ts:295`, stamped at finalize | — |
| Партньор ЕИК + име (frozen) | **HAVE** | `recipientSnapshot.uic` / `.legalName` (`PartySnapshot` **[V]** `types.ts:31-44`) | — |
| Партньор ДДС № | **HAVE** | `recipientSnapshot.vatNumber` (nullable) **[V]** | — |
| docType 01/02/03 | **HAVE** | `invoices.docType` varchar(30) **[V]** `schema.ts:283`; CN negated by `signedVatSql` **[V]** | — |
| isVatRegistered gate | **HAVE** | `companies.isVatRegistered` bool **[V]** `schema.ts:59` | — |
| doc №, issue/supply dates | **HAVE** | `invoices.number`/`issueDate`/`supplyDate` **[V]** `schema.ts:289-292` | — |
| vatOperation **std 20/9** | **DERIVE** | `vatMode='standard'` **[V]** `schema.ts:318` + `invoice_lines.vatRate` (20→`sale_std_20`, 9→`sale_std_9`) | — |
| vatOperation **0% / ВОД / EU / exempt** | **DERIVE (BROKEN)** | Signal exists (`invoices.noVatReason` text **[V]** `schema.ts:319`) but plan §3.3 keys on `чл.53 ал.1`, which is **not** the stored string. Real `ref='ЗДДС, чл. 53, ал. 1'` **[V]** `vat-grounds.ts:27`; stored value `'ЗДДС, чл. 53, ал. 1 — …'` **[V]** `vat-grounds.ts:65-67` | **Fix the map** (Part 2.3-F): key on the exact `VAT_EXEMPTION_GROUNDS[].ref`, whitespace-normalized; free-text `"Друго"` → `unclassified` → manual. **MUST FIX.** |
| **Основание → 70x** | **MISSING → ADD `journal_entries.basis`** | no `basis` column; nearest is `articles.type` free varchar default `'service'` **[V]** `schema.ts:207` | Carry `basis` on `journal_entries` (posting-time, editable — already in plan §2.1); optionally promote `articles.type` to enum `ARTICLE_TYPES` |
| structured **frozen country** | **MISSING → ADD `PartySnapshot.country`** | not in `PartySnapshot` **[V]** `types.ts:31-44` (only free-text `address`). Live `partners.country` is mutable **[V]** `schema.ts:159` and the invoice→partner link is `onDelete:'set null'` **[V]** `schema.ts:276`, so it cannot be relied on post-finalize | Add `country: string` to `PartySnapshot` + its Zod parser; populate at finalize from `RecipientInput.country` (Part 2.3-D) |
| **ЕГН vs ЕИК** (individual) | **MISSING → ADD `PartySnapshot.isIndividual`** | `partners.isIndividual` exists **[V]** `schema.ts:157` but is **dropped** from the snapshot | Carry `isIndividual: boolean` + optional `idType` discriminator into `PartySnapshot` (Part 2.3-D) |
| **себестойност / COGS** (goods) | **MISSING → ADD inventory/cost module** | nowhere; `unitPrice`/`defaultUnitPrice` are *selling* prices **[V]** | Inventory/cost module (v2); add **303 Продукция** to chart (Part 2.3-E) |
| vatPeriod / Месец за експорт | **DERIVE** | v1 locks = issueDate month | override arrives in Slice 4 |

**Verdict (outgoing):** the money legs, output VAT, and the дневник-продажби output side are **buildable today**; the 0%/exempt/ВОД classifier is **DERIVE (BROKEN)** by the `noVatReason` format mismatch (must fix), and auto-70x / frozen country / ЕГН / COGS are `MISSING → ADD`. **The sale spine ships once the keying bug is fixed.**

### 2.2 INCOMING received invoices → разходна контировка

| Контировка input | Verdict | Evidence / derivation | Fix (if not HAVE) |
|---|---|---|---|
| dealType = Покупка | **DERIVE** | `source ∈ received_invoices` ⇒ purchase | — |
| N / V / G (frozen at confirm) | **HAVE** | `received_invoices.netAmount/vatAmount/grossAmount` **[V]** `schema.ts:477-485` | — |
| per-**rate** split | **HAVE** | `received_invoice_lines.vatRate` (0/9/20) **[V]** `schema.ts:540`. *Rate lives ONLY per line; there is **no** flat header `vatRate` — the prompt's premise is wrong* | breaks only if OCR returns 0 lines (stress #22) |
| currency + fxRate | **HAVE** | `received_invoices.currency/fxRate` at confirm **[V]** `schema.ts:472-475` | — |
| Партньор ЕИК / име | **HAVE** | `supplierSnapshot` `{legalName, eik, vatNumber}` **[V]** `received/types.ts:22-30` | — |
| supplier **country** | **DERIVE (weak)** | OCR `supplier_address_country` **[V]** `extract/schema.ts:60` → `supplierFromExtraction` **[V]** `received/actions.ts:60` → frozen `supplierSnapshot.country` (nullable). BUT the derived `partners.country` row is coerced `?? 'BG'` **[V]** `received/actions.ts:708`, and OCR itself defaults 'BG' on a BG-looking address, and confidence is never surfaced | Read classification from the *frozen snapshot*, not `partners.country`; stop the `?? 'BG'` coercion; add `supplier_address_country` to `CRITICAL_FIELD_KEYS`; VIES later (Part 2.3-B/C) |
| supplier ДДС № | **HAVE (weak)** | raw OCR string in snapshot, **unvalidated** (no VIES anywhere) | VIES/VAT validation (v2) |
| doc dates | **HAVE** | `issueDate`/`supplyDate` **[V]** `schema.ts:468-469` | — |
| extractionConfidence gate | **HAVE** | `received_invoices.extractionConfidence` varchar(10) **[V]** `schema.ts:454` | — |
| **право на ДК** (пълен/чл.70/чл.73) | **MISSING → ADD credit-right picker** | no column; not derivable from an image | Default `purchase_full_20` + **mandatory human confirm**; чл.70/73 = explicit pick in review panel (Part 2.3-C) |
| **природа на разхода** (60x/30x/20x) | **MISSING → ADD `received_invoice_lines.articleId` (or `nature`)** | no `articleId`, no `type` on received lines **[V]** `schema.ts:528-556` | `basis` picker (default Услуги→602); optionally add `articleId`/`nature` enum (Part 2.3-A) |
| **reverse-charge flag** | **MISSING → ADD OCR hint + manual flag** | not extracted, not stored | Manual checkbox v1; чл.117 dual-ledger + protocol № v2; add `reverse_charge_hint` to OCR (Part 2.3-C) |
| **supplier docType** 01/03/09 | **MISSING → ADD `received_invoices.docType`+`docTypeCode`** | **no `docType` column** **[V]** `schema.ts:424-526` (unlike `invoices.docType`) | **Add `docType`+`docTypeCode`** + OCR detect — else a supplier **credit note books as a positive ДК** (stress #5, Part 2.3-A/C) |
| **vatPeriod / месец на ДК** (чл.72) | **MISSING → ADD `journal_entries.vatPeriod` override** | no field; v1 forces issueDate month | `vatPeriod` on `journal_entries` (in plan §2.1) + Slice 4 override |
| validated VAT registration | **MISSING → ADD VIES** | raw string only | manual VIES v1, lookup v2 |

**Verdict (incoming):** a **plain domestic full-credit 20% purchase wires today** via the `purchase_full_20` default; **every** weak-signal variant (credit-right, expense nature, reverse-charge, supplier docType, ДК month) is `MISSING → ADD` new columns + human input in Меню Контиране — plus two genuine defects: the `?? 'BG'` country coercion and the missing received-side `docType`.

### 2.3 CONSOLIDATED — what we must add (copy-paste-actionable)

Ordered by necessity. Snippets follow the existing `schema.ts` conventions (`serial` PK, `integer` company FK `onDelete:'cascade'`, **varchar not pg-enum** for status/kind, `numeric(15,4)` money / `numeric(15,6)` fxRate, app-level `as const` enums per `schema.ts:820+`). Items tagged **[plan §2.1]** are already specced in `KONTIROVKA_PLAN.md`; items tagged **[NEW]** are gaps the plan itself does not cover and are the high-value additions.

#### A. Schema — Drizzle columns / tables

**A1. Journal tables (MVP, sales posting) — [plan §2.1], reproduced for completeness.** Add to `lib/db/schema.ts`, then `db:generate` → `0008_kontirovka.sql`: `journalEntries`, `journalLines`, `journalTaxLines`, `journalSequences` (and `accountingPeriods` in Slice 4). The plan already gives full definitions; the load-bearing details the stress test depends on:

```ts
// journal_entries — one контировка header per posted document
sourceInvoiceId:         integer('source_invoice_id').references(() => invoices.id, { onDelete: 'restrict' }),         // NOT set null
sourceReceivedInvoiceId: integer('source_received_invoice_id').references(() => receivedInvoices.id, { onDelete: 'restrict' }),
status:            varchar('status', { length: 20 }).notNull().default('draft'),  // draft | posted | reversed
reversedByEntryId: integer('reversed_by_entry_id'),                               // self-FK for сторно
vatPeriod:         char('vat_period', { length: 7 }),                             // 'YYYY-MM'
basis:             varchar('basis', { length: 50 }),                              // Основание → 70x/60x
vatOperation:      varchar('vat_operation', { length: 40 }),                      // header default op
// unique posting per source (one контировка per document):
//   uniqueIndex('je_source_invoice_unique').on(t.sourceInvoiceId).where(sql`... IS NOT NULL`)

// journal_tax_lines — per-rate данъчна проекция (feeds дневник/декларация)
register: varchar('register', { length: 10 }),   // 'sales' | 'purchases' | null  (null ⇒ NOT ledgered)
base:  numeric('base',  { precision: 15, scale: 4 }).notNull().default('0'),
vat:   numeric('vat',   { precision: 15, scale: 4 }).notNull().default('0'),
// CHECK: a VAT amount may never sit in no register (§A4)
check('jtl_vat_requires_register', sql`(${t.vat} = 0) OR (${t.register} IS NOT NULL)`),
```

**A2. `received_invoices.docType` + `docTypeCode` — [NEW], fixes stress #5.** The plan puts `docTypeCode` on `journal_entries` but the *source* row has none, so a received credit note cannot be detected or sign-negated before posting (and the Slice-1 purchase ledger is unsigned). Mirror `invoices.docType`:

```ts
// add to receivedInvoices (schema.ts:424) — parallels invoices.docType (schema.ts:283)
docType:     varchar('doc_type', { length: 30 }).notNull().default('invoice'), // RECEIVED_DOC_TYPES
docTypeCode: char('doc_type_code', { length: 2 }),                             // НАП: '01' | '03' | '09'
```

**A3. `received_invoice_lines.articleId` / `nature` — [NEW/optional], природа на разхода.** Gives a stored signal for the 60x/30x/20x credit leg:

```ts
// add to receivedInvoiceLines (schema.ts:528)
articleId: integer('article_id').references(() => articles.id, { onDelete: 'set null' }),
// OR, if not linking a catalog article:
nature:    varchar('nature', { length: 20 }),   // ACCOUNTING_BASES value
```

**A4. `accounting_periods` — [plan §2.1], Slice 4** (`period` char(7), `status` open|closed, `closeEntryId`) — needed for period lock + close race fix (stress #8).

#### B. App-level enums (`as const`, mirroring `schema.ts:820+`)

```ts
// src/features/kontirovka/constants.ts  (NEW)
export const JOURNAL_ENTRY_KINDS  = ['document', 'vat_close', 'manual', 'reversal'] as const;
export const JOURNAL_STATUSES     = ['draft', 'posted', 'reversed'] as const;
export const DEAL_TYPES           = ['sale', 'purchase'] as const;
export const JOURNAL_SIDES        = ['debit', 'credit'] as const;
export const REGISTERS            = ['sales', 'purchases'] as const;      // null ⇒ not ledgered

export const VAT_OPERATIONS = [
  // sales
  'sale_std_20', 'sale_std_9', 'sale_export_0', 'sale_ics_0',
  'sale_intl_transport_0', 'sale_eu_services_rc', 'sale_outside_scope',
  'sale_triangular', 'sale_exempt', 'no_vat_out_of_scope',
  // purchases
  'purchase_full_20', 'purchase_full_9', 'purchase_no_credit',
  'purchase_partial', 'vop_protocol', 'art82_services_rc',
  // sentinel — free-text ground the engine could not classify
  'unclassified',
] as const;
export type VatOperation = (typeof VAT_OPERATIONS)[number];

export const ACCOUNTING_BASES = ['services', 'goods', 'production', 'materials', 'fixed_asset', 'other'] as const;

// received-side document type — parallels DocType (schema.ts:828)
export const RECEIVED_DOC_TYPES = ['invoice', 'credit_note', 'debit_note', 'protocol'] as const;
// НАП вид документ: 01 фактура, 03 кредитно известие, 09 протокол (чл.117)

// optional: promote articles.type (free varchar) to a constrained set
export const ARTICLE_TYPES = ['service', 'goods', 'production', 'material', 'fixed_asset'] as const;
```

#### C. Extraction (AI-OCR) — exact fields to add to `app/api/invoices/extract/schema.ts`

```ts
// add to ExtractedInvoiceSchema (extract/schema.ts:31)
// 1. supplier document type — фактура / кредитно-дебитно известие / протокол (fixes #5)
supplier_document_type: z.object({
  value: z.enum(['invoice', 'credit_note', 'debit_note', 'protocol']).nullable(),
  confidence: FieldConfidenceSchema,
  reason: z.string().nullable().optional(),
}),
// 2. reverse-charge / "ДДС не е начислен, основание чл.X" hint (fixes #9 self-charge miss)
reverse_charge_hint: z.object({
  value: z.boolean().nullable(),
  confidence: FieldConfidenceSchema,
  reason: z.string().nullable().optional(),
}),
// 3. the cited no-VAT ground text, if any (e.g. "чл. 21, ал. 2", "чл. 163а")
no_vat_ground: StringFieldSchema,
```

Two one-line follow-ups in the same file / pipeline:
- **Add country to the retry gate:** `CRITICAL_FIELD_KEYS` (`extract/schema.ts:105`) currently omits `supplier_address_country`; add it so a missing/low country triggers the second pass.
- **Stop silently defaulting:** in `received/actions.ts:708`, replace `country: patch.supplier.country ?? 'BG'` with `country: patch.supplier.country ?? null` (the column is not-null default 'BG' — keep the DB default but stop overwriting a genuine null with a guess), and surface `supplier_address_country.confidence` in the review UI.

Also extend the `SYSTEM_PROMPT` extraction rules (`extract-invoice.ts:65+`) with detection guidance for the three new fields (look for "Кредитно известие"/"Дебитно известие"/"Протокол" in the title; "обратно начисляване"/"чл. 163а"/"reverse charge"; the printed ЗДДС ground).

#### D. Frozen snapshot — extend `PartySnapshot` (`src/features/bulgarian-invoicing/types.ts:31`) and its Zod parser

```ts
export interface PartySnapshot {
  legalName: string;
  address: string;
  uic: string;
  vatNumber: string | null;
  country: string;                        // [NEW] ISO-2, frozen at finalize from RecipientInput.country
  isIndividual: boolean;                  // [NEW] ЕГН vs ЕИК discriminator, frozen at finalize
  idType?: 'eik' | 'egn' | 'foreign';     // [NEW, optional] explicit identifier kind for дневник rendering
  bankName?: string; iban?: string; bic?: string;
}
```
Mirror `country` + `isIndividual` in the Zod schema behind `parsePartySnapshotStrict`, and populate both at finalize from `RecipientInput.country` / `partners.isIndividual`.

#### E. Chart of accounts — add `303 Продукция` to `BG_CHART_OF_ACCOUNTS`

The seed constant (plan §2.3, typed `{ code, name, kind, isVat }[]`) lists `701/702/703` (revenue) and `302/304` (запаси) but **not** `303`, so production COGS (`Dr 701 / Cr 303`) has no credit account:

```ts
{ code: '303', name: 'Продукция', kind: 'active', isVat: false },   // [NEW] — enables production-goods COGS relief
```

#### F. Logic — the `ref → VatOperation` keying map (fixes #2 / P1, MUST precede posting)

Key on the exact `VAT_EXEMPTION_GROUNDS[].ref` strings (`vat-grounds.ts:21`), not the plan's abbreviated tokens. Because `invoices.noVatReason` stores `vatGroundValue(g)` = `` `${ref} — ${description}` ``, resolve by exact-ground match, then map the `ref`:

```ts
// src/features/kontirovka/vat-operation-map.ts  (NEW)
import { VAT_EXEMPTION_GROUNDS, isKnownVatGround } from '@/features/bulgarian-invoicing/vat-grounds';

// keyed on the EXACT ref constants in vat-grounds.ts (whitespace as stored)
const REF_TO_VAT_OPERATION: Record<string, VatOperation> = {
  'ЗДДС, чл. 21, ал. 2': 'sale_eu_services_rc',      // кл.17, VIES
  'ЗДДС, чл. 53, ал. 1': 'sale_ics_0',               // кл.15, VIES (ВОД)
  'ЗДДС, чл. 28':        'sale_export_0',             // кл.14
  'ЗДДС, чл. 30':        'sale_intl_transport_0',     // кл.16 (v2 — until then treat as unclassified)
  'ЗДДС, чл. 39':        'sale_exempt',               // кл.19
  'ЗДДС, чл. 40':        'sale_exempt',
  'ЗДДС, чл. 41':        'sale_exempt',
  'ЗДДС, чл. 44':        'sale_exempt',
  'ЗДДС, чл. 45':        'sale_exempt',
  'ЗДДС, чл. 46':        'sale_exempt',
};

export function deriveExemptVatOperation(noVatReason: string | null): VatOperation {
  if (!noVatReason) return 'unclassified';
  if (!isKnownVatGround(noVatReason)) return 'unclassified';      // free-text "Друго" → manual pick
  const ground = VAT_EXEMPTION_GROUNDS.find(
    (g) => noVatReason === `${g.ref} — ${g.description}` || noVatReason.startsWith(g.ref)
  );
  return (ground && REF_TO_VAT_OPERATION[ground.ref]) ?? 'unclassified';
}
```

Rules that make this safe: (1) unknown/free-text ground → `unclassified` → **manual pick**, never `sale_std_20` and never `no_vat_out_of_scope` (which drops the sale from кл.19 by setting `register=NULL`); (2) `sale_std_20`/`sale_std_9` come from `vatMode='standard'` + line rate, not from this map. **Build this map once, in `dnevnik.ts`, in Slice 1** — it is the first place the derived op is surfaced, and every later slice inherits it correct.

#### G. UX / form (Меню Контиране)

- **Sales (Slice 2):** **Основание** selector (auto-default from `articles.type`/line description, human-confirm) · **Операция по ДДС** select (pre-filled from the *fixed* `deriveExemptVatOperation`) · **VIES** manual checkbox · editable Дт/Кт grid · capture recipient **country** into the snapshot at finalize.
- **Purchases (Slice 3):** purchase review panel adding **credit-right**, **nature→account**, **reverse-charge**, **vatPeriod** — none exist on `ReceivedInvoiceReviewInput` today **[V]** (`received/types.ts:41-61`); **confidence-gate** auto-post on `extractionConfidence`.

---

## PART 3 — STRESS TEST (ranked critical → low)

Severity reflects blast radius **and** silence (a wrong number nobody is prompted to check outranks a loud failure). "Slices" = the plan §7 slices the fix lands in (1 read-only · 2 sales posting · 3 purchases · 4 period close · 5 дневник/декларация · 6 НАП export · Later = v2). Every CRIT/HIGH row names a concrete, code-level fix and its slice.

| # | Sev | Scenario → why it breaks | Concrete fix (code target) | Slice |
|---|---|---|---|---|
| 1 | **CRIT** | **Immutability proxied through a togglable flag.** Post an invoice (→`accounted`, контировка filed) → owner clicks the shipped inline `accounted→pending` toggle **[V]** `updateInvoiceAccountingStatus` (`actions.ts:1073`, no posting check) → `updateInvoiceDraft` (`actions.ts:647`, keyed on `accountingStatus`) now allows editing amounts/partner behind a *filed* ledger row. | Key **all** guards on **`EXISTS(non-reversed journal_entries WHERE source…=id)`**, not `accountingStatus`. Specifically: (a) block `updateInvoiceAccountingStatus('pending')` when a posting exists; (b) re-point the `updateInvoiceDraft`/`deleteInvoice`/`cancelInvoice` guards to posting-existence. Reversal is the only unlock. | 2, 4 |
| 2 | **HIGH** | **Sales 0%/exempt classifier silently broken.** Plan keys on `чл.53 ал.1`; `noVatReason` stores `'ЗДДС, чл. 53, ал. 1 — …'` **[V]** (`vat-grounds.ts:27,65`). Substring match fails → **ВОД/износ/EU/exempt all fall through to `sale_std_20`** → wrong дневник cell + phantom output VAT. | Ship `deriveExemptVatOperation` (Part 2.3-F): exact-`ref` map + `isKnownVatGround`; free-text → `unclassified` → manual. | 1, 2 |
| 3 | **HIGH** | **`cancelInvoice` has no accounting/posting guard** **[V]** (`actions.ts:849-888` — only `canTransition`). A finalized+**accounted** invoice with a posted контировка can be cancelled: it drops out of `getVatSummary` while the journal + дневник row survive → estimate vs real diverge + phantom дневник row. Delete-guard shipped; **cancel was missed.** | Add a cancel-guard mirroring delete: refuse cancel while a non-reversed posting exists (reverse first), OR auto-post a сторно in the current open period. Make `uncancelInvoice` symmetric. | 2 |
| 4 | **HIGH** | **Posted received invoice still editable.** `updateReceivedInvoiceDraft` **[V]** (`received/actions.ts:795`) blocks only `status==='discarded'` — no `accounted`/posting guard → net/VAT/partner behind a posted purchase контировка can change, desyncing дневник покупки. Note: keying on `accountingStatus==='accounted'` (as plan §2.6 proposes) is **insufficient** (same togglable-flag hole as #1). | Ship the guard **keyed on posting existence** (not `accountingStatus`) before Slice 2. | 2, 3 |
| 5 | **HIGH** | **No received docType → supplier credit notes book as positive ДК.** `received_invoices` has no `docType` **[V]** (`schema.ts:424-526`); `signedVatSql` **[V]** negates only *outgoing* `credit_note`. A purchase CN inflates кл.40 and corrupts the оборотна ведомост. | Add `docType`/`docTypeCode` (Part 2.3-A2), OCR-detect (`supplier_document_type`, Part 2.3-C), sign-negate in the purchase engine **and** in the purchase ledger reader (`dnevnik.ts`). | 3, 5 (+ Slice 1 test, Part 4) |
| 6 | **HIGH** | **Mixed 20%+9% misfiled.** Header carries one scalar `vatOperation`; a `1000@20% + 500@9%` doc emits a single `sale_std_20` tax line → 500 base lands in кл.11 and 45 VAT in кл.21 instead of кл.13/кл.23. Contra still balances — the error is invisible. Plan `C-MVP-1` defers emission but does **not block** posting a mixed doc. | Emit one `journal_tax_line` per `totals.vatBreakdown` entry from day one (trivial loop over the frozen JSONB **[V]** `calculator.ts:67`), OR hard-block/flag mixed-rate out of auto-post. | 2, 5 |
| 7 | **HIGH** | **Exempt company → illegally overstated кл.40.** The app ships exempt grounds (чл.39–46), so target users make exempt supplies; their shared-input VAT is non-deductible (чл.70) or partial (чл.73), but v1 defaults every purchase to `purchase_full_20`. Also: an unmapped free-text exempt `noVatReason` defaulting to `no_vat_out_of_scope` (register=NULL) silently drops the sale from кл.19. | When any exempt output exists, do **not** default purchases to full credit — force credit-right review / warn кл.40 is provisional; map unknown `noVatReason` to a **ledgered** op (safest `sale_exempt` кл.19 or `unclassified`), never register=NULL. | 3, 5 |
| 8 | **HIGH** | **Close-vs-post write-skew race.** Under READ COMMITTED, TX-A posts into `2026-07` while TX-B runs close for `2026-07`; A's trigger sees `open`, B's close SELECT doesn't see A's uncommitted rows → A lands in an already-filed closed period, excluded from the filed кл.50. A separate-row constraint trigger cannot stop this. | Serialize on the period row: both paths `SELECT … FOR UPDATE` the `accounting_periods` row (create `open` if absent), or run close under SERIALIZABLE + retry. | 4 |
| 9 | **HIGH** | **`'BG'` coercion masks foreign suppliers.** **[V]** `received/actions.ts:708` `?? 'BG'` → the derived `partners.country` reads domestic → wrong credit-right + missed reverse-charge self-charge. (Frozen `supplierSnapshot.country` does keep the OCR value, but classification must read *that*, not the partner row.) | Persist OCR country/VAT-№; classify off the frozen snapshot; stop `?? 'BG'`; default purchases to full-20 + mandatory confirm; manual reverse-charge/credit-right picker. | 3 |
| 10 | **MED** | **Аванс нетиране template double-counts output VAT.** Advance books `Cr 4532 V`; final invoice books another `Cr 4532 V`; the plan's нетиране reverses only the **net** → 4532 = 2V → кл.20 inflated for every deposit month. | Correct the §3.5 template: нетиране must also `Dr 4532 V_adv + Dr 412 N_adv | Cr 411 G_adv` (or issue the final for the remaining base only) **before the v2 build**. (Plan §3.5/§3.3 lines 331 already show the reverse — pin it and the vatPeriod split.) | Later (v2) |
| 11 | **MED** | **Частичен ДК coefficient double-applied.** Row 14 books `Dr 4531 = V×коеф` (split at posting) while §5.1 close computes input = кл.41 + **кл.42×кл.33**; if кл.42 stores the already-scaled V, the close scales again → credit halved. | Pin the invariant: journal `4531 = V×коеф`; tax-line **кл.42 carries FULL base/VAT**; close applies кл.33 only to кл.42. Model годишна корекция (кл.43) as a December `vat_close` correction. | Later (v2) |
| 12 | **MED** | **Balance trigger not implementable as written.** Plan §2.4.1 specs a "statement-level, keyed by entry" CONSTRAINT TRIGGER; Postgres requires CONSTRAINT TRIGGER = **AFTER + FOR EACH ROW**. | Specify a **per-row `DEFERRABLE INITIALLY DEFERRED`** trigger keyed by `NEW.journal_entry_id` (dedupe via a per-entry marker); drop the "statement-level / cheaper" wording. | 2 |
| 13 | **MED** | **Reversal under-specified.** Marking `posted→reversed` is itself an UPDATE on a posted row — a naive "block all UPDATE where status=posted" bricks reversal; and nothing prevents reversing an already-`reversed` entry (double negation). | `prevent_posted_journal_mutation` whitelists **only** the `posted→reversed` (+`reversedByEntryId`) column change; the reverse action requires target `status='posted'` and sets `reversedByEntryId` atomically. | 2 |
| 14 | **MED** | **issueDate ≠ данъчно събитие.** Plan §1.2 maps `documentDate ← issueDate`; данъчното събитие is the **supply** date. With the legal 5-day issue window a 30-June supply invoiced 3 July files in July → wrong дневник month for every cross-month doc. | Drive `vatPeriod`/изискуемост from `supplyDate` **[V]** (`schema.ts:292`) with the ЗДДС cap; at minimum warn when `supplyDate` month ≠ `issueDate` month. | 2, 4 |
| 15 | **MED** | **Per-line vs per-document rounding.** `computeLineItem` rounds VAT **per line** **[V]** (`calculator.ts:39`); `computeTotals`/`computeVatBreakdown` sum the already-rounded values **[V]** (`:73,:97,:101`) → frozen `totals.vatAmount` is per-line (e.g. two lines of 15.23 @20%: per-line 3.05+3.05 = **6.10** vs per-document round(6.092) = **6.09** — differs by 0.01). §3.6's "per document" promise is **unattainable from stored data.** Contra still balances. | Declare the invoice's stored (per-line) totals authoritative for **both** posting and дневник; emit tax lines from `vatBreakdown`; **drop the "per document" wording** in §3.6/§8.2.9. | 2, 5 |
| 16 | **MED** | **FX corrupts the filing figure, not just balances.** Plan §2.5 frames FX as "immaterial 401/411 drift"; ЗДДС чл.26 ал.6 wants the VAT base/amount at the **БНБ rate on the tax-event date**, but we freeze `fxRate` at confirm → кл.11/20/21 misstated for non-EUR docs. (Nil for EUR-base post-2026.) | For non-base-ccy docs compute the VAT base/amount at the БНБ tax-event-date rate; re-label the §2.5 limitation to name the **VAT-figure** impact. | 4, 5 |
| 17 | **MED** | **Frozen country absent (outgoing)** → a plain 20% invoice mistakenly issued to an EU partner auto-classifies domestic; cross-border rests entirely on the issuer's ground pick. `PartySnapshot` has no `country` **[V]** (`types.ts:31-44`). | Add structured `country` to `PartySnapshot`, populate at finalize (Part 2.3-D). | 2 |
| 18 | **MED** | **Основание has no reliable stored signal** — sales `articles.type` defaults `'service'` **[V]** (`schema.ts:207`); received lines have nothing **[V]** → auto-account is a blind default. | Editable Основание selector + human-confirm; enum `ARTICLE_TYPES`; `articleId`/`nature` on received lines (Part 2.3-A3/B). | 2, 3 |
| 19 | **MED** | **Balanced-but-misclassified posting** — a non-accountant owner can post услуги to 702 or 20% as `sale_exempt`; the only gate is Σ Дт=Σ Кт. No signal it's mis-mapped. | For owners, hide raw Дт/Кт behind a plain-language summary; mark overrides "изисква преглед"; keep derive-draft + explicit post. | 2 |
| 20 | **MED** | **Backdated doc into a closed+flipped month** → estimate is hidden, the closed кл.50 excludes it, posting is blocked → silent understatement of the filed figure. | After close, keep computing the estimate population; show a reconciliation banner (`N docs added after close`) + controlled reopen (reverses the `vat_close`). | 4 |
| 21 | **MED** | **ЕГН vs ЕИК indistinguishable** in the frozen snapshot (`isIndividual` dropped, `partners.isIndividual` exists **[V]** `schema.ts:157`) → posting/дневник can't render the correct identifier. | Carry `isIndividual` + `idType` into `PartySnapshot` (Part 2.3-D). | 2 |
| 22 | **MED** | **OCR header total, 0 lines** — rate lives only per line **[V]** (`schema.ts:540`); `mapExtractionToDraft` tolerates 0 lines → no per-rate breakdown → `journal_tax_lines` can't be grouped for a mixed purchase. | Require ≥1 rated line before a purchase posting; gate on `extractionConfidence` **[V]** (`schema.ts:454`). | 3 |
| 23 | **LOW** | **Goods/production COGS-incomplete** — no cost data; 304/303 never relieved → ~100% gross margin. VAT is fully correct. Honestly disclosed. | Keep the "P&L/COGS-incomplete" banner; refuse to surface any финансов резултат until an inventory module + `303` exist (Part 2.3-E). | 3, 5 (banner) |
| 24 | **LOW** | **Foreign supplier, no ЕИК** → frozen `uic` blank → дневник identity column empty → НАП fixed-width export rejects. (`partners.eik` is nullable **[V]** `schema.ts:155`.) Posting still balances. | Allow VAT-№ (or foreign-id placeholder) as the identifier; validate identity at export time. | 5, 6 |
| 25 | **LOW** | **Zero/negative edges** — an all-zero doc posts a meaningless balanced entry; a `docType='invoice'` with negative net (discount >100% / negative qty) posts as a minus in кл.11/21 instead of routing through a код-03 CN. | Block posting when all lines are zero; validate `net ≥ 0` for `{invoice, debit_note}`; route reductions through `credit_note`. | 2 |
| 26 | **LOW** | **Proforma exclusion is convention-only** — `sourceInvoiceId` is a plain FK; nothing structurally stops posting a proforma (`invoices.docType` allows `'proforma'` **[V]**). | Engine/post guard (+ DB check) refusing a source with `docType='proforma'`. | 2 |
| 27 | **LOW** | **Settlement not posted** — MVP posts the invoice not the payment (correct for accrual) → 411/401 never clear. Documented. | v2 payment→cash (501/503) + курсови разлики (624/724). | Later |

**Verified SOUND (do not re-litigate):** non-registered issuer posts a valid journal via `companies.isVatRegistered` **[V]**; credit-note chain (negate legs) is sign-consistent with `signedVatSql`/`signedGrossSql` **[V]** (`money.ts:27,71`); **Прогноза→real is a HARD SWAP, never additive** (a half-posted month shows one figure); `allocateNumber` posting numbers are **gap-free and concurrency-safe** (same pattern as `actions.ts:213`); proforma correctly excluded from money aggregates **[V]** (`money.ts:37,47`).

### 3.1 Triage

**MUST FIX before v1 posting (Slice 2/3/4 gates):** #1 accountingStatus-as-lock · #2 vat-grounds keying · #3 cancel-guard · #4 received edit-guard · #5 received docType + CN sign · #6 mixed-rate tax lines · #7 exempt-company credit default + unmapped-ground safety · #8 close/post race · #9 `'BG'` coercion · #12 trigger grain · #13 reversal guard · #25/#26 zero-amount / proforma guards.

**SAFE TO DEFER (correct the doc now, build later):** #10 аванс template · #11 частичен-ДК locus · #14 supply-date period · #16 FX filing figure · #20 backdate-after-close banner · #21 ЕГН · #22 empty-lines guard · #24 foreign-id export.

**DOCUMENTED-INCOMPLETE (ship with an honest banner):** #23 COGS/P&L-incomplete (+ add `303`) · #27 unposted settlement (411/401 don't clear) · #15 is a *documentation* correction (per-line rounding is the real basis) · #17/#18/#19 are assisted-manual by design once the schema/UX above land.

---

## PART 4 — AMENDED FIRST SLICE + PLAN CORRECTIONS

### Does Slice 1 survive the stress test? — **Yes, essentially intact.**

Slice 1 is **read-only** (`getSalesLedger`/`getPurchaseLedger` in `lib/db/queries/dnevnik.ts` over `money.ts`, month-row drill-down, zero new tables, zero posting semantics — confirmed not yet built **[V]**: the functions exist only in the plan, `money.ts` has just the `signed*Sql` helpers). None of the CRITICAL/HIGH posting defects (#1, #3, #4, #6, #8, immutability, period race) have any surface in Slice 1. **But two Slice-1-reachable issues force amendments**, because Slice 1 already renders a *derived* «изведена Операция по ДДС» column and already asserts an estimate↔ledger reconciliation:

**Amended Slice 1 ("Разбивка на месеца"):**
1. **Keep** the read-only two-list drill-down (`№ · дата · контрагент+ЕИК · основа · ДДС · ставка · изведена операция`); zero new tables. Survives.
2. **Fold in the vat-grounds keying fix (#2) here.** Slice 1 is the *first place the derived op is surfaced*, so the format-mismatch bug is reachable now as a wrong read-only label. Build `deriveExemptVatOperation` (Part 2.3-F) once, in `dnevnik.ts`; every later slice inherits it correct.
3. **Amend the acceptance test.** The plan's `Σ(purchase list) == vatPaid` passes today only because **both** `getVatSummary` and `getPurchaseLedger` are *equally* blind to received credit notes (no `docType`) — they are wrong *together* (#5). Either (a) scope the purchase invariant to **months with no received credit notes** and say so in the test, or (b) pull the received `docType`+sign forward. Keep `Σ(sales list) == vatIssued` (sound). Document that the purchase leg is unsigned-for-CN until docType lands.
4. Keep the desktop+mobile, no-console-error, assert-the-numbers bar (CLAUDE.md).

Everything else is a **Slice 2 posting-gate**, not a Slice 1 concern.

### The Slice 2 gate (before "Осчетоводи" ships)
Keying fix (#2) · cancel-guard (#3) · received edit-guard keyed on posting (#4) · block `updateInvoiceAccountingStatus('pending')` when posted (#1) · per-`vatBreakdown` tax-line emission or hard-block mixed (#6) · per-row deferred balance trigger, drop "statement-level" (#12) · reversal posted-only + whitelist (#13) · zero/negative + proforma guards (#25/#26) · unmapped-ground → ledgered op (#7).

### Plan corrections register (edits to `KONTIROVKA_PLAN.md` / `KONTIROVKA_ANALYSIS.md`)

| # | Where | Correction |
|---|---|---|
| P1 | §0.1 C1, §3.3 (line 311-312), Row 4 | **Keying is factually wrong.** `чл.53 ал.1` is **not** the string in `vat-grounds.ts` **[V]** — the `ref` is `'ЗДДС, чл. 53, ал. 1'` and the stored value is `'ЗДДС, чл. 53, ал. 1 — …'`. Replace the tokens with the exact `VAT_EXEMPTION_GROUNDS[].ref` and use `deriveExemptVatOperation` (Part 2.3-F). The §3.3 phrase "keyed on the strings actually in `vat-grounds.ts`" is currently self-contradicting. |
| P2 | §2.4.1 guard 1 / §F2c | A Postgres CONSTRAINT TRIGGER cannot be statement-level. Specify **per-row DEFERRABLE INITIALLY DEFERRED, keyed by `NEW.journal_entry_id`**; drop "fired statement-level … cheaper on multi-line inserts". |
| P3 | §2.6 / §F2d | The edit/delete/**cancel** lock must key on **"a non-reversed posting exists"**, not `accountingStatus` (which is user-togglable via `updateInvoiceAccountingStatus` **[V]** `actions.ts:1073`, no posting check). Add the missing `cancelInvoice` guard **[V]** (`actions.ts:849`) and block `updateInvoiceAccountingStatus('pending')` when posted. §2.6's "add the `accountingStatus==='accounted'` guard" is necessary but **not sufficient**. |
| P4 | §2.4.1 guard 4 / §5.2 | Period close vs post is a **write-skew race**; both paths `SELECT … FOR UPDATE` the `accounting_periods` row (or SERIALIZABLE + retry). |
| P5 | §3.5 аванс | Confirm нетиране **also reverses advance VAT** (`Dr 4532 V_adv + Dr 412 N_adv / Cr 411 G_adv`); the plain net-only reverse double-counts output VAT. Pin before the v2 build. |
| P6 | §3.2 Row 14, §5.1 | Pin the частичен-ДК coefficient locus: journal `4531 = V×коеф`, tax-line **кл.42 = FULL base/VAT**, close applies кл.33 only to кл.42; годишна корекция = December `vat_close`. |
| P7 | §3.6, §8.2.9 | Shipped `calculator.ts` rounds **per line** **[V]** (`:39`); the frozen `totals` cannot honor a "per-document" VAT guarantee. Declare stored per-line totals authoritative for posting + дневник; emit tax lines from `vatBreakdown`; drop the contradictory "per-document" wording. |
| P8 | §1.2, §3.3 | Carry structured **`country`** and **`isIndividual`** into `PartySnapshot` at finalize (Part 2.3-D); **stop the received-side `?? 'BG'`** coercion **[V]** (`received/actions.ts:708`) and classify off the frozen snapshot. |
| P9 | §2.1, Slice 3/5 | Add **`docType`/`docTypeCode` to `received_invoices`** (Part 2.3-A2) and sign received CNs in the purchase engine + `dnevnik.ts` before any purchase reconciliation claim; scope the Slice 1 acceptance test accordingly. |
| P10 | §2.2, §3.3 step 5 | Post-time reconciliation must be **per-register** (Σ 4532 == sales-register vat **AND** Σ 4531 == creditable purchases-register vat), not one global equality — else reverse-charge dual-ledger docs false-fail. |
| P11 | §1.3 C-MVP-1, Slice 2 | C-MVP-1 defers mixed-rate emission but must also **block posting a mixed-rate doc** (or emit per-`vatBreakdown` tax lines from day one — the data is present **[V]** `calculator.ts:67`). |
| P12 | §1.2 | `documentDate (=данъчно събитие) ← issueDate` is wrong: данъчно събитие is the **supply date** **[V]** (`invoices.supplyDate` `schema.ts:292`). Drive `vatPeriod` from `supplyDate` (ЗДДС cap) or warn on month mismatch. |
| P13 | §2.3 | Add **`303 Продукция`** to `BG_CHART_OF_ACCOUNTS` (Part 2.3-E) — production COGS has no credit account without it. |
| P14 | §2.5, §F5f | Re-label the FX limitation: for non-base-ccy docs it corrupts the **кл.11/20/21 filing figure** (БНБ-rate-on-tax-event), not merely 401/411 balances. |
| P15 | — | `KONTIROVKA_ANALYSIS.md §9` result cells (кл.40/50) remain **superseded** by the plan's кл.50/60 — keep flagged. |

**Bottom line:** ship **Slice 1** now (read-only + the keying fix + a scoped acceptance test). Do **not** enable posting until the Slice-2 gate above is closed — the classifier keying, the four posting-existence guards (edit/delete/**cancel**/toggle), the received `docType` sign, and the mixed-rate tax-line emission are correctness-blockers, not polish. Correct the аванс and частичен-ДК templates in the doc now so the v2 implementer doesn't inherit a VAT-doubling posting.

---

## Relevant files (absolute)

- `D:\Work\invoice-starter\docs\KONTIROVKA_PLAN.md` · `D:\Work\invoice-starter\docs\KONTIROVKA_ANALYSIS.md`
- `D:\Work\invoice-starter\lib\db\schema.ts` — invoices `:262`, invoice_lines `:367`, received_invoices `:424` (no docType), received_invoice_lines `:528`, partners `:138` (`isIndividual:157`, `country:159`, `eik:155` nullable), companies `:50` (`isVatRegistered:59`), articles `:188` (`type:207`), app enums `:820+`
- `D:\Work\invoice-starter\src\features\bulgarian-invoicing\vat-grounds.ts` — P1: `VAT_EXEMPTION_GROUNDS` `:21`, `vatGroundValue` `:65`, `isKnownVatGround` `:70`
- `D:\Work\invoice-starter\src\features\bulgarian-invoicing\calculator.ts` — P7/#15: per-line VAT rounding `:39`, `computeVatBreakdown` `:67`, `computeTotals` `:91`
- `D:\Work\invoice-starter\src\features\bulgarian-invoicing\types.ts` — `PartySnapshot` `:31` (no country/isIndividual)
- `D:\Work\invoice-starter\src\features\bulgarian-invoicing\actions.ts` — cancel `:849` (no guard), edit-guard `:647`, delete-guard `:964`, accounting toggle `:1073` (no posting check)
- `D:\Work\invoice-starter\src\features\received-invoices\actions.ts` — edit-guard `:795` (blocks only discarded), `?? 'BG'` coercion `:708`, OCR→snapshot country `:60`, delete-guard `:1201`
- `D:\Work\invoice-starter\src\features\received-invoices\types.ts` / `schema.ts` — `SupplierSnapshot` (has country), `ReceivedInvoiceReviewInput` `:41` (no docType/credit-right/nature/reverse-charge)
- `D:\Work\invoice-starter\lib\db\queries\money.ts` — `signedGrossSql` `:27`, `signedVatSql` `:71` (negate outgoing `credit_note` only)
- `D:\Work\invoice-starter\app\api\invoices\extract\schema.ts` — OCR fields (`supplier_address_country:60`, no doc-type/reverse-charge), `CRITICAL_FIELD_KEYS` `:105`
- `D:\Work\invoice-starter\lib\ai\extract-invoice.ts` — extraction `SYSTEM_PROMPT` `:31+`
