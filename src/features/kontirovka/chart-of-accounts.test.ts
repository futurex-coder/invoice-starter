import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_TYPES,
  BG_CHART_OF_ACCOUNTS,
  BG_ACCOUNTS_BY_CODE,
  getAccount,
  isAutoPostable,
  ACCOUNT_CLASS_LABELS,
  ACCOUNT_GROUP_LABELS,
} from './chart-of-accounts';

describe('BG_CHART_OF_ACCOUNTS', () => {
  it('has exactly 66 synthetic accounts, all with unique codes', () => {
    expect(BG_CHART_OF_ACCOUNTS.length).toBe(66);
    const codes = BG_CHART_OF_ACCOUNTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(66);
    expect(BG_ACCOUNTS_BY_CODE.size).toBe(66);
  });

  it('matches the documented per-class counts (4·14·4·16·5·13·10)', () => {
    const byClass = new Map<number, number>();
    for (const a of BG_CHART_OF_ACCOUNTS) {
      byClass.set(a.class, (byClass.get(a.class) ?? 0) + 1);
    }
    expect(byClass.get(1)).toBe(4);
    expect(byClass.get(2)).toBe(14);
    expect(byClass.get(3)).toBe(4);
    expect(byClass.get(4)).toBe(16);
    expect(byClass.get(5)).toBe(5);
    expect(byClass.get(6)).toBe(13);
    expect(byClass.get(7)).toBe(10);
  });

  it('every account is structurally valid (type, side, class, 2-digit group)', () => {
    for (const a of BG_CHART_OF_ACCOUNTS) {
      expect(ACCOUNT_TYPES).toContain(a.type);
      expect(['debit', 'credit']).toContain(a.normalSide);
      expect([1, 2, 3, 4, 5, 6, 7, 9]).toContain(a.class);
      expect(a.group).toMatch(/^\d{2}$/);
      // the group's first digit must equal the account's class
      expect(a.group[0]).toBe(String(a.class));
      expect(a.code.length).toBeGreaterThanOrEqual(3);
      expect(a.name.length).toBeGreaterThan(0);
    }
  });

  it('normalSide is consistent with account type (contra assets excepted)', () => {
    for (const a of BG_CHART_OF_ACCOUNTS) {
      if (a.contra) {
        // contra-asset (24x): asset that carries a credit normal balance
        expect(a.type).toBe('asset');
        expect(a.normalSide).toBe('credit');
        continue;
      }
      const expected =
        a.type === 'asset' || a.type === 'expense' ? 'debit' : 'credit';
      expect(a.normalSide).toBe(expected);
    }
  });

  it('isVat is set on exactly 4531/4532/4538/4539', () => {
    const vat = BG_CHART_OF_ACCOUNTS.filter((a) => a.isVat).map((a) => a.code);
    expect(vat.sort()).toEqual(['4531', '4532', '4538', '4539']);
  });

  it('fxAnalytic is set on exactly the разчети partner accounts 401/402/411/412', () => {
    const fx = BG_CHART_OF_ACCOUNTS.filter((a) => a.fxAnalytic).map((a) => a.code);
    expect(fx.sort()).toEqual(['401', '402', '411', '412']);
  });

  it('autoPostable is exactly the 17 engine-targetable accounts', () => {
    const auto = BG_CHART_OF_ACCOUNTS.filter((a) => a.autoPostable).map((a) => a.code);
    expect(auto.sort()).toEqual(
      [
        '204', '302', '304', '401', '411', '4531', '4532', '601', '602',
        '609', '701', '702', '703', '704', '705', '706', '709',
      ].sort()
    );
    expect(auto.length).toBe(17);
  });

  it('the core auto legs exist with the right sides (sale + purchase + VAT)', () => {
    expect(getAccount('411')?.normalSide).toBe('debit'); // client receivable
    expect(getAccount('401')?.normalSide).toBe('credit'); // supplier payable
    expect(getAccount('4532')?.normalSide).toBe('credit'); // output VAT
    expect(getAccount('4531')?.normalSide).toBe('debit'); // input VAT
    expect(getAccount('703')?.type).toBe('revenue'); // default sale revenue
    expect(getAccount('602')?.type).toBe('expense'); // default purchase expense
    expect(getAccount('4532')?.alias).toBe('453/2');
    expect(getAccount('4531')?.alias).toBe('453/1');
  });

  it('getAccount / isAutoPostable behave for known and unknown codes', () => {
    expect(getAccount('411')?.name).toBe('Вземания от клиенти');
    expect(getAccount('999')).toBeUndefined();
    expect(isAutoPostable('703')).toBe(true);
    expect(isAutoPostable('101')).toBe(false); // picker-only
    expect(isAutoPostable('999')).toBe(false);
  });

  it('every class and group present has a picker label', () => {
    for (const a of BG_CHART_OF_ACCOUNTS) {
      expect(ACCOUNT_CLASS_LABELS[a.class]).toBeTruthy();
      expect(ACCOUNT_GROUP_LABELS[a.group]).toBeTruthy();
    }
  });
});
