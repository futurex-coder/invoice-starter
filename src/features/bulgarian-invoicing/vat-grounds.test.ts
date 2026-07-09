import { describe, it, expect } from 'vitest';
import {
  VAT_EXEMPTION_GROUNDS,
  vatGroundValue,
  isKnownVatGround,
} from './vat-grounds';

describe('vat-grounds', () => {
  it('has a non-empty curated list with ЗДДС references', () => {
    expect(VAT_EXEMPTION_GROUNDS.length).toBeGreaterThan(0);
    for (const g of VAT_EXEMPTION_GROUNDS) {
      expect(g.ref).toMatch(/^ЗДДС, чл\. \d/);
      expect(g.description.length).toBeGreaterThan(0);
    }
  });

  it('has unique references and stored values', () => {
    const refs = VAT_EXEMPTION_GROUNDS.map((g) => g.ref);
    const values = VAT_EXEMPTION_GROUNDS.map(vatGroundValue);
    expect(new Set(refs).size).toBe(refs.length);
    expect(new Set(values).size).toBe(values.length);
  });

  it('formats the stored value as "ref — description"', () => {
    expect(vatGroundValue(VAT_EXEMPTION_GROUNDS[0])).toBe(
      'ЗДДС, чл. 21, ал. 2 — Услуги към данъчно задължено лице в ЕС (обратно начисляване)'
    );
  });

  it('round-trips: every curated ground is recognised', () => {
    for (const g of VAT_EXEMPTION_GROUNDS) {
      expect(isKnownVatGround(vatGroundValue(g))).toBe(true);
    }
  });

  it('does not recognise free text or empty strings', () => {
    expect(isKnownVatGround('')).toBe(false);
    expect(isKnownVatGround('някакво свободно основание')).toBe(false);
    expect(isKnownVatGround('чл. 21')).toBe(false);
  });
});
