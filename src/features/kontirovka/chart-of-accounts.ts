/**
 * KONT-1 — Bulgarian national chart of accounts (Национален сметкоплан), the
 * curated MVP synthetic subset that drives the контировка engine.
 *
 * One typed shape serves three consumers:
 *  - the account PICKER   → `class`/`group` grouping, `code`/`name` display
 *  - the ENGINE           → `type`/`normalSide`/`isVat`/`autoPostable`
 *  - the future editable chart → `fxAnalytic`/`contra`
 *
 * Source of truth: docs/KONTIROVKA_OWNER_UX_AND_CHART.md §B1 (66 synthetic
 * accounts). Historical postings snapshot {code, name, group} onto each
 * journal line, so a later editable per-company chart never shifts old entries.
 */

export const ACCOUNT_TYPES = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
  'offbalance',
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Same vocabulary as journal_lines.side. */
export type NormalSide = 'debit' | 'credit';

export interface ChartAccount {
  /** синтетична сметка, national code ('411', '4532'). */
  code: string;
  /** official БГ наименование. */
  name: string;
  /** РАЗДЕЛ / КЛАС. */
  class: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9;
  /** ГРУПА, 2-digit ('41', '45', '70'). */
  group: string;
  type: AccountType;
  /** Normal (closing) balance side. Dr → 'debit', Cr → 'credit'. */
  normalSide: NormalSide;
  /** 4531/4532/4538/4539 — gated by companies.isVatRegistered. */
  isVat?: boolean;
  /** 24x — contra-asset (credit-normal against an asset). */
  contra?: boolean;
  /** May carry a per-currency /1·/2 аналитичен in the editable-chart slice. */
  fxAnalytic?: boolean;
  /** The engine may target it; others are picker-only. */
  autoPostable?: boolean;
  /** Accountant-familiar display alias (453/1 etc.). */
  alias?: string;
}

