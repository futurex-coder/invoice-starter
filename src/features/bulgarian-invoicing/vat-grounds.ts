/**
 * Common legal grounds for issuing an invoice without charging Bulgarian VAT
 * ("без ДДС"), for a VAT-registered supplier.
 *
 * Accountants distrust free text here, so the invoice form offers this curated
 * list of ЗДДС references and falls back to free text ("Друго") for anything
 * not covered. The `value` is what we store in `invoices.no_vat_reason` and
 * print on the document, so it must read as a complete, professional basis.
 *
 * NOTE: this list is a sensible starting set (see docs/REVIEW_QUEUE VAT-2) and
 * should be reviewed/extended by an accountant. It is intentionally NOT
 * exhaustive — the free-text fallback covers the long tail.
 */
export interface VatExemptionGround {
  /** Article reference, e.g. "ЗДДС, чл. 21, ал. 2". */
  ref: string;
  /** Short human description of the case. */
  description: string;
}

export const VAT_EXEMPTION_GROUNDS: readonly VatExemptionGround[] = [
  {
    ref: 'ЗДДС, чл. 21, ал. 2',
    description: 'Услуги към данъчно задължено лице в ЕС (обратно начисляване)',
  },
  {
    ref: 'ЗДДС, чл. 53, ал. 1',
    description: 'Вътреобщностна доставка на стоки (ВОД)',
  },
  {
    ref: 'ЗДДС, чл. 28',
    description: 'Износ на стоки извън ЕС',
  },
  {
    ref: 'ЗДДС, чл. 30',
    description: 'Международен транспорт на стоки',
  },
  {
    ref: 'ЗДДС, чл. 39',
    description: 'Освободена доставка — здравни (медицински) услуги',
  },
  {
    ref: 'ЗДДС, чл. 40',
    description: 'Освободена доставка — социални грижи и осигуряване',
  },
  {
    ref: 'ЗДДС, чл. 41',
    description: 'Освободена доставка — образование и обучение',
  },
  {
    ref: 'ЗДДС, чл. 44',
    description: 'Освободена доставка — финансови услуги',
  },
  {
    ref: 'ЗДДС, чл. 45',
    description: 'Освободена доставка, свързана с недвижими имоти',
  },
  {
    ref: 'ЗДДС, чл. 46',
    description: 'Освободена доставка — застрахователни услуги',
  },
] as const;

/** The stored / printed string for a ground: "ЗДДС, чл. X — описание". */
export function vatGroundValue(g: VatExemptionGround): string {
  return `${g.ref} — ${g.description}`;
}

/** True when a stored reason matches one of the curated grounds. */
export function isKnownVatGround(reason: string): boolean {
  return VAT_EXEMPTION_GROUNDS.some((g) => vatGroundValue(g) === reason);
}
