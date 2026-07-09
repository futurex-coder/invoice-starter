/**
 * KONT-1 — "Операция по ДДС" registry: the single source of truth mapping each
 * VAT operation to its ДДС-дневник register and справка-декларация (Прил. 13)
 * cell. Engine, дневник and export all read these rows; no cell number is ever
 * hard-coded in logic (docs/KONTIROVKA_WIRING_STRESS.md §3.4).
 *
 * Cells are the accountant-confirmed Приложение-13 клетки (WIRING §1.7/§1.8).
 * The дневник column ordinals (Прил. 10/11) are a SEPARATE numbering system,
 * added per-op when the export slice lands — never conflate them with `cell`.
 *
 * ⚠️ Contains the fix for stress finding #2 / plan P1: `deriveExemptVatOperation`
 * keys on the EXACT `VAT_EXEMPTION_GROUNDS[].ref` strings — the plan's abbreviated
 * `чл.53 ал.1` never substring-matches the stored `'ЗДДС, чл. 53, ал. 1 — …'`, so
 * every ВОД/износ/EU/exempt sale would otherwise silently post as standard 20%.
 */

import {
  VAT_EXEMPTION_GROUNDS,
  isKnownVatGround,
} from '@/src/features/bulgarian-invoicing/vat-grounds';

export const REGISTERS = ['sales', 'purchases'] as const;
/** Which ДДС дневник a document enters. `null` ⇒ not ledgered. */
export type Register = (typeof REGISTERS)[number];

export const DEAL_TYPES = ['sale', 'purchase'] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const VAT_OPERATIONS = [
  // sales
  'sale_std_20',
  'sale_std_9',
  'sale_export_0',
  'sale_ics_0',
  'sale_intl_transport_0',
  'sale_eu_services_rc',
  'sale_outside_scope',
  'sale_triangular',
  'sale_exempt',
  'no_vat_out_of_scope',
  // purchases
  'purchase_full_20',
  'purchase_full_9',
  'purchase_no_credit',
  'purchase_partial',
  'vop_protocol',
  'art82_services_rc',
  // sentinel — free-text ground the engine could not classify → manual pick
  'unclassified',
] as const;
export type VatOperation = (typeof VAT_OPERATIONS)[number];

export interface VatOperationMeta {
  code: VatOperation;
  /** BG label for the picker / ledger "изведена операция" column. */
  label: string;
  /** Which ДДС дневник, or `null` when the operation is not ledgered. */
  register: Register | null;
  /** Whether the operation posts a 4531/4532 VAT leg. */
  hasVatLeg: boolean;
  /** Справка-декларация (Прил. 13) клетка for the tax base, or `null`. */
  baseCell: number | null;
  /** Справка-декларация клетка for the VAT amount, or `null` (0%/exempt). */
  vatCell: number | null;
  /** Outbound deliverable also declared in VIES (ВОД / услуги чл.21 / тристранни). */
  vies: boolean;
  /** Reverse-charge dual-ledger (fills BOTH registers via a self-charge protokol). */
  dual: boolean;
  tier: 'core' | 'v1' | 'v2';
}

// The registry. Cells per WIRING §1.7 (sales) / §1.8 (purchases).
export const VAT_OPERATION_META: Readonly<Record<VatOperation, VatOperationMeta>> = {
  sale_std_20: { code: 'sale_std_20', label: 'Облагаеми доставки и др. с 20% ДДС', register: 'sales', hasVatLeg: true, baseCell: 11, vatCell: 21, vies: false, dual: false, tier: 'core' },
  sale_std_9: { code: 'sale_std_9', label: 'Облагаеми доставки и др. с 9% ДДС', register: 'sales', hasVatLeg: true, baseCell: 13, vatCell: 23, vies: false, dual: false, tier: 'v1' },
  sale_export_0: { code: 'sale_export_0', label: 'Износ извън ЕС (чл.28)', register: 'sales', hasVatLeg: false, baseCell: 14, vatCell: null, vies: false, dual: false, tier: 'v1' },
  sale_ics_0: { code: 'sale_ics_0', label: 'ВОД на стоки (чл.53 ал.1)', register: 'sales', hasVatLeg: false, baseCell: 15, vatCell: null, vies: true, dual: false, tier: 'v1' },
  sale_intl_transport_0: { code: 'sale_intl_transport_0', label: 'Международен транспорт (чл.30)', register: 'sales', hasVatLeg: false, baseCell: 16, vatCell: null, vies: false, dual: false, tier: 'v2' },
  sale_eu_services_rc: { code: 'sale_eu_services_rc', label: 'Услуги към ЕС (чл.21 ал.2)', register: 'sales', hasVatLeg: false, baseCell: 17, vatCell: null, vies: true, dual: false, tier: 'v1' },
  sale_outside_scope: { code: 'sale_outside_scope', label: 'Място на изпълнение извън страната', register: 'sales', hasVatLeg: false, baseCell: 18, vatCell: null, vies: false, dual: false, tier: 'v2' },
  sale_triangular: { code: 'sale_triangular', label: 'Посредник в тристранна операция', register: 'sales', hasVatLeg: false, baseCell: 18, vatCell: null, vies: true, dual: false, tier: 'v2' },
  sale_exempt: { code: 'sale_exempt', label: 'Освободена доставка (чл.38–48)', register: 'sales', hasVatLeg: false, baseCell: 19, vatCell: null, vies: false, dual: false, tier: 'v1' },
  no_vat_out_of_scope: { code: 'no_vat_out_of_scope', label: 'Извън обхвата — не участва в дневниците', register: null, hasVatLeg: false, baseCell: null, vatCell: null, vies: false, dual: false, tier: 'v1' },

  purchase_full_20: { code: 'purchase_full_20', label: 'Покупка с пълен данъчен кредит 20%', register: 'purchases', hasVatLeg: true, baseCell: 31, vatCell: 41, vies: false, dual: false, tier: 'v1' },
  purchase_full_9: { code: 'purchase_full_9', label: 'Покупка с пълен данъчен кредит 9%', register: 'purchases', hasVatLeg: true, baseCell: 31, vatCell: 41, vies: false, dual: false, tier: 'v1' },
  purchase_no_credit: { code: 'purchase_no_credit', label: 'Покупка без право на данъчен кредит (чл.70)', register: 'purchases', hasVatLeg: false, baseCell: 30, vatCell: null, vies: false, dual: false, tier: 'v1' },
  purchase_partial: { code: 'purchase_partial', label: 'Покупка с частичен данъчен кредит (чл.73)', register: 'purchases', hasVatLeg: true, baseCell: 32, vatCell: 42, vies: false, dual: false, tier: 'v2' },
  vop_protocol: { code: 'vop_protocol', label: 'ВОП / протокол по чл.117', register: 'purchases', hasVatLeg: true, baseCell: 31, vatCell: 41, vies: false, dual: true, tier: 'v2' },
  art82_services_rc: { code: 'art82_services_rc', label: 'Получени услуги по чл.82 (протокол)', register: 'purchases', hasVatLeg: true, baseCell: 31, vatCell: 41, vies: false, dual: true, tier: 'v2' },

  unclassified: { code: 'unclassified', label: 'За класифициране', register: null, hasVatLeg: false, baseCell: null, vatCell: null, vies: false, dual: false, tier: 'v1' },
} as const;

