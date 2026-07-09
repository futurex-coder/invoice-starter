# Invoicly — Контировка & Real‑VAT (ДДС) Implementation Plan

**Feature codename:** `KONT‑1` (контировка / осчетоводяване) + `RVAT‑1` (real VAT via справка‑декларация)
**Prepared for:** owner + счетоводител review · **Status:** ready to build · **Supersedes:** `docs/knowledge/dds-dnevnik-spec.md` (folded in, see §9)
**Stack anchors (verified):** Next.js 16 / React 19 / Drizzle + Supabase Postgres, strict TS (no `any`/`as`), GEN‑1 single base currency, latest migration `0007` → next is `0008`.

> **This revision incorporates the счетоводител and feasibility reviews.** Every accounting ship‑blocker is fixed in the mapping table and text; the scope is re‑cut into independently shippable slices with the integrity/immutability guarantees the engineer flagged. See **§0** for the correction log, then read on.

> **⚠️ A code-verified wiring audit + stress test — [`KONTIROVKA_WIRING_STRESS.md`](KONTIROVKA_WIRING_STRESS.md) — supersedes this plan on any conflict.** Its Part 4 registers **15 corrections** and its Part 3 ranks **27 stress findings**; the load-bearing ones every implementer must honor: **(P1)** the vat-grounds keying shown in §0.1‑C1/§3.3 is *factually wrong* — `чл.53 ал.1` never substring-matches the stored `'ЗДДС, чл. 53, ал. 1 — …'`, so all 0%/ВОД/EU/освободени sales would silently post as 20%; key on the exact `VAT_EXEMPTION_GROUNDS[].ref`. **(P3)** `accountingStatus` is user-togglable (`updateInvoiceAccountingStatus` flips accounted→pending with no check), so §2.6's lock is **insufficient** — all edit/delete/**cancel** guards must key on *posting existence*, and `cancelInvoice` currently has **no guard at all**. **(P11)** block or per-`vatBreakdown`-emit mixed-rate before posting. Ship **Slice 1** (read-only) now with the keying fix folded in; do **not** enable posting until the Slice-2 gate in that report is closed.

---

## 0. Corrections incorporated from review (read first)

### 0.1 Accounting fixes (счетоводител) — all applied

| Ref | Defect in prior draft | Fix in this plan |
|---|---|---|
| **A1** | 9% output ДДС mapped to `кл.24` (which does not exist) | 9% output → **кл.23** (база кл.13). Output block is кл.21 (20%), кл.22 (ВОП+чл.82), **кл.23 (9%)**; `кл.20 = 21+22+23`. §3.2 Row 2, §3.4, §5.1. |
| **A2** | `dealType = sale if invoices AND isVatRegistered` | **`dealType = sale` iff source ∈ `invoices`; `purchase` iff source ∈ `received_invoices`. Full stop.** `isVatRegistered` gates only whether VAT legs (4531/4532) and the дневник row are generated. §1.2, §3.3. |
| **A3** | ВОП annotated `(ВОП)` in the VIES column | **ВОП removed from VIES.** VIES is outbound‑only {ВОД, услуги чл.21 ал.2, посредник тристранна}. §3.2 Rows 14/15, §3.3. |
| **A4** | "Не участва в дневниците" allowed an optional `4532` leg | **Split into two ops:** `no_vat_out_of_scope` (no 4532, `register=null`) vs. genuinely taxable ops (always ledgered). **4532 with `register=null` is now forbidden by the engine + a DB check.** §3.2 Row 9, §3.5. |
| **A5** | Частичен ДК booked full `V` to 4531 | Corrected template: `Dr 4531 = V×коеф`, `Dr 60x/609 = V×(1−коеф)` to cost, or provisional‑full + explicit годишна корекция (кл.43). Still **v2**, but the template is now correct. §3.2 Row 13, §3.5. |
| **A6** | чл.70 non‑creditable VAT defaulted to `609` | **VAT capitalised into the nature of the underlying cost** (the same 60x/20x/609 it belongs to), not a blanket 609. Base still lands in **кл.30**. §3.2 Row 12, §3.5, §8.2. |
| **C1** | `vatOperation` auto‑derived on `чл.7` for ВОД | **Keyed on `чл.53 ал.1`** (the string actually in `vat-grounds.ts`), plus чл.28→износ, чл.30→кл.16, чл.21 ал.2→EU‑services, чл.39–46→освободени. §3.3. |
| **B1** | Авансови фактури unhandled | Documented sub‑case with the correct advance/final/нетиране postings; **gated (v2) + logged to `REVIEW_QUEUE`.** §3.5. |
| **B2** | Goods sale booked revenue only (no COGS) | **Explicitly flagged: trial balance / P&L is COGS‑incomplete** until an inventory module supplies себестойност (304 not relieved). §3.5, §4.3. |
| **B3** | Purchase `vatPeriod` derived from issue date | Default purchases to **receipt/entry month** (чл.72), reverse‑charge to **протокол date**; manual override kept. §3.3, §5. |
| **B4** | `Σ(70x lines) == taxBase` hard invariant | Relaxed: taxBase reconciles to **document totals**, not the revenue account (чл.26 ал.3 legitimately adds акциз/транспорт/застраховки to ДО). §2.2. |
| **B5** | Контировка coupled to ДДС throughout | Non‑registered entity still gets a journal (`Dr 411 = N = G / Cr 70x`); **VAT legs are conditional on `isVatRegistered`, the journal is unconditional.** §3.3, §3.5. |
| **E** | — (confirmed correct, do not re‑litigate) | Sale, purchase full‑credit, reverse‑charge self‑charge, credit‑note negatives, month‑end close, per‑document VAT rounding, VIES set. Left as‑is. Minor: `704 Наеми` is non‑standard (usually 703/706/709) — harmless in an editable chart. |

### 0.2 Feasibility / scope fixes (engineer) — all applied

| Ref | Issue | Fix in this plan |
|---|---|---|
| **F1** | "`KONT‑1` MVP" (old §1.3‑NOW) was really Phases 2–5 under one label | Renamed **the KONT‑1 epic**; the shippable unit is **Slice 1** (read‑only drill‑down). Work re‑sequenced into 6 slices by *signal availability and risk*. §1.3, §7. |
| **F2 (a)** | Header‑level `taxBase`/`vatAmount` + single `vatOperation` hardcodes one rate per document | **Tax projection moved to a per‑rate child table `journal_tax_lines`**; the дневник derives from those rows. Mixed‑rate‑ready; the header→lines reconciliation invariant disappears. §2.1, §2.2. |
| **F2 (b)** | Credit‑note (negative lines) and сторно (reversing entry) both called "reversal" | Pinned: **CN = negative lines on a new posting; correcting a mistaken posting = a distinct reversing entry** via `reversedByEntryId`. §2.4, §3.1. |
| **F2 (c)** | Balance trigger grain unspecified | **`CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`, statement‑level, keyed by entry**; enforce on `amount_base` (single‑currency ⇒ base‑balance implies doc‑balance). §2.4. |
| **F2 (d)** | `onDelete:'set null'` orphans a **posted** контировка — and delete‑invoice shipped in `1e6fd64`/`61bea2c` | **Delete‑guard: a document with a non‑reversed posting cannot be deleted** (must reverse first). Lands *with* the sales posting slice. §2.6. |
| **F3** | Purchase auto‑контиране oversold; received invoices lack signal | Re‑framed: **sales auto‑derive; purchases are assisted‑manual** (full‑credit‑20% default, human‑confirm, `extractionConfidence`‑gated). VIES is a **manual checkbox in v1** (no VIES validation exists). Purchases dropped from the first posting slice. §3.3, §7. |
| **F4** | `getVatSummary` buckets by `issueDate`; контировка by `vatPeriod` → counts don't reconcile | **MVP forces `vatPeriod = issueDate month` (no override)**; the Прогноза→real flip and the reconciliation test are defined on the **same key**. The override arrives only in Slice 4 with period‑close. §2.5, §4.1, §5.2, §9. |
| **F5a** | Per‑company editable COA + currency sub‑accounts over‑built for single‑base MVP | MVP uses a **`BG_CHART_OF_ACCOUNTS` national constant** + `accountCode` snapshots on lines; the editable per‑company `chart_of_accounts` table is a **later** slice. §2.1, §2.3. |
| **F5b** | Redundant currency columns on the entry header | Header sheds `taxBase*`/`vatAmount*`; keeps only `currency` + frozen `fxRate`. §2.1. |
| **F5c** | **Missing: period lock** | New **`accounting_periods`** table (open/closed); **posting into a closed period is blocked.** §2.1, §2.4, §5. |
| **F5d** | **Missing: operational audit** — `activityLogs` exists but unused | **post / reverse / close write to `activityLogs`** (`schema.ts:563`), in addition to the accounting audit the ledger already gives. §2.7. |
| **F5e** | **Missing: rounding invariant** | Lifted verbatim from `KONTIROVKA_ANALYSIS.md §3`: compute `netB` and `vatB` to 2dp **independently**, set the 411/401 line `= netB + vatB`, **never re‑round the sum**. Round at projection, not at `numeric(15,4)` storage. §3.6. |
| **F5f** | **Missing: multi‑currency & settlement reality** | Named as known limitations: FX docs freeze `fxRate` at confirm (ЗДДС wants BNB rate on the tax‑event date; курсови разлики → 624/724), and MVP posts the **invoice, not the payment** (501/503), so `411/401` don't clear. §2.5, §5.3. |
| **F6** | "декларация = column sums of the two дневника" taken literally | Corrected: `кл.50/кл.60 = кл.20 − кл.40` with a sign split, **plus** carry‑forward `кл.80/81/82` and the чл.92 refund procedure. Accountant cell sign‑off is a **hard gate on the дневник/декларация slice, not on posting.** §5.1, §7, §8.2. |

