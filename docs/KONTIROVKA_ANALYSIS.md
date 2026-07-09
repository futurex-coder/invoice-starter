# Контировка — how it should work (mechanics analysis)

> Deep-dive on the **контировка** (double-entry journalizing) engine that turns each
> document into a balanced accounting entry and, once posted, produces the **real** VAT
> (4539/4538) instead of today's netted estimate (`getVatSummary`).
> Grounded in the owner's Miro board ("Приходни и разходни фактури" — Меню Контиране x2 +
> Дневник продажби) + the BG national сметкоплан (balans.bg). The broader plan (data model,
> full UX, phasing) is produced separately; this file is the *engine* spec.
> Written 2026-07-09. Status: draft for owner + accountant review.

> **⚠️ SUPERSEDED on the engine by [KONTIROVKA_PLAN.md](KONTIROVKA_PLAN.md) §3** — the full,
> accountant-critiqued build plan (data model, mapping registry, 6-slice phasing). Where the
> two differ, **the plan wins.** Corrections the счетоводител/feasibility review applied to
> THIS file: (1) **dealType** is decided by the source table (invoices→Продажба, received→
> Покупка), *not* by `isVatRegistered` — registration only gates whether the VAT legs +
> дневник row are emitted (§4 fixed below). (2) **ВОД** keys on **чл.53 ал.1** (the string in
> `vat-grounds.ts`), not чл.7 (fixed below). (3) **9% output → кл.23** (not 17/18 — those were
> дневник ordinals, not справка-декларация клетки; the two numbering systems are distinct).
> (4) The period **result cells** are registry data to confirm (plan uses кл.50/60 for
> възстановяване; this file's кл.40/50 is not authoritative). (5) чл.70 non-creditable VAT is
> **capitalised into the nature of the cost**, not a blanket 609. (6) Partial ДК (чл.73) needs
> the split/годишна-корекция template, never full-V-to-4531. Read the plan for the rest.

---

## 1. What a контировка is

A **контировка** is exactly **one balanced double-entry record** (счетоводна статия) per posted
document. It has a header + N debit lines (Дебит, left) + M credit lines (Кредит, right). The
hard invariant, enforced everywhere: **Σ Дебит = Σ Кредит**. Nothing posts unbalanced.

From the board's Меню Контиране, one контировка =

```
Контировка N: 0000000001            Основание: Услуги
Дата на осчетоводяване: 11.06.2025   Тип на сделката: Продажба
Тип на документа: Фактура            Операция по ДДС: Облагаеми доставки 20%
Номер: 0000000001                    VIES: Не участва в декларацията
Дата на документа: 11.06.2025        Месец за експорт: 06.2025
Партньор: ДСВ Технолоджис ЕООД
┌─ ДЕБИТ ─────────────────────┬──────────┐  ┌─ КРЕДИТ ─────────────────────┬──────────┐
│ 411/1  Клиенти в лева       │ 2041.88  │  │ 703  Приходи от прод. услуги │ 1701.57  │
│                             │          │  │ 453/2 ДДС Продажби           │  340.31  │
└─────────────────────────────┴──────────┘  └──────────────────────────────┴──────────┘
   Общо Дебит: 2041.88                          Общо Кредит: 2041.88   ✓ balanced
```

## 2. The account model (chart_of_accounts) — with currency sub-accounts

The board proves accounts carry **analytic sub-accounts by currency**: `411/1 Клиенти в лева`,
`411/2 Клиенти в евро`; `453/1 ДДС покупки`, `453/2 ДДС продажби`. So an account has: `code`
(e.g. `411`), optional `analytic` suffix (`/1`,`/2`), `name`, `type`
(asset|liability|revenue|expense|equity), `normalSide` (Dr|Cr), optional `currency`, `active`.

**Seed set (MVP):**

| Code | Name | Type | Normal | Notes |
|---|---|---|---|---|
| 411/1, 411/2 | Вземания от клиенти (лв / евро) | asset | Dr | receivable, per currency |
| 401/1, 401/2 | Задължения към доставчици | liability | Cr | payable, per currency |
| 453/1 | ДДС покупки (данъчен кредит, вх.) | asset | Dr | input VAT (4531) |
| 453/2 | ДДС продажби (изходящ) | liability | Cr | output VAT (4532) |
| 4538 | ДДС за възстановяване | asset | Dr | period result: refund |
| 4539 | ДДС за внасяне | liability | Cr | period result: pay |
| 501/1, 501/2 | Каса (лв / евро) | asset | Dr | cash |
| 503/1, 503/2 | Разплащателна сметка | asset | Dr | bank |
| 701 / 702 / 703 / 704 / 709 | Приходи от продукти / стоки / услуги / наеми / други | revenue | Cr | picked by **Основание** |
| 601 / 602 / 609 | Разходи материали / външни услуги / други | expense | Dr | picked by **Основание** |
| 302 / 304 | Материали / Стоки | asset | Dr | inventory (if capitalised) |

The revenue/expense account is chosen from **Основание** (Услуги→703/602, Стоки→702/304 or
601, Продукти→701, Наем→704). Ships as an editable default; the accountant can override the
account on any line.

## 3. The контировка record (data)

**Header** (`journal_entries`): `kontirovkaNo` (sequential per company), `postingDate`,
`docType`, `docNumber`, `docDate`, `partnerName` + `partnerEik`/`egn`, `osnovanie`, `note`,
`dealType` (Продажба|Покупка), `vatOperation` (enum §5), `viesFlag`, `exportMonth`
(`YYYY-MM` — the VAT-ledger period; **may differ** from docDate), `sourceInvoiceId` /
`sourceReceivedInvoiceId`, `status` (draft|posted|reversed), `currency`, `fxRate`.

**Lines** (`journal_lines`): `side` (Dr|Cr), `accountId`, `description`, `amountBase` (posting
currency = company base, GEN-1), `amountDoc` (original doc currency, for reference).

**Invariants:** (a) `Σ amountBase(Dr) = Σ amountBase(Cr)`; (b) ≥1 Dr and ≥1 Cr; (c) once
`posted`, header+lines are immutable — corrections are a **reversal (сторно) entry**, never an
edit (mirrors our existing EDIT-RULE: `accounted` = locked). One live контировка per source
document; re-derivation is idempotent while `draft`.

## 4. Derivation algorithm (auto-контиране)

Runs when an outgoing invoice is **finalized** or a received invoice is **confirmed** (both
already give us frozen amounts + snapshots). Produces a `draft` контировка the accountant then
reviews/posts.

```
INPUT (already in our schema):
  docType, weAreSupplier(bool), isVatRegistered, currency, fxRate,
  net, vat, gross            (invoices.totals JSONB / received_invoices flat cols)
  vatMode|noVatReason        (→ vatOperation)
  osnovanie                  (from line descriptions / articles; default from company)
  partner snapshot           (ЕИК/ЕГН + name)

STEP 1  dealType — the SOURCE TABLE decides (NOT registration; §A2 correction):
  source is an outgoing invoice   → Продажба   (→ Дневник продажби)
  source is a received invoice    → Покупка    (→ Дневник покупки)
  (isVatRegistered gates only STEP 4's VAT legs 453/1·453/2 + the дневник row; a
   non-registered company still gets the plain journal Dr 411 = net = gross / Cr 70x.)

STEP 2  vatOperation:  map from vatMode + noVatReason + partner country (§5).
        Default: standard 20% domestic → "Облагаеми 20%".
        (This is where the VAT-2 ЗДДС grounds we already built plug in.)

STEP 3  base-currency amounts (GEN-1):
  netB = round2(net*fxRate); vatB = round2(vat*fxRate); grossB = round2(gross*fxRate)
  Rounding rule: compute vatB and netB independently to 2dp, set the client/supplier
  line = netB + vatB (never re-round the sum) so Σ always balances to the cent.

STEP 4  build lines by (dealType × vatOperation)  — see §6 templates.

STEP 5  docType adjust:
  invoice / debit_note  → positive amounts.
  credit_note           → same accounts, amounts NEGATIVE (сторно/reversal).
  proforma              → NO контировка (not a tax document; excluded, as in money.ts).
  protokol (чл.117)     → self-charge template (§6).

STEP 6  exportMonth default = month(docDate). Editable (purchases: ДК deferrable up to 12m).
```

## 5. `vatOperation` enum → Дневник cell

Derived from the Дневник продажби columns on the board (Приложение №10) + the ЗДДС grounds.
Покупки cells (Приложение №11: ДО/ДДС с **пълен** ДК, с **частичен** ДК, **без право** на ДК)
confirmed by the running research pass.

| vatOperation | Продажби cell(s) | Покупки cell(s) | VAT line? |
|---|---|---|---|
| Облагаеми 20% | кл.11 ДО + кл.12 ДДС | ДО+ДДС пълен ДК (кл.10/11 покупки) | yes 20% |
| Облагаеми 9% | кл.17 + кл.18 | ДО+ДДС пълен ДК | yes 9% |
| Износ 0% (чл.28) | кл.19 | — | no |
| ВОД (чл.53 ал.1) 0% | кл.20 | — | no (+VIES) |
| Услуги към ЕС (чл.21 ал.2, обр. начисляване) | кл.22 | — | no (+VIES) |
| ВОП (чл.84) | кл.13 ДО + кл.15 ДДС | ДО+ДДС пълен ДК | **self-charge** |
| Получени услуги чл.82 ал.2-6 / протокол чл.117 | кл.14 + кл.15 | ДО+ДДС пълен ДК | **self-charge** |
| Тристранни (посредник) | кл.23 / кл.25 | — | no |
| Освободени доставки | кл.24 | — | no |
| Покупка без право на ДК | — | ДО без право на ДК | Dr expense incl. VAT |
| Не участва в дневниците | — | — | no dnevnik row |

## 6. Contировка templates (the heart)

`{cur}` = currency sub-account (лв→/1, евро→/2). `70x`/`60x` picked from **Основание**.

**ПРОДАЖБА — Облагаеми 20%/9%** (the standard case):
```
Dr 411/{cur}         grossB            (client owes gross)
Cr 70x               netB              (revenue, net)
Cr 453/2             vatB              (output VAT)   → Дневник продажби кл.11/12 (or 17/18)
```

**ПОКУПКА — Облагаеми 20%/9%, пълен данъчен кредит:**
```
Dr 60x (or 302/304)  netB             (expense / inventory, net)
Dr 453/1             vatB             (input VAT / ДК)          → Дневник покупки (пълен ДК)
Cr 401/{cur}         grossB           (we owe supplier gross)
```

**ПОКУПКА — без право на данъчен кредит** (VAT is a cost, not reclaimable):
```
Dr 60x               grossB           (expense incl. VAT — no 453/1)
Cr 401/{cur}         grossB
```                                     → Дневник покупки, колона "без право на ДК"

**ПРОДАЖБА — ВОД / износ / услуги ЕС чл.21 / освободени** (0% or out of scope, vat=0):
```
Dr 411/{cur}         netB
Cr 70x               netB
```                                     → the matching 0%/ВОД/чл.21/освободени cell (+VIES if ВОД/чл.21)

**ПОКУПКА с обратно начисляване — ВОП / услуги от ЕС / протокол чл.117** (self-charge):
```
Dr 60x (or 302/304)  netB             Cr 401/{cur}  netB      (the expense + payable, net)
Dr 453/1             selfVatB         Cr 453/2      selfVatB  (self-charge: BOTH sides)
```
Net cash-VAT effect = 0, but **both** dnevnik cells fill (output кл.13-15 + input пълен ДК) —
this is the reverse-charge protokol. Requires generating a **Протокол по чл.117** doc number.

**Кредитно известие** — same template as the referenced invoice, **all amounts negated**
(сторно). **Дебитно известие** — same as an invoice (positive top-up).

## 7. Currency (GEN-1)

Company posts in its single base currency (EUR post-2026). `411/2 Клиенти в евро` etc. Each
line stores `amountBase` (posting) + `amountDoc` (original). `fxRate` is the frozen doc→base
rate we already stamp at finalize. No re-valuation in MVP (single base currency).

## 8. Месец за експорт & deferred данъчен кредит

`exportMonth` decides which monthly ДДС дневник the document enters — **not necessarily its
issue month**. Sales: normally the issue month. Purchases: ЗДДС lets the buyer exercise the ДК
in the document's month or any of the **next 12 months**, so `exportMonth` is editable per the
board note ("посочва в кой месец от ДДС дневниците да влезе фактурата"). The posting date and
the dnevnik period are therefore two separate fields.

## 9. Month-end VAT close → the REAL VAT

At period close, for a given `exportMonth`, sum the movements and post the settlement:
```
Dr 453/2   Σ output VAT for the month      (close output)
Cr 453/1   Σ input  VAT for the month       (close input)
then the difference:
  output > input  →  Cr 4539  (ДДС за внасяне   = pay to НАП)
  input  > output →  Dr 4538  (ДДС за възстановяване = refund)
```
`4539`/`4538` **is the real VAT** — it ties out to Справка-декларация **кл.40** (за внасяне) /
**кл.50** (за възстановяване), and it replaces the current `getVatSummary` estimate for any
month that has been posted. Months without postings still show the estimate, clearly labelled
"прогноза".

## 10. Flow into the reports (what a posted контировка feeds)

```
контировка (posted)
   ├─→ Хронологичен регистър   one row per line; every header/line field a column; chronological
   ├─→ Оборотна ведомост       Σ Дт and Σ Кт per account for the period (411, 453/2, 703, …)
   ├─→ ДДС дневник (покупки|продажби)  one row per doc, in exportMonth, amounts in the §5 cells
   │         └─→ Справка-декларация   раздел А (from продажби) + раздел Б (from покупки) → кл.40/50
   └─→ Главна книга            per-account running ledger (opening + movements + closing)
```

## 11. Auto vs manual, integrity, audit

- **Auto-derive** the draft контировка on finalize/confirm; the accountant opens **Меню
  Контиране**, adjusts accounts/amounts/splits, and **posts**. The UI blocks posting while
  `Σ Дт ≠ Σ Кт`.
- **Immutable after posting**; fix via a **reversal (сторно)** entry, not an edit.
- **Idempotent** while draft: re-finalizing/editing the source re-derives the draft; a posted
  контировка is never silently overwritten.
- **Audit**: every posting carries `sourceInvoiceId`, user, timestamp; reversal links to the
  original. The reconcile invariant from `dds-dnevnik-spec.md` still holds: Σ posted output VAT
  for a month must equal Дневник продажби кл.10 total for that month.

## Open questions (owner / accountant)

1. Do we auto-**post** on finalize, or always leave the draft for the accountant to confirm?
   (Recommend: auto-*derive draft*, manual *post* — accountants distrust auto-posting.)
2. Основание → account map: ship the default table above, or let each company configure it?
3. Protokol чл.117: generate its own document + number now, or phase-2?
4. Cash/bank postings (501/503) on payment — in scope for контировка, or only invoice postings
   for MVP (VAT is unaffected by payment on accrual basis)?
5. `main` vs `claude-run-2`: which base do we build контировка on?
