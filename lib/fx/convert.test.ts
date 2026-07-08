import { describe, it, expect } from 'vitest';
import {
  EUR_BGN_FIXED,
  FxRateUnavailableError,
  convert,
  rateToBase,
  roundTo,
  unitsPerEur,
} from './convert';

// Sample ECB-style rates (units per 1 EUR). BGN is overridden by the fixed law.
const RATES = { USD: 1.08, GBP: 0.85, BGN: 1.95583 };

describe('fx/convert', () => {
  it('BGN↔EUR uses the fixed euro-adoption rate, not the passed BGN rate', () => {
    expect(EUR_BGN_FIXED).toBe(1.95583);
    // 1 EUR = 1.95583 BGN
    expect(convert(1, 'EUR', 'BGN', {})).toBeCloseTo(1.95583, 6);
    // 1.95583 BGN = 1 EUR
    expect(convert(1.95583, 'BGN', 'EUR', {})).toBeCloseTo(1, 6);
    // even if a bogus BGN rate is supplied, the fixed one wins
    expect(convert(1, 'EUR', 'BGN', { BGN: 999 })).toBeCloseTo(1.95583, 6);
  });

  it('identity conversion returns the amount unchanged', () => {
    expect(convert(123.45, 'EUR', 'EUR', RATES)).toBe(123.45);
    expect(convert(50, 'USD', 'USD', RATES)).toBe(50);
  });

  it('converts USD → EUR via the cross rate', () => {
    // 108 USD at 1.08 USD/EUR = 100 EUR
    expect(convert(108, 'USD', 'EUR', RATES)).toBeCloseTo(100, 6);
    // 100 EUR = 108 USD
    expect(convert(100, 'EUR', 'USD', RATES)).toBeCloseTo(108, 6);
  });

  it('converts USD → BGN through EUR (cross + fixed leg)', () => {
    // 108 USD → 100 EUR → 195.583 BGN
    expect(convert(108, 'USD', 'BGN', RATES)).toBeCloseTo(195.583, 4);
  });

  it('rateToBase gives amount_base = amount_doc × fxRate (rounded to 6dp)', () => {
    // BGN doc, EUR base: 1 BGN = 1/1.95583 EUR ≈ 0.511292
    const fx = rateToBase('BGN', 'EUR', RATES);
    expect(fx).toBeCloseTo(0.511292, 6);
    expect(200 * fx).toBeCloseTo(102.2584, 3); // 200 BGN ≈ 102.26 EUR
    // EUR doc, EUR base: fxRate is exactly 1
    expect(rateToBase('EUR', 'EUR', RATES)).toBe(1);
  });

  it('throws for an unknown currency with no rate', () => {
    expect(() => convert(10, 'JPY', 'EUR', RATES)).toThrow(FxRateUnavailableError);
    expect(() => unitsPerEur('JPY', RATES)).toThrow(/JPY/);
  });

  it('rejects non-positive / non-finite rates', () => {
    expect(() => unitsPerEur('USD', { USD: 0 })).toThrow(FxRateUnavailableError);
    expect(() => unitsPerEur('USD', { USD: -1 })).toThrow(FxRateUnavailableError);
    expect(() => unitsPerEur('USD', { USD: Number.NaN })).toThrow(FxRateUnavailableError);
  });

  it('roundTo rounds half-up to the given precision', () => {
    expect(roundTo(0.5112918, 6)).toBe(0.511292);
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(100, 2)).toBe(100);
  });
});