---

## 1. Vision & scope — anchored to the Miro "Меню Контиране"

### 1.1 What we are building
Turn Invoicly from an **invoicing tool that estimates VAT** into an **accounting layer that posts VAT**. Every outgoing `invoice` and incoming `received_invoice` becomes a balanced **двустранна контировка** (double‑entry posting) that flows into the artefacts Bulgarian accountants file from:

```
                    ┌──────────────────────── Меню Контиране (1 doc = 1 posting) ─────────────────────────┐
  invoices ─────────►  auto-populated Дебит/Кредит, review + edit, Общо Дт = Общо Кт, "Осчетоводи"        │
  received_invoices ─►                                                                                     │
                    └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                                ▼ (on post — one transaction)
        ┌───────────────────────┬───────────────────────┬───────────────────────┬──────────────────────┐
        ▼                       ▼                       ▼                       ▼                      ▼
 Хронологичен регистър    Оборотна ведомост       ДДС дневник продажби     ДДС дневник покупки     Главна книга
   (journal)               (trial balance)         (Прил. №10)              (Прил. №11)             (general ledger)
                                                          └──────────┬──────────┘
                                                                     ▼ (aggregation over journal_tax_lines)
                                                          Справка-декларация (Прил. №13)
                                                          → real VAT: кл.20 − кл.40 → кл.50 за внасяне / кл.60 за възстановяване
                                                            (+ carry-forward кл.80/81/82, чл.92)
```

### 1.2 The Меню Контиране form — field‑by‑field, mapped to our data
The owner's screenshot is the industry‑standard posting UX (same two‑panel Дт/Кт layout as Микроинвест Делта Pro, Colibri, CONTROLISY). Every field maps to data we already hold:

| Miro field | Panel | Source in our codebase |
|---|---|---|
| **Контировка N** | header L | new `journal_sequences` (atomic, same pattern as `allocateNumber`) |
| **Дата на осчетоводяване** | header L | `journal_entries.postingDate` (default = today) |
| **Тип на документа** (Фактура/КИ/ДИ/Протокол) | header L | `invoices.docType` → НАП code `01/02/03/09`; proforma excluded |
| **Номер на документ** (10‑значен) | header L | `formatInvoiceNumber(invoices.number)` / `receivedInvoices.invoiceNumber` |
| **Дата на документа** (=данъчно събитие) | header L | `issueDate` (fallback `supplyDate`) |
| **Партньор** (ЕИК+име / ЕГН) | header L | frozen `supplierSnapshot`/`recipientSnapshot` via `parsePartySnapshotStrict` (`.uic`, `.vatNumber`) |
| **Основание** (Услуги/Стоки…) | header R | new `journal_entries.basis` — **drives the 70x/60x account** |
| **Забележка** | header R | `journal_entries.note` |
| **Тип на сделката** (Продажба/Покупка) | header R | `dealType`, **auto: `sale` iff source ∈ `invoices`, `purchase` iff source ∈ `received_invoices`** (A2) |
| **Операция по ДДС** | header R | `vatOperation` — **the load‑bearing field; drives the ДДС клетка** (§3) |
| **VIES** (участва/не) | header R | `journal_entries.vies` — **manual checkbox in v1** (no VIES validation exists yet; §3.3) |
| **Месец за експорт** | header R | `journal_entries.vatPeriod` (`YYYY‑MM`). **v1: locked to the issueDate month; override arrives in Slice 4** (§2.5) |
| **Дебит / Кредит** (сметка·описание·сума) | body | `journal_lines` (rule‑engine auto‑fills, user‑editable) |
| **Общо Дебит = Общо Кредит** | footer | balance invariant; blocks "Осчетоводи" until equal |

### 1.3 Scope — the KONT‑1 epic, cut into shippable slices
The whole double‑entry + VAT stack is an **epic**, not an MVP. It ships as six independently verifiable slices (§7). The **first release is Slice 1** (read‑only). Two constraints keep the early slices correct and minimal:

- **C‑MVP‑1 — single VAT operation per posting in the first posting slice.** The schema is mixed‑rate‑ready via `journal_tax_lines` (§2.2), but Slice 2 emits **one tax line per entry**. Mixed‑rate documents (a 20% line + a re‑billed exempt line) are *storable* from day one and *enabled* when the sales slice extends.
- **C‑MVP‑2 — `vatPeriod = issueDate month`, no override, until Slice 4.** This makes the Прогноза (estimate) and the real ledger reconcile on the same bucket key (§9). Deferred данъчен кредит (чл.72, up to 12 months) and reverse‑charge timing are enabled only once period‑close exists.

**In the epic (v1 target):** national сметкоплан, Меню Контиране for **sales** (standard 20%/9% + grounds‑derived 0%/exempt/ВОД/EU‑services) and **purchases** (full‑credit + чл.70 no‑credit, assisted‑manual), balance + immutability + period‑lock guarantees, Хронологичен регистър / Оборотна ведомост / Главна книга, ДДС дневник продажби/покупки + Справка‑декларация, month‑end VAT close producing the **real** кл.50/кл.60.

**Later (v2+):** Протокол по чл.117 (ВОП / чл.82 обратно начисляване, dual‑ledger); частичен данъчен кредит (коеф. чл.73 ал.5 = кл.33) + годишна корекция (кл.43); авансови фактури; международен транспорт (кл.16) and тристранни (кл.18); НАП export files (`DEKLAR.TXT`/`PRODAGBI.TXT`/`POKUPKI.TXT`/`VIES.TXT`, CP‑1251 fixed‑width); VIES/VAT‑number validation; счетоводни шаблони/автоконтиране, AI‑OCR review‑queue one‑click + bulk edit; payment→cash settlement postings; multi‑currency re‑valuation (курсови разлики 624/724); внос (код 07), per‑program export (Делта/Ажур).

**Explicitly out (v1):** submitting to the НАП portal ourselves — every surveyed system only *generates* files; portal upload is manual with КЕП.

---

## 2. Data model

### 2.1 New Drizzle tables (add to `lib/db/schema.ts`, then `db:generate` → `0008_kontirovka.sql`)
Conventions match the existing schema: `serial` PK, `integer` company FK `onDelete:'cascade'`, **varchar (not pg enum)** for status/kind, `numeric(15,4)` money / `numeric(15,6)` fxRate, snapshot columns, explicit indexes.

