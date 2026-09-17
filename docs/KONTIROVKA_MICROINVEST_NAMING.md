# Контировка — Microinvest naming & per-row сметкоплан codes (build reference)

> Owner directive (2026-07): the **Меню Контиране** must look and read like the **blue
> software (Microinvest Делта)** — same field labels, same account display, same "Операция по
> ДДС" wording. Every контировка Дебит/Кредит row is an account **picked from the national
> сметкоплан** (https://balans.bg/sbornik/smetkoplan) shown as **`код + наименование`**.
> This file is the naming source of truth for Slice 2 (the posting form); it refines
> `KONTIROVKA_PLAN.md` §1.2 and `KONTIROVKA_OWNER_UX_AND_CHART.md` §B (the picker) with the
> exact Microinvest strings from the owner's screenshot.

## 1. Меню Контиране — field labels (exactly as Microinvest)

Header, two columns:

| Left column | Right column |
|---|---|
| **Контировка N** (posting no., 10-digit) | **Основание** (Услуги / Стоки / …) |
| **Дата на осчетоводяване** | **Забележка** |
| **Тип на документа** (Фактура / Кредитно известие / Дебитно известие / Проформа фактура / Протокол) | **Тип на сделката** (Продажба / Покупка) |
| **Номер на документ** | **Операция по ДДС** (e.g. „Облагаеми доставки и др. с 20% ДДС“) |
| **Дата на документа** | **VIES** („Не участва в декларацията“ / …) |
| **Партньор** | **Месец за експорт** (MM.YYYY) |

Body — two side-by-side grids, column headers exactly:
- **Дебит** · **Описание** · **Сума**   (left)
- **Кредит** · **Описание** · **Сума**   (right)

Footer, exactly: **Салдо: X** … **Общо Дебит: X**  |  **Салдо: -Y** … **Общо Кредит: X**.
"Осчетоводи" is disabled until **Общо Дебит = Общо Кредит**. Bottom-right: **Отказ**.

## 2. Account display on контировка rows — Microinvest style

Each row's account is `код наименование`, using the **Microinvest alias code** (analytic level)
and the **Microinvest short name** — NOT the raw synthetic code/national name:

| Our synthetic (chart) | Display **код** | Display **наименование** (Microinvest) |
|---|---|---|
| 411 (+ currency analytic) | **411/1** (лева) · **411/2** (евро) | **Клиенти в лева** · **Клиенти в евро** |
| 401 (+ currency analytic) | **401/1** · **401/2** | **Доставчици в лева** · **Доставчици в евро** |
| 4532 | **453/2** | **ДДС Продажби** |
| 4531 | **453/1** | **ДДС Покупки** |
| 4539 | **453/9** | **ДДС за внасяне** |
| 4538 | **453/8** | **ДДС за възстановяване** |
| 703 | **703** | **Приходи от продажба на услуги** |
| 702 | **702** | **Приходи от продажба на стоки** |
| 701 | **701** | **Приходи от продажба на продукция** |
| 602 | **602** | **Разходи за външни услуги** |
| 601 | **601** | **Разходи за материали** |
| 304 | **304** | **Стоки** |

Notes:
- Microinvest uses **„продажба“ (singular)** in 70x names — align our display names to match.
- The **currency analytic** (`/1` лева, `/2` евро) is the level the owner expects on the row
  (the screenshot shows `411/1 Клиенти в лева`). Post-euro-adoption a EUR-base company uses
  `411/2 … в евро`. → Slice 2 must surface the analytic level for `411/401` (revisits
  `OWNER_UX_AND_CHART §B0 Decision 0b`, which deferred analytics — the owner wants it now).

## 3. Per-row categorisation from balans.bg сметкоплан

- The Дебит/Кредит account on every row is chosen from `BG_CHART_OF_ACCOUNTS`
  (`src/features/kontirovka/chart-of-accounts.ts`, seeded from balans.bg), via the grouped
  **клас → група → сметка** picker (search by number or name).
- The engine pre-fills the row from the operation template (sale → `411/x` + `70x` + `453/2`);
  the user can re-pick any account from the full chart.
- Store on each stored journal line a **snapshot** of `{ code (alias), name, group }` so a
  historical контировка never shifts if the chart is later edited.

## 4. "Операция по ДДС" wording (Microinvest labels)

Align `VAT_OPERATION_META[].label` to Microinvest phrasing where it differs, e.g.
`sale_std_20` → **„Облагаеми доставки и др. с 20% ДДС“** (matches the screenshot), and the
VIES field default **„Не участва в декларацията“**. The клетка mapping stays as in
`vat-operations.ts` (WIRING-verified); only the display strings match Microinvest.

## 5. Build tasks this adds to Slice 2

1. Add a Microinvest **`displayName`** (+ analytic `/1·/2` for `411/401`) layer over the chart
   for the контировка UI, without changing the national `code`/`name` used for reports.
2. Меню Контиране form uses the §1 labels verbatim.
3. `VAT_OPERATION_META.label` re-worded to Microinvest (§4).
4. The account picker renders `alias name` (Microinvest) but keeps the national code underneath.