export function getVatOperationMeta(op: VatOperation): VatOperationMeta {
  return VAT_OPERATION_META[op];
}

/** „Тип на сделката" — the Microinvest deal-type label. */
export const DEAL_TYPE_LABELS: Record<DealType, string> = {
  sale: 'Продажба',
  purchase: 'Покупка',
};

/** „VIES" field text — whether the deal is declared in the VIES декларация. */
export function getViesLabel(vies: boolean): string {
  return vies ? 'Участва в декларацията (VIES)' : 'Не участва в декларацията';
}

// ── Keying map: exact vat-grounds ref → VatOperation (fixes stress #2 / P1) ───

// Keyed on the EXACT `ref` constants in vat-grounds.ts (whitespace as stored).
const REF_TO_VAT_OPERATION: Readonly<Record<string, VatOperation>> = {
  'ЗДДС, чл. 21, ал. 2': 'sale_eu_services_rc', // кл.17, VIES
  'ЗДДС, чл. 53, ал. 1': 'sale_ics_0', // кл.15, VIES (ВОД)
  'ЗДДС, чл. 28': 'sale_export_0', // кл.14
  'ЗДДС, чл. 30': 'sale_intl_transport_0', // кл.16 (v2)
  'ЗДДС, чл. 39': 'sale_exempt', // кл.19
  'ЗДДС, чл. 40': 'sale_exempt',
  'ЗДДС, чл. 41': 'sale_exempt',
  'ЗДДС, чл. 44': 'sale_exempt',
  'ЗДДС, чл. 45': 'sale_exempt',
  'ЗДДС, чл. 46': 'sale_exempt',
};

/**
 * Map a stored `invoices.noVatReason` (a curated ЗДДС ground, "Друго" free text,
 * or null) to a VatOperation. Free-text / unknown → `unclassified` (manual pick),
 * NEVER `sale_std_20` (the silent-misclassification bug) and never
 * `no_vat_out_of_scope` (which would drop the sale from кл.19 via register=NULL).
 */
export function deriveExemptVatOperation(
  noVatReason: string | null | undefined
): VatOperation {
  if (!noVatReason) return 'unclassified';
  if (!isKnownVatGround(noVatReason)) return 'unclassified';
  const ground = VAT_EXEMPTION_GROUNDS.find(
    (g) =>
      noVatReason === `${g.ref} — ${g.description}` ||
      noVatReason.startsWith(g.ref)
  );
  return (ground && REF_TO_VAT_OPERATION[ground.ref]) ?? 'unclassified';
}

/**
 * Best-effort per-document sale VatOperation for display/labelling. Standard mode
 * → `sale_std_20`/`sale_std_9` by rate; no-VAT mode → the exact-keyed exempt op.
 * (Mixed-rate docs carry per-line rates; the per-rate emission arrives in Slice 5.)
 */
export function deriveSaleVatOperation(
  vatMode: string | null | undefined,
  vatRate: number | null | undefined,
  noVatReason: string | null | undefined
): VatOperation {
  if (vatMode === 'no_vat') return deriveExemptVatOperation(noVatReason);
  // standard (or unspecified) taxable supply
  return vatRate === 9 ? 'sale_std_9' : 'sale_std_20';
}