```ts
// ── journal_entries (Контировка header) ──
export const journalEntries = pgTable('journal_entries', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  postingNumber: integer('posting_number').notNull(),        // Контировка N (per-company, gap-safe)
  postingDate: date('posting_date').notNull(),               // Дата на осчетоводяване
  kind: varchar('kind', { length: 20 }).notNull().default('document'), // document | vat_close | manual | reversal
  // Document identity (snapshot)
  docTypeCode: varchar('doc_type_code', { length: 2 }),      // НАП вид: 01/02/03/07/09/81/82
  documentType: varchar('document_type', { length: 30 }),    // display: Фактура/Кредитно известие/...
  documentNumber: varchar('document_number', { length: 20 }),
  documentDate: date('document_date'),                       // данъчно събитие (= issueDate)
  dealType: varchar('deal_type', { length: 10 }),            // sale | purchase  (§A2: = source table, not VAT status)
  vatOperation: varchar('vat_operation', { length: 40 }),    // header default op; per-rate detail lives in journal_tax_lines
  basis: varchar('basis', { length: 50 }),                   // Основание (Услуги/Стоки/…)
  note: text('note'),                                        // Забележка
  partnerId: integer('partner_id').references(() => partners.id, { onDelete: 'set null' }),
  partnerName: varchar('partner_name', { length: 255 }),     // snapshot
  partnerUic:  varchar('partner_uic',  { length: 15 }),      // ЕИК/ЕГН snapshot
  partnerVat:  varchar('partner_vat',  { length: 20 }),      // ДДС № snapshot
  vies: boolean('vies').notNull().default(false),            // v1: manual
  vatPeriod: char('vat_period', { length: 7 }),              // 'YYYY-MM' Месец за експорт (v1: = issueDate month)
  // GEN-1 currency — document-level, frozen at post (header sheds taxBase*/vatAmount*, §F5b)
  currency: char('currency', { length: 3 }).notNull().default('EUR'),
  fxRate: numeric('fx_rate', { precision: 15, scale: 6 }).notNull().default('1'),
  // Links (exactly one for kind='document')
  sourceInvoiceId: integer('source_invoice_id').references(() => invoices.id, { onDelete: 'restrict' }),          // §F2d: restrict, not set null
  sourceReceivedInvoiceId: integer('source_received_invoice_id').references(() => receivedInvoices.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | posted | reversed
  reversedByEntryId: integer('reversed_by_entry_id'),        // self-FK for сторно (correcting a mistaken posting)
  createdByUserId: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  postedAt: timestamp('posted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('je_company_posting_number_unique').on(t.companyId, t.postingNumber),
  index('idx_je_company_period').on(t.companyId, t.vatPeriod),
  index('idx_je_company_status').on(t.companyId, t.status),
  uniqueIndex('je_source_invoice_unique').on(t.sourceInvoiceId).where(sql`${t.sourceInvoiceId} IS NOT NULL`),
  uniqueIndex('je_source_received_unique').on(t.sourceReceivedInvoiceId).where(sql`${t.sourceReceivedInvoiceId} IS NOT NULL`),
]);

// ── journal_lines (Дебит/Кредит редове) — the счетоводна истина ──
export const journalLines = pgTable('journal_lines', {
  id: serial('id').primaryKey(),
  journalEntryId: integer('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  side: varchar('side', { length: 6 }).notNull(),            // debit | credit
  accountCode: varchar('account_code', { length: 20 }).notNull(), // snapshot vs BG_CHART_OF_ACCOUNTS (§2.3)
  accountName: varchar('account_name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  amount:     numeric('amount',      { precision: 15, scale: 4 }).notNull(), // doc ccy
  amountBase: numeric('amount_base', { precision: 15, scale: 4 }).notNull(), // × frozen fxRate (GEN-1)
  sortOrder: integer('sort_order').notNull().default(0),
}, (t) => [
  index('idx_jl_entry').on(t.journalEntryId),
  index('idx_jl_account').on(t.journalEntryId, t.accountCode),
]);

// ── journal_tax_lines (данъчна проекция, per-rate) — feeds the дневник/декларация (§F2a) ──
export const journalTaxLines = pgTable('journal_tax_lines', {
  id: serial('id').primaryKey(),
  journalEntryId: integer('journal_entry_id').notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  vatOperation: varchar('vat_operation', { length: 40 }).notNull(), // VAT_OPERATIONS registry key (§3)
  register: varchar('register', { length: 10 }),            // sales | purchases | null (null ⇒ NOT ledgered)
  baseCell: varchar('base_cell', { length: 4 }),            // СД клетка for the base (data, not logic)
  vatCell:  varchar('vat_cell',  { length: 4 }),            // СД клетка for the VAT   (data, not logic)
  base:     numeric('base',      { precision: 15, scale: 4 }).notNull().default('0'), // данъчна основа, doc ccy
  baseBase: numeric('base_base', { precision: 15, scale: 4 }).notNull().default('0'), // × fxRate — filing figure
  vat:      numeric('vat',       { precision: 15, scale: 4 }).notNull().default('0'),
  vatBase:  numeric('vat_base',  { precision: 15, scale: 4 }).notNull().default('0'),
}, (t) => [
  index('idx_jtl_entry').on(t.journalEntryId),
  index('idx_jtl_cell').on(t.baseCell, t.vatCell),
  // §A4: forbid a VAT amount that participates in no register
  check('jtl_vat_requires_register', sql`(${t.vat} = 0) OR (${t.register} IS NOT NULL)`),
]);

// ── journal_sequences (Контировка N counter) ──
export const journalSequences = pgTable('journal_sequences', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  nextNumber: integer('next_number').notNull().default(1),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [ uniqueIndex('journal_sequences_company_unique').on(t.companyId) ]);

// ── accounting_periods (period lock, §F5c) — arrives with Slice 4 ──
export const accountingPeriods = pgTable('accounting_periods', {
  id: serial('id').primaryKey(),
  companyId: integer('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  period: char('period', { length: 7 }).notNull(),          // 'YYYY-MM'
  status: varchar('status', { length: 10 }).notNull().default('open'), // open | closed
  closedAt: timestamp('closed_at'),
  closedByUserId: integer('closed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  closeEntryId: integer('close_entry_id').references(() => journalEntries.id, { onDelete: 'set null' }),
}, (t) => [ uniqueIndex('accounting_periods_company_period_unique').on(t.companyId, t.period) ]);
```

**App‑level enums** (mirroring `DocType`/`InvoiceStatus` at `schema.ts:820+`): `JournalStatus`, `DealType`, `JournalEntryKind`, `AccountKind`. `vatOperation` is a **varchar column + typed `VatOperation` enum + `VAT_OPERATIONS` registry constant** (§3) — same "app enum, easier to extend" convention, and it keeps клетка numbers as data an accountant can correct without a code change.

> **Not in the MVP schema (deferred, §F5a):** the per‑company editable `chart_of_accounts` (parent/child, `isPostable`, `sortOrder`, currency sub‑accounts). MVP resolves accounts from the **`BG_CHART_OF_ACCOUNTS` constant** (§2.3) and snapshots `accountCode`/`accountName` onto every line, so reports are stable and the editable chart can be layered in later without a data migration.

### 2.2 Why the entry carries a per‑rate "tax projection" separate from the lines
`journal_lines` are the **счетоводна истина** (must balance; feed trial balance / general ledger). `journal_tax_lines` are the **данъчна проекция** (feed the ДДС дневник row and its клетки), at a **per‑VAT‑operation grain** so a single document can populate several base cells (e.g. a 20% service line *and* a re‑billed exempt line). The дневник/декларация become a pure `GROUP BY baseCell/vatCell` over `journal_tax_lines` — fast, mixed‑rate‑ready, and there is **no header→lines reconciliation invariant to police**.

**таxBase is reconciled to the document totals, not to the 70x account (§B4).** ЗДДС чл.26 ал.3 folds акциз, transport and insurance re‑billing into данъчната основа, so `Σ(base over tax lines)` may legitimately exceed `Σ(70x credit lines)`. The post‑time check is `Σ journal_tax_lines.base == document net total` and `Σ vat == document VAT total` — never `== Σ revenue lines`.

### 2.3 Seed: BG сметкоплан as a constant (`BG_CHART_OF_ACCOUNTS`)
A typed constant (`{ code, name, kind, isVat }[]`) is the MVP source of truth; the engine validates every `accountCode` against it and snapshots `code`+`name` onto each line. The national subset:

`411` Вземания от клиенти; `401` Задължения към доставчици; **453 Разчети по ДДС →** `4531` ДДС на покупките [input, debit‑balance], `4532` ДДС на продажбите [output, credit‑balance], `4538` ДДС за възстановяване, `4539` ДДС за внасяне; `412` Клиенти по аванси (v2, авансови); `501/502` Каса лв/вал, `503/504` Разплащателна сметка; **разходи** `601` Материали, `602` Външни услуги, `604` Заплати, `605` Осигуровки, `609` Други; **приходи** `701` Продукция, `702` Стоки, `703` Услуги, `704` Наеми¹, `709` Други; **активи/запаси** `302` Материали, `304` Стоки; `624/724` Курсови разлики (v2). `kind`/`isVat` set per account.

¹ *`704 Наеми` is non‑standard (наеми usually book to 703 or 706/709); harmless as a default the accountant can re‑point in an editable chart later.*

### 2.4 Integrity — the four non‑negotiable guarantees (hand‑written plpgsql in `0008`, idempotent `CREATE OR REPLACE`, same pattern as `enforce_invoice_numbering` in `0006`)
1. **Balance (двустранно счетоводство).** A `CONSTRAINT TRIGGER … DEFERRABLE INITIALLY DEFERRED`, **fired statement‑level and keyed by entry** (not per‑row — cheaper on multi‑line inserts), asserts at COMMIT, per entry: `SUM(amount_base) FILTER side='debit' = SUM(amount_base) FILTER side='credit'` and `≥ 2` lines. Enforcing on `amount_base` is sufficient — under GEN‑1 the entry has one frozen `fxRate`, so base‑balance implies doc‑balance. Also validated in the domain layer (Zod) before insert; the DB trigger is the real guard (Drizzle can't model a cross‑row CHECK).
2. **Immutability of posted entries.** Trigger `prevent_posted_journal_mutation` blocks `UPDATE`/`DELETE` on `journal_entries`/`journal_lines`/`journal_tax_lines` when `status='posted'` — the **only** permitted transition is `posted → reversed`. Posted entries are corrected by a **reversing (сторно) entry**, never edited (this is distinct from credit‑note negatives — see §3.1). This is what keeps the дневник gap‑free and stable per `vatPeriod`.
3. **Numbering.** `postingNumber` allocated with the exact atomic `INSERT … ON CONFLICT DO UPDATE next_number+1 RETURNING` pattern from `allocateNumber` (`actions.ts:213`), inside the posting transaction; gap‑safe on delete‑of‑draft.
4. **Period lock (§F5c).** Trigger `prevent_closed_period_posting` blocks inserting/posting a `document` entry whose `vatPeriod` maps to an `accounting_periods` row with `status='closed'` — a late‑dated document cannot silently change an already‑filed кл.50. (Table + trigger land in Slice 4; until then all periods are implicitly open.)

### 2.5 GEN‑1 currency — and its named limitations
Every line stores `amount` (doc ccy) **and** `amountBase = amount × frozen fxRate`; tax lines likewise carry `*Base`. Registers, дневник and декларация read the `*Base` columns. **Convenient consequence:** from 2026 the base currency is EUR and НАП reports in EUR (`euro-adoption-2026.md`), so `*Base` **is** the filing figure — no separate filing conversion. Pre‑2026 BGN documents keep `currency='BGN'` and are already converted to base.

**Known limitations, named on purpose (§F5f):**
- A foreign‑currency (e.g. USD) received invoice freezes `fxRate` at confirm time, whereas ЗДДС wants the ДДС at the **БНБ rate on the данъчно събитие** date. For the SMB target this drift is immaterial and **v1 does not re‑value**; it means `401/411` base balances can drift for FX documents. Курсови разлики (624/724) between invoice and payment are a **v2** posting.
- **`vatPeriod = issueDate month` in v1, no override.** This is what makes the estimate and the real ledger reconcile on one key (§9). Deferred данъчен кредит (чл.72) and reverse‑charge/протокол timing need the override — enabled only in Slice 4, together with period‑close.

### 2.6 Prerequisite bug fixes — ship *with* the sales posting slice
- **Edit‑lock coupling (verified).** Posting sets the source document's `accountingStatus='accounted'` and locks its edits; reversal reverts. `updateInvoiceDraft` already blocks edits at `accounted` (`actions.ts:647`), **but `updateReceivedInvoiceDraft` (`received-invoices/actions.ts:795`) only blocks `discarded`** — a confirmed+accounted received invoice is still editable, which would silently desync its контировка. Add the `accountingStatus==='accounted'` guard there.
- **Delete‑guard (§F2d, newly urgent).** The delete‑invoice features just shipped (`1e6fd64`, `61bea2c`). `sourceInvoiceId`/`sourceReceivedInvoiceId` use **`onDelete:'restrict'`** (changed from the draft's `set null`), and the delete server actions must **refuse to delete any document that has a non‑reversed posting** (reverse first, then delete). Without this, deleting an accounted invoice would orphan a filed ledger row and break the one‑posting‑per‑source guarantee.

### 2.7 Operational audit — reuse `activityLogs` (§F5d)
The ledger gives *accounting* audit; the *operational* "who posted / reversed / closed, in the company feed" reuses the existing **`activityLogs`** table (`schema.ts:563`, "Company‑scoped audit trail"). `post`, `reverse`, and `closePeriod` each append an activity row (actor, entity, before/after). `journal_entries.{createdByUserId, postedAt}` remain the row‑level provenance; `activityLogs` is the human‑readable trail the owner explicitly wanted.

---

## 3. The контировка rule‑engine

### 3.1 Shape — a pure, table‑driven function (no branching soup)
```ts
// src/features/kontirovka/engine.ts
function contra(input: {
  vatOperation: VatOperation; docTypeCode: '01'|'02'|'03'|'09';
  dealType: 'sale'|'purchase';
  isVatRegistered: boolean;                // §B5: gates the VAT legs, not the journal
  net: number; vat: number; rate: number;
  basis: Basis; currency: string; fxRate: number;
  coefficient?: number;                    // §A5, v2: коефициент чл.73 ал.5
}): {
  lines: { side:'debit'|'credit'; accountCode: string; description: string; amount: number }[];
  taxLines: { vatOperation: VatOperation; register: 'sales'|'purchases'|null;
              baseCell: string|null; vatCell: string|null; base: number; vat: number }[];
  vies: boolean; balanced: boolean;
}
```
**Three orthogonal axes** (the key design insight):
- **VAT leg** (`4531`/`4532` + which дневник/СД клетка) `= f(vatOperation)` — read from the `VAT_OPERATIONS` registry. **Omitted entirely when `!isVatRegistered`** (§B5).
- **P&L / запаси leg** (`70x` on sale, `60x`/`30x` on purchase) `= f(basis)`: Услуги→`703`/`602`, Стоки→`702`/`304`, Продукция→`701`, Материали→`601`/`302`, Наеми→`704`, Други→`709`/`609`. **User‑editable** in the body.
- **docType** `= f(sign + НАП code)`: Фактура `01`/`+`, Дебитно известие `02`/`+`, Кредитно известие `03`/`−` (same accounts, **negative on every leg + negative in the дневник** — matches `signedVatSql`/`signedGrossSql`, which negate `credit_note`), Протокол `09`/`+`.

**Two distinct "reversal" concepts, pinned (§F2b):**
- **Credit note = negative amounts on a *new* posting** (червено сторно of the original values); it is a document in its own right with its own `postingNumber`. The balance trigger sums signed values; Оборотна ведомост handles negative Дт/Кт.
- **Correcting a *mistaken* posting = a distinct reversing entry** (`kind='reversal'`, links via `reversedByEntryId`) that flips every leg of the erroneous entry and moves it to `status='reversed'`. One code path never serves both.

### 3.2 The mapping table (Операция по ДДС × docType × Продажба/Покупка → Dr/Cr + СД клетка)
Let **N** = данъчна основа (net), **V** = ДДС, **G = N+V**. Sign per §3.1. **Cells are the accountant‑confirmed Приложение 13 (справка‑декларация) клетки** — they nonetheless live only in the `VAT_OPERATIONS` registry (defense in depth; §3.4). `70x/60x/30x` resolve from `basis`.

| # | Операция по ДДС (`code`) | Сделка | Дебит | Кредит | Register | База→СД | ДДС→СД | VIES | Dual | Scope |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `sale_std_20` Облагаема 20% | Продажба | **411** (G) | **70x** (N) + **4532** (V) | продажби | **11** | **21** | – | – | v1‑core |
| 2 | `sale_std_9` Облагаема 9% | Продажба | 411 (G) | 70x (N) + 4532 (V@9) | продажби | **13** | **23** ✅fix | – | – | v1‑core |
| 3 | `sale_export_0` Износ гл.трета (чл.28) | Продажба | 411 (N) | 70x (N) | продажби | **14** | — | – | – | v1‑ext |
| 4 | `sale_ics_0` ВОД (чл.7 / **чл.53 ал.1**) | Продажба | 411 (N) | 70x (N) | продажби | **15** | — | **✓** | – | v1‑ext |
| 5 | `sale_intl_transport_0` Межд. транспорт 0% (чл.30) | Продажба | 411 (N) | 70x (N) | продажби | **16** | — | – | – | v2 |
| 6 | `sale_eu_services_rc` Услуги ЕС чл.21 ал.2 | Продажба | 411 (N) | 703 (N) | продажби | **17** | — | **✓** | – | v1‑ext |
| 7 | `sale_outside_scope` Място на изпълнение извън страната | Продажба | 411 (N) | 70x (N) | продажби | **18** | — | – | – | v2 |
| 8 | `sale_triangular` Посредник в тристранна (чл.15) | Продажба | 411 (N) | 70x (N) | продажби | **18** | — | **✓** | – | v2 |
| 9 | `sale_exempt` Освободена (чл.38–48) | Продажба | 411 (N) | 70x (N) | продажби | **19** | — | – | – | v1‑ext |
| 10 | `no_vat_out_of_scope` Извън обхвата / нерегистриран издател — **не участва** | Продажба | 411 (N=G) | 70x (N) | **—** | — | — | – | – | v1‑core |
| 11 | `purchase_full_20` Пълен ДК 20% | Покупка | **60x/30x** (N) + **4531** (V) | **401** (G) | покупки | **31** | **41** | – | – | v1 |
| 12 | `purchase_full_9` Пълен ДК 9% | Покупка | 60x/30x (N) + 4531 (V@9) | 401 (G) | покупки | **31**² | **41**² | – | – | v1 |
| 13 | `purchase_no_credit` Без право на ДК (чл.70) | Покупка | 60x/30x/20x (**G** — ДДС към стойността³) | 401 (G) | покупки | **30** | — | – | – | v1 |
| 14 | `purchase_partial` Частичен ДК (чл.73)⁴ | Покупка | 60x/30x (N) + 4531 (V×коеф) + 60x/609 (V×(1−коеф)) | 401 (G) | покупки | **32** | **42** (коеф→**33**) | – | – | v2 |
| 15 | `vop_protocol` ВОП / чл.117 протокол | Покупка | 60x/30x (N) + 4531 (V) | 401 (N) + **4532** (V) | **и двата** | прод.**12** / пок.**31** | прод.**22** / пок.**41** | – | **✓** | v2 |
| 16 | `art82_services_rc` Получени услуги чл.82 (протокол) | Покупка | 602 (N) + 4531 (V) | 401 (N) + 4532 (V) | и двата | прод.**12** / пок.**31** | прод.**22** / пок.**41** | – | **✓** | v2 |

² *Accountant table D lists покупка пълен ДК as 31/41 with no 20%/9% split; confirm no rate split for the purchase side (owner/accountant Q, §8.2).*
³ **§A6:** non‑deductible чл.70 ДДС is capitalised into the **nature of the underlying cost** (представителни→609; ДМА→20x at gross; гориво за автомобил→the vehicle‑cost account) — **not** a blanket 609. Base still enters дневник покупки in **кл.30**.
⁴ **§A5:** the definitive коефициент (чл.73 ал.5 = кл.33) is known only at year‑end. Common practice: post full V to 4531 **provisionally** and true‑up via **годишна корекция (кл.43)** in December — but then the template must *carry* that correction explicitly. "Full V to 4531, forever" is wrong; ship the split template or the provisional+correction pair, never the naïve version.

**Also:** Коефициент чл.73 ал.5 → **кл.33**; Годишна корекция чл.73 ал.8 → **кл.43** (a December close correction, §5, not a per‑document op).

**Worked example (Miro, Row 1):** sale of услуги 20% → **Dr 411 2041.88 | Cr 703 1701.57 + Cr 4532 340.31** — balanced; one tax line `{op: sale_std_20, register: sales, base: 1701.57 → кл.11, vat: 340.31 → кл.21}`.

### 3.3 Auto‑populate → edit → balance → post (the flow)
1. **Auto‑populate.** On opening Меню Контиране, `contra()` runs from `totals` JSONB (outgoing, via `parseInvoiceTotalsStrict`) or the flat `netAmount/vatAmount` (received). `dealType`, `vatOperation`, `vies` are inferred (defaults below); Dr/Cr and tax lines pre‑filled.
2. **Defaults — honest about signal (§F3):**
   - **`dealType`** = `sale` iff source ∈ `invoices`, else `purchase`. **Independent of VAT registration** (§A2).
   - **Sales `vatOperation`** derives from `vatMode` + `vatRate` + `noVatReason`, keyed on the **strings actually in `vat-grounds.ts`** (§C1):
     `чл.53 ал.1` → `sale_ics_0` (ВОД, кл.15, VIES) · `чл.28` → `sale_export_0` (кл.14) · `чл.30` → `sale_intl_transport_0` (**кл.16**, *not* the export cell) · `чл.21 ал.2` → `sale_eu_services_rc` (кл.17, VIES) · `чл.39–46` → `sale_exempt` (кл.19). Row 4 cites **чл.53 ал.1** (the rate) alongside чл.7 (the definition) to match the invoice's printed ground.
   - **Purchase `vatOperation` is *not* derivable** — received invoices carry no country, no validated VAT №, no `noVatReason`, no reverse‑charge flag (`vatRate` lives only on lines; the rest is OCR in `rawExtraction`, `schema.ts:424–556`). So purchases **default to `purchase_full_20`, require human confirmation, and are gated by `extractionConfidence`** (`schema.ts:454`): a low‑confidence extraction may pre‑fill but **may not auto‑post**.
   - **`vies`** is a **manual checkbox in v1** — there is no VIES/VAT‑number validation anywhere in the codebase. The op pre‑ticks it for {ВОД, чл.21 ал.2, тристранна}; the user confirms.
   - **`vatPeriod`** = issueDate month (v1, locked). When the override arrives (Slice 4): sales default to issueDate month; **purchases default to the receipt/entry month** (чл.72), reverse‑charge to the **протокол date** (§B3).
   - **`isVatRegistered=false`** → the engine emits **only** the journal (`Dr 411 = N = G / Cr 70x`), **no 4531/4532, no tax line, no дневник row** (§B5).
3. **Edit.** User can change account (from `BG_CHART_OF_ACCOUNTS`), description, amount, and any header field. Changing `vatOperation` re‑routes the клетки live.
4. **Balance check.** Footer shows `Общо Дебит`/`Общо Кредит`; VAT rounded **per document total** (§3.6); "Осчетоводи" disabled until `Σ Дт = Σ Кт`.
5. **Post (one transaction).** Allocate `postingNumber`, snapshot partner, set `status='posted'`, `postedAt`, lock source doc (`accountingStatus='accounted'`), write lines + tax lines, append `activityLogs`. Post‑time validation: `Σ tax‑line base == doc net total`, `Σ tax‑line vat == doc VAT total`, `Σ 4532/4531 == Σ tax vat`, `vat ≈ rate × base`, period is open, and **no VAT amount has a null register** (§A4).

### 3.4 The DO‑NOT‑GUESS part (клетка numbers) — now accountant‑confirmed, still data
The СД клетки in §3.2 are the values the счетоводител **confirmed** against the current Приложение 13 (the only prior error was 9% → the plan is corrected to **кл.23**). They nonetheless live **only** in the `VAT_OPERATIONS` registry rows — engine, дневник and export all read them — because our own internal docs disagreed (`KONTIROVKA_ANALYSIS.md §9` said кл.40/50; this plan says кл.50/60). A single accountant‑verified data correction fixes the whole system; **no cell number is hard‑coded in logic.**

**Two numbering systems — do not conflate (§D structural caution).** §3.2 encodes **Приложение 13 (справка‑декларация) клетки**. The **дневник продажби (Прил. 10)** and **дневник покупки (Прил. 11)** have their **own column ordinals** that are *not* 1:1 with the СД клетки. The registry therefore stores **both** a `declarationCell` and a (later) `ledgerColumn` per operation, so the Phase‑6 export never hard‑codes a СД клетка as a дневник column. Confirmed stable anchors (all sources agree): `кл.01`, `кл.20`, `кл.30/31/32/33`, `кл.40/41/42/43`, `кл.50`, `кл.60`, `кл.70/71`, `кл.80/81/82`.

### 3.5 Sub‑cases — scoped, gated, or documented‑incomplete
- **Авансови фактури (§B1) — v2, gated + logged to `REVIEW_QUEUE`.** ДДС на аванс е изискуем при плащане (чл.25 ал.7), with a **different `vatPeriod`** than the final invoice:
  ```
  On advance:   Dr 503/411  G   | Cr 4532  V   | Cr 412 (Клиенти по аванси)  N
  On final inv: Dr 411       G   | Cr 70x   N   | Cr 4532  V
                Dr 412       N   | Cr 411   N        (нетиране на аванса; reverse advance VAT — no double count)
  ```
  Advances are ubiquitous for SMBs; until v2, the "real VAT" is knowingly wrong for any month with a deposit.
- **Продажба на стоки — COGS incompleteness (§B2), documented.** A complete goods sale is two entries — the приход (`Dr 411 G / Cr 702 N / Cr 4532 V`) **and** отписване на отчетна стойност (`Dr 702 себестойност / Cr 304 себестойност`). The invoice carries no cost, so the tool **cannot** derive the second entry. **The Оборотна ведомост / Главна книга are therefore P&L‑incomplete** (304 not relieved, брутен резултат overstated) until an inventory module supplies себестойност — stated on the reports so no one trusts a trial balance that is missing COGS.
- **Non‑registered entity (§B5).** Journal is unconditional; VAT legs/дневник are conditional on `isVatRegistered`. Covered by Row 10 / the engine's `isVatRegistered` gate.
- **чл.70 nature‑of‑cost (§A6).** The engine offers the target expense/asset account for the capitalised ДДС; it does not hard‑default to 609.

### 3.6 Rounding — the invariant that keeps Σ Дт = Σ Кт (§F5e, lifted from `KONTIROVKA_ANALYSIS.md §3 STEP 3`)
> Compute `netB` and `vatB` **to 2 decimals independently**, then set the receivable/payable line `= netB + vatB`. **Never re‑round the sum.** VAT is rounded **per document total**, not per line (ЗДДС: данъкът се начислява върху ДО на доставката).

Storage is `numeric(15,4)`; the filing figure is 2dp. **Round at projection (into `journal_tax_lines`/report), not at storage.** This is what prevents a ±0.01 imbalance when net and VAT are rounded separately.

---

## 4. UX — wireframe level

### 4.1 The VAT page today → the month row that "becomes real"
Today `/c/[companyId]/vat` is a `'use client'` SWR table of `{month, vatIssued, vatPaid, vatNet}`. We make each **month row expandable**, showing the **Прогноза** (estimate) and, once postings exist, the **real** number with a posting‑progress meter.

```
▼ 2026-07  Начислен: 3 480.00  ДК: 1 120.00  Прогноза нето: 2 360.00  ● 8/11 контирани  [Приключи месеца]
  ├─ Tab [Документи] [Дневник продажби] [Дневник покупки] [Справка-декларация] [Оборотна ведомост] [Хронологичен] [Главна книга]
  │  ДОКУМЕНТИ (Продажби)                                                          контировка
  │  № 0000000123  05.07  «Контрагент ООД» ЕИК 123…  осн.1 701.57  ДДС 340.31  20%  ✅ Осчетоводена (Конт. N=41)
  │  № 0000000124  09.07  «Друг ЕООД»       ЕИК 456…  осн.  900.00  ДДС   0.00  ВОД  🟡 Чернова
  │  № 0000000125  …                                                                 ⚪ Не е контирана  → [Контирай]
  │  ДОКУМЕНТИ (Покупки) …
  └─ Real нето (щом всички са контирани и месецът е приключен): кл.50 за внасяне 2 360.00
```

- **Chip states:** ⚪ Не е контирана → 🟡 Чернова → ✅ Осчетоводена.
- **Reconciliation‑safe counting (§F4).** Both the numerator (posted) and the denominator (documents in the month) are counted on the **same key** — in v1 that key is the issueDate month, because `vatPeriod = issueDate month` is locked. The total stays labeled **Прогноза** until `posted = total` **and** the month is closed; only then does it flip to the **real** кл.50/кл.60 from the ledger. (When the override lands in Slice 4, both populations move to `vatPeriod`.)
- Click a document (or "Контирай") → opens **Меню Контиране**.

### 4.2 Меню Контиране (side sheet / modal) — the two‑panel posting form
```
┌ Контировка N: 41 ────────────── Дата на осчетоводяване: 09.07.2026 ┐  ┌ Основание: [Услуги ▾] ─────────────────┐
│ Тип на документа: [Фактура ▾]   Номер: 0000000123                   │  │ Забележка: […]                          │
│ Дата на документа: 05.07.2026                                       │  │ Тип на сделката: [Продажба ▾] (auto)    │
│ Партньор: Контрагент ООД · ЕИК 123456789 · ДДС BG123456789          │  │ Операция по ДДС: [Облагаема 20% ▾]      │
└─────────────────────────────────────────────────────────────────────┘  │ VIES: ☐ (ръчно)  Месец за експорт: 2026-07│
                                                                          └──────────────────────────────────────────┘
┌──────────── ДЕБИТ ────────────┐        ┌──────────── КРЕДИТ ────────────┐
│ сметка   описание        сума │        │ сметка   описание         сума │
│ 411    Клиенти        2 041.88│        │ 703   Приходи услуги    1 701.57│
│                               │        │ 4532  ДДС продажби        340.31│
├───────────────────────────────┤        ├─────────────────────────────────┤
│ Общо Дебит:          2 041.88 │   =    │ Общо Кредит:           2 041.88 │   ✅ балансирано
└───────────────────────────────┘        └─────────────────────────────────┘
                                        [ Запази чернова ]   [ Осчетоводи ]  ← enabled only when balanced
```
Rows add/remove/editable; account picker searches `BG_CHART_OF_ACCOUNTS`; changing **Операция по ДДС** re‑routes the клетка and pre‑ticks VIES (still user‑confirmed). "Осчетоводи" writes the entry (+tax lines +activity log) and flips the doc chip.

### 4.3 The derived reports (Справки — each a server component under Suspense / `use cache`, respecting `cacheComponents`/PPR)
- **Хронологичен регистър:** every posted entry chronologically; one row per posting — the classic year journal.
- **Оборотна ведомост:** per `accountCode` `начално салдо · оборот Дт · оборот Кт · крайно салдо`, summing `journal_lines.amountBase`; `SUM(Дт) − SUM(Кт) = 0` across all accounts (built‑in check). **Carries a banner: P&L‑incomplete until inventory/COGS module (§B2).**
- **ДДС дневник продажби / покупки:** one row per posted document with `register='sales'/'purchases'` in its tax lines; identity columns + value columns from `journal_tax_lines` grouped by клетка. Ascending by № по ред, gap‑free.
- **Справка‑декларация:** клетки `01/11–19 · 20/21–23 · 30–33 · 40/41–43 · 50/60 · 70/71 · 80–82`, each a `SUM` over `journal_tax_lines` — **plus** the кл.50/60 sign split and кл.80/81 carry‑forward (§5.1), so it is *not* a naïve column sum.
- **Главна книга:** per‑account chronological ledger with running balance (drill from Оборотна ведомост).

---

## 5. Real‑VAT calculation

### 5.1 From postings to the real number
Each document's posting produces a `4532` (output) or `4531` (input) movement **and** tax lines tagged with base/VAT клетки. At **month‑end close** (`Приключи месеца` — one `journal_entry` with `kind='vat_close'`, per `vatPeriod`, in base currency), gated on the period being open and all its documents posted:

```
output = Σ credit 4532 for the period                 (== кл.20 = кл.21 + кл.22 + кл.23)   [9%→кл.23, §A1]
input  = creditable Σ debit 4531 for the period        (== кл.40 = кл.41 + кл.42×кл.33 + кл.43)
Close entry:   Dr 4532 (output)  |  Cr 4531 (input)
Result (sign split, NOT a raw column sum, §F6):
      if output > input →  Cr 4539 ДДС за внасяне       = output − input = кл.50   ← REAL VAT payable
      if input > output →  Dr 4538 ДДС за възстановяване = input − output = кл.60   ← REAL VAT refundable
Carry-forward / procedure: кл.80 (приспаднат данък за внасяне от предходен период), кл.81/82, чл.92 възстановяване.
Settlement (v2, §5.3):  pay НАП  Dr 4539 | Cr 503      receive refund  Dr 503 | Cr 4538
```
**Triple reconciliation (invariant test):** `close‑entry net == (кл.20 − кл.40) == (Σ дневник‑продажби VAT − creditable Σ дневник‑покупки VAT)`. If any two disagree, a posting is wrong.

### 5.2 How it supersedes `getVatSummary`
`getVatSummary` (verified: `issuedVatSumSql` accrual minus `SUM(received.vatAmount × fxRate)` for `confirmed & archivedAt IS NULL`, **grouped by `issueDate` month — `actions.ts:1469, 1483`**) stays as the **fast Прогноза** for the dashboard and any month with unposted documents. The **real** кл.50/кл.60 replaces it for a month once **all its documents are posted and the month is closed** — and because v1 locks `vatPeriod = issueDate month`, the two are bucketed identically (§F4), so the flip cannot double‑count.

**Where estimate ≠ real (exactly):** (1) частичен ДК scales кл.40 by коеф.(кл.33); estimate counts 100%. (2) без право на ДК (кл.30) excluded from кл.40; estimate's raw `vatPaid` may include it. (3) ВОП/чл.82 самоначисляване inflates both кл.20 and кл.40 (net zero under full credit); estimate never sees it. (4) годишна корекция (кл.43) hits only December. (5) 0%/освободени/тристранни move base cells with no VAT. **Estimate == real iff** all input VAT is full‑credit, no reverse‑charge, no partial credit, no annual correction — the common micro‑SMB case. Keep the number **labeled Прогноза** until posted+closed.

### 5.3 Settlement — named limitation (§F5f)
MVP posts the **invoice, not the payment**. That is correct for accrual VAT, but it means `411/401` grow forever and the Оборотна ведомост shows uncleared receivables/payables. The payment→cash posting (`Dr 503 | Cr 411` / `Dr 401 | Cr 503`) and курсови разлики (624/724) are an **early v2 follow‑on**; until then this is documented on the report, not silently wrong.

---

## 6. (folded into §7)

---

## 7. Phasing — sequenced by signal availability and risk

Each slice is independently shippable and verifiable per CLAUDE.md ("build → run → observe → fix", assert numbers, no console/network errors, desktop + mobile).

| Slice | Deliverable | New tables/migration | Effort | Risk |
|---|---|---|---|---|
| **1 — Read‑only month drill‑down ★** | `getSalesLedger`/`getPurchaseLedger` in `lib/db/queries/dnevnik.ts` (reuse `money.ts`), month row expands into Продажби/Покупки document lists (base·VAT·rate·derived op), read‑only | **none** | **S–M** | **Low** |
| **2 — Sales posting spine (sales only)** | `journal_entries` + `journal_lines` + `journal_tax_lines` (per‑rate) + `journal_sequences`; `BG_CHART_OF_ACCOUNTS` constant; `VAT_OPERATIONS` registry (v1 rows); rule‑engine (Rows 1/2/10 core, then grounds‑derived 3/4/6/9); balance + immutability triggers; Меню Контиране; `post`→lock source→`activityLogs`; **received‑invoice edit‑lock fix (§2.6) + delete‑guard (§F2d)**; force `vatPeriod=issueDate`; Хронологичен + Оборотна read‑outs | `0008` + triggers | **L** | **Med** |
| **3 — Purchases posting (assisted‑manual)** | Rows 11/12/13: full‑credit‑20% default (human‑confirm, `extractionConfidence`‑gated) + чл.70 no‑credit; Оборотна/Главна книга gain the purchase side | small | **M** | **Med** |
| **4 — Period lock + month‑end close → real кл.50/60** | `accounting_periods` + `prevent_closed_period_posting`; `vat_close` entry; flip Прогноза→real **on the same bucket key**; now the `vatPeriod` override (deferred ДК, реверс timing) can safely arrive | small | **M** | **Med** |
| **5 — Дневник + Декларация** | ДДС дневник продажби/покупки + Справка‑декларация as `GROUP BY` over `journal_tax_lines`, with кл.50/60 sign split + кл.80/81 carry‑forward | none | **M** | **Med** — **hard‑gated on accountant клетка sign‑off (§8.2)** |
| **6 — НАП export** | `DEKLAR/PRODAGBI/POKUPKI(/VIES).TXT`, CP‑1251 fixed‑width, gap‑free 1..N, `field(width,align)` primitive + byte tests; uses the **дневник column ordinals** (§3.4), not the СД клетки | none | **M–L** | **High** — one‑char width error = НАП rejects file |
| **Later** | Протокол чл.117 dual‑ledger (ВОП/чл.82), частичен ДК (кл.33/42/43), авансови фактури, международен транспорт/тристранни, VIES validation + VIES.TXT, settlement + курсови разлики, счетоводни шаблони/автоконтиране, AI‑OCR one‑click + bulk edit | small | **L** | **Med–High** |

> The prior draft's "Phase 2 (L)" was Slices 2 + 3 + 4 + 5 collapsed. Splitting them is the single highest‑leverage change: it de‑risks the easy **sales** half, defers the no‑signal **purchase** classification, and stops period‑close from blocking the first posting release.

### 7.0 Delivery status (branch `claude-run-2.1-k`, updated 2026-07-10)
- **Slice 1 — Read‑only month drill‑down — ✅ DONE.** `getSalesLedger`/`getPurchaseLedger` (`lib/db/queries/dnevnik.ts`, reuse `money.ts`), VAT page year selector + zero‑filled month grid (`month-grid.ts` + unit tests), month‑row `MonthDnevnik` drill‑down. Reconciles to `getVatSummary` (live‑verified company 5). Also fixed the month/year bug + a cross‑company SWR cache leak.
- **Slice 2 — Sales posting spine — ✅ DONE (sales only, C‑MVP‑1 single tax line).** Shipped: `BG_CHART_OF_ACCOUNTS` (66 accounts) + `VAT_OPERATIONS` registry (+ grounds‑derived keying); contра engine (`contra.ts`, reproduces the Microinvest example) with Microinvest display naming (411/1·2, 453/1·2, 70x); `journal_entries`/`journal_lines`/`journal_tax_lines`/`journal_sequences` (migration `0008`) with **balance + immutability triggers** (DB‑verified); `postInvoiceContra` (derive→persist one balanced immutable entry→lock source `accounted`); **posting‑existence guards** on cancel/delete/un‑account (keyed on posting existence, not `accountingStatus` — stress #1/#3/#4); **`reverseInvoiceContra`** (червено сторно counter‑entry, unlocks + re‑postable) with migration `0009` making the source‑unique index partial on `status <> 'reversed'`; **Меню Контиране** panel on the invoice detail page (gated Осчетоводи / Сторнирай). Tests: `contra.test.ts` (12), `posting.integration.test.ts` (2 — post + full reverse/re‑post lifecycle), `ContiranePanel.test.tsx` (5). Full suite 294.
  - **Caveat:** the Меню Контиране UI is **unverified in‑browser** — the embedded dev preview floods (see `REVIEW_QUEUE` → PREVIEW‑FLOOD); verified via DOM + integration tests + clean `build` instead.
  - **Deferred to later Slice‑2 polish:** basis picker (currently `services` default), the remaining Microinvest names/analytics for the full chart, Хронологичен + Оборотна read‑outs.
- **Slices 3–6 + Slice 0 — not started** (purchases assisted‑manual, period lock + real кл.50/60 close, дневник/декларация, НАП export, onboarding/opening balances).

### 7.1 First shippable slice (crisp) — Slice 1 "Разбивка на месеца"
On the existing VAT page, make each **month row expand** into two read‑only lists — **Продажби** and **Покупки** — one row per document: `№ · дата · контрагент (име+ЕИК) · данъчна основа · ДДС · ставка · изведена Операция по ДДС`. Powered by new `getSalesLedger({from,to})` / `getPurchaseLedger({from,to})` in `lib/db/queries/dnevnik.ts` that **reuse `money.ts`** (CN subtract via `signedVatSql`/`signedGrossSql`, finalized non‑proforma, `× fxRate`).
**Acceptance / done:** `Σ(sales list base/VAT for a month) == getVatSummary.vatIssued` and `Σ(purchase list) == vatPaid` for a seeded month (assert the numbers, per CLAUDE.md — not eyeballed); no console errors; layout intact desktop + mobile.
**Why first:** zero new tables, zero migrations, zero НАП‑cell risk, zero posting semantics — yet it delivers immediate accountant value (every document behind the net number) and builds the exact data spine (`dnevnik.ts`) every later slice consumes.

---

## 8. Open questions

### 8.1 For the owner (product decisions — proceed on the reversible default, log to `REVIEW_QUEUE`)
1. **Submit vs generate:** generate НАП files for the accountant to upload (what every surveyed system does), or ever submit via portal + КЕП ourselves? *(Default: generate‑only for v1.)*
2. **Протокол чл.117 / ВОП** in v1 or v2? *(Default: v2 — the only dual‑ledger case.)*
3. **Частичен данъчен кредит** in scope for our SMB target, or full‑credit‑only v1? *(Default: full‑credit v1; schema leaves room.)*
4. **Сметкоплан depth:** ship the national constant (v1) and add a per‑company editable chart with analytics later, or invest in editable + analytics now? How deep should defaults go for a non‑accountant owner vs a счетоводител? *(Default: constant v1, editable later.)*
5. **Auto‑account on post:** posting sets source `accountingStatus='accounted'` (reversal reverts)? *(Default: yes.)*
6. **Месец за експорт override:** keep locked to issueDate in v1 (reconciles cleanly) and unlock with period‑close in Slice 4? *(Default: yes — this is C‑MVP‑2.)*
7. **Settlement postings** (payment→cash 501/503, курсови разлики 624/724) — how soon after v1? *(Default: early v2 follow‑on; until then `411/401` don't clear, documented on the report.)*
8. **Per‑program export** (Делта/Ажур TXT/XML) in addition to НАП files, for inv.bg‑style interop — real target? *(Unverifiable; confirm.)*

### 8.2 For the accountant (Koceto) — HARD GATE on Slice 5/6, not on posting
1. **Приложение 13 клетки confirmed** (§3.2/§D) — one final look at the live НАП form / .xsd. The only prior error (9% → **кл.23**) is fixed; confirm the rest, especially кл.16 (чл.30) and кл.18 (тристранни/извън страната).
2. **Дневник column ordinals (Прил. 10/11)** — the **second** numbering system (24‑ vs 25‑column образец) the export needs; these are *not* the СД клетки (§3.4).
3. **Byte‑exact widths/offsets** of `DEKLAR/PRODAGBI/POKUPKI` vs the current НАП technical spec (name 50 vs 80, money 13 vs 15, reserved positions) — ideally diff our output against a file НАП accepts.
4. **9% purchase side:** confirm no rate split (all creditable → кл.31/41 regardless of 20% vs 9%) — Rows 11/12, note ².
5. **чл.70 capitalisation targets** (§A6): representative → 609; ДМА → 20x gross; vehicle fuel → vehicle account — confirm the default map.
6. **Частичен ДК method (§A5):** provisional‑full + годишна корекция (кл.43) vs split‑at‑posting (V×коеф) — which to implement for v2.
7. **Авансови фактури (§B1):** confirm the advance/final/нетиране postings and the vatPeriod split before v2.
8. **Credit‑note register convention:** negative base/VAT rows (our choice, matches `signedVatSql`) vs dedicated reduction columns — confirm НАП accepts negatives.
9. **VAT rounding** per‑document (our choice, §3.6) for кл. totals to reconcile with the СД.
10. **VIES trigger set** {ВОД (чл.53 ал.1), услуги чл.21 ал.2, посредник тристранна} — confirmed outbound‑only, **ВОП excluded** (§A3).

---

## 9. Reconciliation with `getVatSummary` and `dds-dnevnik-spec.md`

### 9.1 With `getVatSummary` (`actions.ts:1451`)
- **Keep it, relabel it Прогноза.** It remains the accrual‑netting estimate for the dashboard and unposted months — explicitly *not* a filing source.
- **Bucketing (the fix, §F4):** `getVatSummary` groups by `issueDate` month (`actions.ts:1469, 1483`). v1 **locks `vatPeriod = issueDate month`**, so the estimate and the real ledger reconcile exactly and the "month complete" count is well‑defined. When the override lands (Slice 4), the count and the reconciliation test both move to `vatPeriod`, and the Прогноза row is recomputed on that key.
- **Formal relationship:** real `кл.20 == issuedVatSumSql` when every sale is standard taxable with CN‑signed; real `кл.40 == full + коеф.×partial + correction ≤ Σ(received VAT × fxRate)`. Therefore `vatNet (estimate) == кл.50/кл.60 (real)` **iff** full‑credit‑only, no reverse‑charge, no partial, no annual correction (§5.2).
- **Invariant test:** for a seeded "simple" month, `getSalesLedger Σ == vatIssued`, `getPurchaseLedger Σ == vatPaid`, and after posting+close `declaration.кл50 == vatNet`. Advanced features *legitimately* diverge — the test asserts divergence is only from cases (1)–(5) in §5.2.

### 9.2 With `docs/knowledge/dds-dnevnik-spec.md`
This plan is the **superset** that subsumes the spec. Fold back (same commit as Slice 1):
1. **Correction:** real VAT cells are **кл.50 (за внасяне) / кл.60 (за възстановяване) = кл.20 − кл.40** — fix any `кл.40/50` or "кл.11 output" shorthand in the spec/roadmap, and reconcile with `KONTIROVKA_ANALYSIS.md §9` (which used кл.40/50).
2. **Per‑line ledger honored:** the spec's "build the ledger to read per‑line so it's already correct when mixed rates arrive" (lines 33–35, 74) is realised by `journal_tax_lines` — the header‑projection idea is **dropped** (§F2a).
3. **Build order** refined into the §7 slices (spec steps 1→3 == Slice 1, Slice 5, Slice 6).
4. **Reconciliation invariant** preserved verbatim as the Slice 1 test.
5. **"клетка mapping — DO NOT GUESS"** is now the `VAT_OPERATIONS` registry + the §8.2 accountant hard‑gate; cell numbers never hard‑coded.
6. **Протокол по чл.117** promoted from "out of scope v1" to a fully‑specified **v2** dual‑ledger design (§3.2 Rows 15/16).
7. Mark the spec **Status: superseded by KONT‑1/RVAT‑1**; tick items in `docs/PRODUCT_ROADMAP.md`; add the received‑invoice edit‑lock fix + delete‑guard to `docs/REFACTOR_BACKLOG.md`; log авансови фактури, settlement, and multi‑currency re‑valuation to `docs/REVIEW_QUEUE.md`.

### 9.3 Files this touches (for the builder)
**New:** `lib/db/queries/dnevnik.ts`; `src/features/kontirovka/{engine.ts, vat-operations.ts, chart-of-accounts.ts, actions.ts}`; `lib/db/migrations/0008_kontirovka.sql` (+ hand‑written `enforce_journal_balance`, `prevent_posted_journal_mutation`, `prevent_closed_period_posting`); report pages under `app/(dashboard)/c/[companyId]/vat/…` and a `…/schetovodstvo/…` (Справки) route.
**Reuse:** `lib/db/queries/money.ts` (`signedVatSql`/`signedGrossSql`/currency), `allocateNumber`/`frozenFxRate` (`actions.ts:200–253`), `parseInvoiceTotalsStrict`/`parsePartySnapshotStrict`, `vat-grounds.ts` (key on `чл.53 ал.1` etc., §C1), `formatInvoiceNumber`, **`activityLogs`** (`schema.ts:563`), **`extractionConfidence`** (`schema.ts:454`).
**Modify:** `received-invoices/actions.ts:795` (edit‑lock guard); the invoice + received‑invoice **delete** actions (posting‑aware delete‑guard, §2.6). Schema additions in `lib/db/schema.ts` beside the existing tables + app enums at `:820+`.