// The full 66-row seed. Trailing comment = Tier (core|v1|v2|picker).
export const BG_CHART_OF_ACCOUNTS: readonly ChartAccount[] = [
  // ── КЛАС 1 · Капитал и заеми ──────────────────────────────────────────────
  { code: '101', name: 'Основен капитал', class: 1, group: '10', type: 'equity', normalSide: 'credit' }, // picker
  { code: '123', name: 'Печалби и загуби от текущата година', class: 1, group: '12', type: 'equity', normalSide: 'credit' }, // v2 (year-end 123 close)
  { code: '151', name: 'Получени краткосрочни заеми', class: 1, group: '15', type: 'liability', normalSide: 'credit' }, // picker
  { code: '152', name: 'Получени дългосрочни заеми', class: 1, group: '15', type: 'liability', normalSide: 'credit' }, // picker

  // ── КЛАС 2 · Дълготрайни активи ───────────────────────────────────────────
  { code: '201', name: 'Земи (терени)', class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '202', name: 'Сгради и конструкции', class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '203', name: 'Компютърна техника', class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '204', name: 'Съоръжения', class: 2, group: '20', type: 'asset', normalSide: 'debit', autoPostable: true }, // v1 (fixed_asset default)
  { code: '205', name: 'Машини и оборудване', class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '206', name: 'Транспортни средства', class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '207', name: 'Офис обзавеждане', class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '209', name: 'Други ДМА', class: 2, group: '20', type: 'asset', normalSide: 'debit' }, // picker
  { code: '212', name: 'Програмни продукти', class: 2, group: '21', type: 'asset', normalSide: 'debit' }, // picker
  { code: '213', name: 'Права върху интелектуална собственост', class: 2, group: '21', type: 'asset', normalSide: 'debit' }, // picker
  { code: '214', name: 'Права върху индустриална собственост', class: 2, group: '21', type: 'asset', normalSide: 'debit' }, // picker
  { code: '219', name: 'Други ДНА', class: 2, group: '21', type: 'asset', normalSide: 'debit' }, // picker
  { code: '241', name: 'Амортизация на ДМА', class: 2, group: '24', type: 'asset', normalSide: 'credit', contra: true }, // v2 (depreciation)
  { code: '242', name: 'Амортизация на ДНА', class: 2, group: '24', type: 'asset', normalSide: 'credit', contra: true }, // v2 (depreciation)

  // ── КЛАС 3 · Материални запаси ────────────────────────────────────────────
  { code: '301', name: 'Доставки', class: 3, group: '30', type: 'asset', normalSide: 'debit' }, // picker
  { code: '302', name: 'Материали', class: 3, group: '30', type: 'asset', normalSide: 'debit', autoPostable: true }, // v1 (materials)
  { code: '303', name: 'Продукция', class: 3, group: '30', type: 'asset', normalSide: 'debit' }, // v2 (production COGS — WIRING P13)
  { code: '304', name: 'Стоки', class: 3, group: '30', type: 'asset', normalSide: 'debit', autoPostable: true }, // v1 (goods)

  // ── КЛАС 4 · Разчети ──────────────────────────────────────────────────────
  { code: '401', name: 'Задължения към доставчици', class: 4, group: '40', type: 'liability', normalSide: 'credit', fxAnalytic: true, autoPostable: true }, // core (purchase Cr leg)
  { code: '402', name: 'Вземания от доставчици по аванси', class: 4, group: '40', type: 'asset', normalSide: 'debit', fxAnalytic: true }, // v2 (advances)
  { code: '411', name: 'Вземания от клиенти', class: 4, group: '41', type: 'asset', normalSide: 'debit', fxAnalytic: true, autoPostable: true }, // core (sale Dr leg)
  { code: '412', name: 'Задължения към клиенти по аванси', class: 4, group: '41', type: 'liability', normalSide: 'credit', fxAnalytic: true }, // v2 (advances)
  { code: '421', name: 'Задължения към персонал', class: 4, group: '42', type: 'liability', normalSide: 'credit' }, // picker (manual JE)
  { code: '422', name: 'Разчети с подотчетни лица', class: 4, group: '42', type: 'asset', normalSide: 'debit' }, // picker
  { code: '452', name: 'Разчети за корпоративни данъци', class: 4, group: '45', type: 'liability', normalSide: 'credit' }, // picker
  { code: '4531', name: 'ДДС на покупките', class: 4, group: '45', type: 'asset', normalSide: 'debit', isVat: true, autoPostable: true, alias: '453/1' }, // v1 (input VAT)
  { code: '4532', name: 'ДДС на продажбите', class: 4, group: '45', type: 'liability', normalSide: 'credit', isVat: true, autoPostable: true, alias: '453/2' }, // core (output VAT)
  { code: '4538', name: 'ДДС за възстановяване', class: 4, group: '45', type: 'asset', normalSide: 'debit', isVat: true, alias: '453/8' }, // v1 (close result)
  { code: '4539', name: 'ДДС за внасяне', class: 4, group: '45', type: 'liability', normalSide: 'credit', isVat: true, alias: '453/9' }, // v1 (close result)
  { code: '454', name: 'Разчети за данъци върху доходи на ФЛ', class: 4, group: '45', type: 'liability', normalSide: 'credit' }, // picker
  { code: '461', name: 'Разчети за задължително социално осигуряване', class: 4, group: '46', type: 'liability', normalSide: 'credit' }, // picker
  { code: '463', name: 'Разчети за здравно осигуряване', class: 4, group: '46', type: 'liability', normalSide: 'credit' }, // picker
  { code: '498', name: 'Други дебитори', class: 4, group: '49', type: 'asset', normalSide: 'debit' }, // picker
  { code: '499', name: 'Други кредитори', class: 4, group: '49', type: 'liability', normalSide: 'credit' }, // picker

  // ── КЛАС 5 · Финансови средства ───────────────────────────────────────────
  { code: '501', name: 'Каса в левове', class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // v2 (settlement)
  { code: '502', name: 'Каса във валута', class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // v2
  { code: '503', name: 'Разплащателна сметка в левове', class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // v2
  { code: '504', name: 'Разплащателна сметка във валута', class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // v2
  { code: '509', name: 'Други парични средства', class: 5, group: '50', type: 'asset', normalSide: 'debit' }, // picker

  // ── КЛАС 6 · Разходи ──────────────────────────────────────────────────────
  { code: '601', name: 'Разходи за материали', class: 6, group: '60', type: 'expense', normalSide: 'debit', autoPostable: true }, // v1 (materials/production)
  { code: '602', name: 'Разходи за външни услуги', class: 6, group: '60', type: 'expense', normalSide: 'debit', autoPostable: true }, // v1 DEFAULT purchase
  { code: '603', name: 'Разходи за амортизация', class: 6, group: '60', type: 'expense', normalSide: 'debit' }, // v2 (depreciation)
  { code: '604', name: 'Разходи за заплати', class: 6, group: '60', type: 'expense', normalSide: 'debit' }, // picker (manual JE)
  { code: '605', name: 'Разходи за осигуровки', class: 6, group: '60', type: 'expense', normalSide: 'debit' }, // picker (manual JE)
  { code: '606', name: 'Разходи за данъци, такси и подобни', class: 6, group: '60', type: 'expense', normalSide: 'debit' }, // picker
  { code: '609', name: 'Други разходи', class: 6, group: '60', type: 'expense', normalSide: 'debit', autoPostable: true }, // v1 (чл.70 fallback / представителни / Друго)
  { code: '611', name: 'Разходи за основна дейност', class: 6, group: '61', type: 'expense', normalSide: 'debit' }, // picker
  { code: '614', name: 'Административни разходи', class: 6, group: '61', type: 'expense', normalSide: 'debit' }, // picker
  { code: '615', name: 'Разходи за продажби', class: 6, group: '61', type: 'expense', normalSide: 'debit' }, // picker
  { code: '621', name: 'Разходи за лихви', class: 6, group: '62', type: 'expense', normalSide: 'debit' }, // picker
  { code: '624', name: 'Разходи от валутни операции', class: 6, group: '62', type: 'expense', normalSide: 'debit' }, // v2 (курсови разлики)
  { code: '629', name: 'Други финансови разходи', class: 6, group: '62', type: 'expense', normalSide: 'debit' }, // picker

  // ── КЛАС 7 · Приходи ──────────────────────────────────────────────────────
  { code: '701', name: 'Приходи от продажби на продукция', class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (production)
  { code: '702', name: 'Приходи от продажби на стоки', class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (goods)
  { code: '703', name: 'Приходи от продажби на услуги', class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 DEFAULT sale
  { code: '704', name: 'Приходи от наеми', class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (rent — Наем card override)
  { code: '705', name: 'Приходи от продажби на ДА', class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (fixed_asset)
  { code: '706', name: 'Приходи от продажби на материали', class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (materials)
  { code: '709', name: 'Други приходи от дейността', class: 7, group: '70', type: 'revenue', normalSide: 'credit', autoPostable: true }, // v1 (other)
  { code: '721', name: 'Приходи от лихви', class: 7, group: '72', type: 'revenue', normalSide: 'credit' }, // picker
  { code: '724', name: 'Приходи от валутни операции', class: 7, group: '72', type: 'revenue', normalSide: 'credit' }, // v2 (курсови разлики)
  { code: '729', name: 'Други финансови приходи', class: 7, group: '72', type: 'revenue', normalSide: 'credit' }, // picker
] as const;

export const BG_ACCOUNTS_BY_CODE: ReadonlyMap<string, ChartAccount> = new Map(
  BG_CHART_OF_ACCOUNTS.map((a) => [a.code, a])
);

/** Look up a synthetic account by its national code. */
export function getAccount(code: string): ChartAccount | undefined {
  return BG_ACCOUNTS_BY_CODE.get(code);
}

/** Accounts the engine is allowed to target automatically (picker-only otherwise). */
export function isAutoPostable(code: string): boolean {
  return BG_ACCOUNTS_BY_CODE.get(code)?.autoPostable === true;
}

// ── Picker tree labels ──────────────────────────────────────────────────────

export const ACCOUNT_CLASS_LABELS: Record<number, string> = {
  1: 'Капитал',
  2: 'Дълготрайни активи',
  3: 'Материални запаси',
  4: 'Разчети',
  5: 'Финансови средства',
  6: 'Разходи',
  7: 'Приходи',
  9: 'Задбалансови',
};

export const ACCOUNT_GROUP_LABELS: Record<string, string> = {
  '10': 'Капитал',
  '12': 'Финансови резултати',
  '15': 'Заеми',
  '20': 'ДМА',
  '21': 'ДНА',
  '24': 'Амортизации',
  '30': 'Материални запаси',
  '40': 'Доставчици',
  '41': 'Клиенти',
  '42': 'Персонал и съдружници',
  '45': 'Разчети с бюджета',
  '46': 'Разчети с осигурители',
  '49': 'Разни дебитори и кредитори',
  '50': 'Парични средства',
  '60': 'Разходи по икономически елементи',
  '61': 'Разходи за дейността',
  '62': 'Финансови разходи',
  '70': 'Приходи от продажби',
  '72': 'Финансови приходи',
};
