import { describe, it, expect } from 'vitest';
import { buildContra, type ContraInput } from './contra';

function find(c: ReturnType<typeof buildContra>, code: string) {
  return c.lines.find((l) => l.code === code);
}

const base: Omit<ContraInput, 'dealType' | 'vatOperation' | 'basis'> = {
  docType: 'invoice',
  currency: 'EUR',
  net: 1701.57,
  vat: 340.31,
  gross: 2041.88,
};

describe('buildContra — sales', () => {
  it('reproduces the Microinvest example (услуги 20%, EUR base)', () => {
    const c = buildContra({
      ...base,
      dealType: 'sale',
      vatOperation: 'sale_std_20',
      basis: 'services',
    });
    expect(c.balanced).toBe(true);
    expect(c.totalDebit).toBe(2041.88);
    expect(c.totalCredit).toBe(2041.88);

    const client = find(c, '411/2');
    expect(client).toMatchObject({ side: 'debit', name: 'Клиенти в евро', amount: 2041.88 });
    const rev = find(c, '703');
    expect(rev).toMatchObject({ side: 'credit', name: 'Приходи от продажба на услуги', amount: 1701.57 });
    const vat = find(c, '453/2');
    expect(vat).toMatchObject({ side: 'credit', name: 'ДДС Продажби', amount: 340.31 });
  });

  it('uses the лева analytic (411/1) for a BGN-base company', () => {
    const c = buildContra({
      ...base,
      currency: 'BGN',
      dealType: 'sale',
      vatOperation: 'sale_std_20',
      basis: 'services',
    });
    expect(find(c, '411/1')).toMatchObject({ name: 'Клиенти в лева', amount: 2041.88 });
    expect(find(c, '411/2')).toBeUndefined();
  });

  it('9% goods → 702 revenue + 453/2 VAT', () => {
    const c = buildContra({
      ...base,
      net: 1000, vat: 90, gross: 1090,
      dealType: 'sale',
      vatOperation: 'sale_std_9',
      basis: 'goods',
    });
    expect(c.balanced).toBe(true);
    expect(find(c, '702')).toMatchObject({ side: 'credit', name: 'Приходи от продажба на стоки', amount: 1000 });
    expect(find(c, '453/2')?.amount).toBe(90);
  });

  it('exempt/0% sale posts no VAT leg (Dr 411 / Cr 70x only)', () => {
    const c = buildContra({
      ...base,
      net: 1000, vat: 0, gross: 1000,
      dealType: 'sale',
      vatOperation: 'sale_exempt',
      basis: 'services',
    });
    expect(c.balanced).toBe(true);
    expect(c.lines.length).toBe(2);
    expect(find(c, '453/2')).toBeUndefined();
    expect(find(c, '411/2')?.amount).toBe(1000);
    expect(find(c, '703')?.amount).toBe(1000);
  });

  it('credit note negates every amount and still balances (сторно)', () => {
    const c = buildContra({
      ...base,
      docType: 'credit_note',
      dealType: 'sale',
      vatOperation: 'sale_std_20',
      basis: 'services',
    });
    expect(c.balanced).toBe(true);
    expect(find(c, '411/2')?.amount).toBe(-2041.88);
    expect(find(c, '703')?.amount).toBe(-1701.57);
    expect(find(c, '453/2')?.amount).toBe(-340.31);
    expect(c.totalDebit).toBe(-2041.88);
    expect(c.totalCredit).toBe(-2041.88);
  });
});

describe('buildContra — purchases', () => {
  it('full credit 20% services → Dr 602 + Dr 453/1 / Cr 401', () => {
    const c = buildContra({
      ...base,
      net: 1000, vat: 200, gross: 1200,
      dealType: 'purchase',
      vatOperation: 'purchase_full_20',
      basis: 'services',
    });
    expect(c.balanced).toBe(true);
    expect(find(c, '602')).toMatchObject({ side: 'debit', name: 'Разходи за външни услуги', amount: 1000 });
    expect(find(c, '453/1')).toMatchObject({ side: 'debit', name: 'ДДС Покупки', amount: 200 });
    expect(find(c, '401/2')).toMatchObject({ side: 'credit', name: 'Доставчици в евро', amount: 1200 });
  });

  it('no-credit (чл.70) capitalises VAT into the cost (Dr expense = gross)', () => {
    const c = buildContra({
      ...base,
      net: 1000, vat: 200, gross: 1200,
      dealType: 'purchase',
      vatOperation: 'purchase_no_credit',
      basis: 'services',
    });
    expect(c.balanced).toBe(true);
    expect(find(c, '602')?.amount).toBe(1200); // VAT-inclusive cost
    expect(find(c, '453/1')).toBeUndefined(); // no input-VAT leg
    expect(find(c, '401/2')?.amount).toBe(1200);
  });
});

describe('buildContra — balance invariant holds for every template', () => {
  const cases: ContraInput[] = [
    { dealType: 'sale', docType: 'invoice', vatOperation: 'sale_std_20', basis: 'services', currency: 'EUR', net: 33.33, vat: 6.67, gross: 40 },
    { dealType: 'sale', docType: 'invoice', vatOperation: 'sale_ics_0', basis: 'goods', currency: 'EUR', net: 500, vat: 0, gross: 500 },
    { dealType: 'sale', docType: 'debit_note', vatOperation: 'sale_std_20', basis: 'production', currency: 'BGN', net: 10, vat: 2, gross: 12 },
    { dealType: 'purchase', docType: 'invoice', vatOperation: 'purchase_full_9', basis: 'materials', currency: 'EUR', net: 77.77, vat: 7, gross: 84.77 },
    { dealType: 'purchase', docType: 'credit_note', vatOperation: 'purchase_full_20', basis: 'goods', currency: 'EUR', net: 100, vat: 20, gross: 120 },
  ];
  it.each(cases)('balances %#', (input) => {
    const c = buildContra(input);
    expect(c.balanced).toBe(true);
    expect(c.lines.every((l) => l.code && l.name && l.account)).toBe(true);
  });
});
