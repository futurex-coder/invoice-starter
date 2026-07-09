/**
 * KONT-1 Slice 2 — the contра engine: turn one document into a balanced
 * double-entry счетоводна статия (Дебит / Кредит lines).
 *
 * Templates per docs/KONTIROVKA_PLAN.md §6 + WIRING §1.7/§1.8; display naming per
 * docs/KONTIROVKA_MICROINVEST_NAMING.md (the blue-software look): analytic codes
 * (411/2 Клиенти в евро, 453/2 ДДС Продажби) and Microinvest account names.
 *
 * Pure: no DB. Amounts are in the company BASE currency (GEN-1). The caller
 * passes the document's POSITIVE net/vat/gross; a credit note is negated here
 * (сторно), matching signedVatSql. Invariant: Σ Дебит = Σ Кредит.
 */

import {
  getVatOperationMeta,
  type VatOperation,
  type DealType,
} from './vat-operations';
import { getAccount } from './chart-of-accounts';

export const ACCOUNTING_BASES = [
  'services',
  'goods',
  'production',
  'materials',
  'fixed_asset',
  'other',
] as const;
export type AccountingBasis = (typeof ACCOUNTING_BASES)[number];

export type ContraSide = 'debit' | 'credit';

export interface ContraLine {
  side: ContraSide;
  /** Display code (Microinvest analytic, e.g. '411/2', '453/2', '703'). */
  code: string;
  /** Display name (Microinvest wording). */
  name: string;
  /** Signed amount in the base currency (сторно → negative). */
  amount: number;
  /** National synthetic code the line posts to (for reports/ledgers). */
  account: string;
}

export interface Contra {
  lines: ContraLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export interface ContraInput {
  dealType: DealType;
  /** 'invoice' | 'credit_note' | 'debit_note' (proforma never posts). */
  docType: string;
  vatOperation: VatOperation;
  basis: AccountingBasis;
  /** Company base currency — drives the 411/401 currency analytic. */
  currency: string;
  /** Document totals in the base currency, POSITIVE (сторно handled here). */
  net: number;
  vat: number;
  gross: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// basis → приход (70x) account for a sale
const SALE_ACCOUNT: Record<AccountingBasis, string> = {
  services: '703',
  goods: '702',
  production: '701',
  materials: '706',
  fixed_asset: '705',
  other: '709',
};

// basis → разход/запас (60x/30x/20x) account for a purchase
const PURCHASE_ACCOUNT: Record<AccountingBasis, string> = {
  services: '602',
  goods: '304',
  production: '601',
  materials: '601',
  fixed_asset: '204',
  other: '609',
};

// Microinvest display names (override the national name for контировка rows).
const MI_NAME: Record<string, string> = {
  '701': 'Приходи от продажба на продукция',
  '702': 'Приходи от продажба на стоки',
  '703': 'Приходи от продажба на услуги',
  '705': 'Приходи от продажба на ДА',
  '706': 'Приходи от продажба на материали',
  '709': 'Други приходи от дейността',
  '601': 'Разходи за материали',
  '602': 'Разходи за външни услуги',
  '609': 'Други разходи',
  '304': 'Стоки',
  '204': 'Съоръжения',
};

/** Resolve an account to its Microinvest display {code, name} + national code. */
function displayAccount(
  account: string,
  currency: string
): { code: string; name: string; account: string } {
  const isLev = currency === 'BGN';
  const suffix = isLev ? '1' : '2';
  const curWord = isLev ? 'лева' : 'евро';
  if (account === '411') {
    return { code: `411/${suffix}`, name: `Клиенти в ${curWord}`, account };
  }
  if (account === '401') {
    return { code: `401/${suffix}`, name: `Доставчици в ${curWord}`, account };
  }
  if (account === '4532') return { code: '453/2', name: 'ДДС Продажби', account };
  if (account === '4531') return { code: '453/1', name: 'ДДС Покупки', account };
  const name = MI_NAME[account] ?? getAccount(account)?.name ?? account;
  return { code: account, name, account };
}

function line(
  side: ContraSide,
  account: string,
  currency: string,
  amount: number
): ContraLine {
  const d = displayAccount(account, currency);
  return { side, code: d.code, name: d.name, account: d.account, amount };
}

/**
 * Build the balanced контировка for a document. Sale: Dr 411 / Cr 70x (+ Cr 4532
 * when the operation charges VAT). Purchase full credit: Dr 60x/30x + Dr 4531 /
 * Cr 401; no-credit (чл.70) capitalises the VAT into the cost (Dr 60x = gross).
 * Credit notes negate every amount.
 */
export function buildContra(input: ContraInput): Contra {
  const meta = getVatOperationMeta(input.vatOperation);
  const sign = input.docType === 'credit_note' ? -1 : 1;
  const net = round2(input.net * sign);
  const vat = round2(input.vat * sign);
  const gross = round2(input.gross * sign);
  const cur = input.currency;
  const lines: ContraLine[] = [];

  if (input.dealType === 'sale') {
    const revenue = SALE_ACCOUNT[input.basis];
    if (meta.hasVatLeg) {
      lines.push(line('debit', '411', cur, gross));
      lines.push(line('credit', revenue, cur, net));
      lines.push(line('credit', '4532', cur, vat));
    } else {
      // 0% / ВОД / износ / exempt / out-of-scope — no output VAT leg (gross = net)
      lines.push(line('debit', '411', cur, net));
      lines.push(line('credit', revenue, cur, net));
    }
  } else {
    const expense = PURCHASE_ACCOUNT[input.basis];
    if (input.vatOperation === 'purchase_no_credit') {
      // чл.70 — VAT is non-deductible, capitalised into the cost's nature
      lines.push(line('debit', expense, cur, gross));
      lines.push(line('credit', '401', cur, gross));
    } else if (meta.hasVatLeg) {
      lines.push(line('debit', expense, cur, net));
      lines.push(line('debit', '4531', cur, vat));
      lines.push(line('credit', '401', cur, gross));
    } else {
      lines.push(line('debit', expense, cur, net));
      lines.push(line('credit', '401', cur, net));
    }
  }

  const totalDebit = round2(
    lines.filter((l) => l.side === 'debit').reduce((s, l) => s + l.amount, 0)
  );
  const totalCredit = round2(
    lines.filter((l) => l.side === 'credit').reduce((s, l) => s + l.amount, 0)
  );

  return {
    lines,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.005,
  };
}
