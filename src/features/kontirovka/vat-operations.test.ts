import { describe, it, expect } from 'vitest';
import {
  VAT_OPERATIONS,
  VAT_OPERATION_META,
  getVatOperationMeta,
  deriveExemptVatOperation,
  deriveSaleVatOperation,
} from './vat-operations';
import {
  VAT_EXEMPTION_GROUNDS,
  vatGroundValue,
} from '@/src/features/bulgarian-invoicing/vat-grounds';

describe('VAT_OPERATION_META registry', () => {
  it('has a meta row for every operation, each with a label', () => {
    for (const op of VAT_OPERATIONS) {
      const meta = getVatOperationMeta(op);
      expect(meta.code).toBe(op);
      expect(meta.label.length).toBeGreaterThan(0);
    }
    expect(Object.keys(VAT_OPERATION_META).length).toBe(VAT_OPERATIONS.length);
  });

  it('is internally consistent (register/cell/vat-leg rules)', () => {
    for (const op of VAT_OPERATIONS) {
      const m = getVatOperationMeta(op);
      // a VAT leg implies a VAT declaration cell; no VAT leg implies none
      if (m.hasVatLeg) expect(m.vatCell).not.toBeNull();
      else expect(m.vatCell).toBeNull();
      // a ledgered operation has a base cell; a non-ledgered one has neither
      if (m.register === null) {
        expect(m.baseCell).toBeNull();
        expect(m.vatCell).toBeNull();
      } else {
        expect(m.baseCell).not.toBeNull();
      }
    }
  });

  it('only the standard taxable ops carry an output/input VAT leg', () => {
    const withVat = VAT_OPERATIONS.filter((op) => VAT_OPERATION_META[op].hasVatLeg);
    expect(withVat.sort()).toEqual(
      [
        'sale_std_20', 'sale_std_9', 'purchase_full_20', 'purchase_full_9',
        'purchase_partial', 'vop_protocol', 'art82_services_rc',
      ].sort()
    );
  });

  it('VIES flag is outbound-only (ВОД / чл.21 / тристранни) — never ВОП', () => {
    const vies = VAT_OPERATIONS.filter((op) => VAT_OPERATION_META[op].vies);
    expect(vies.sort()).toEqual(
      ['sale_ics_0', 'sale_eu_services_rc', 'sale_triangular'].sort()
    );
    expect(VAT_OPERATION_META.vop_protocol.vies).toBe(false);
  });
});

describe('deriveExemptVatOperation — the keying fix (stress #2 / P1)', () => {
  it('maps EVERY curated ЗДДС ground to its correct non-standard op', () => {
    // This is the exact bug: the stored value is "ЗДДС, чл. 53, ал. 1 — …",
    // and it must resolve to ВОД (sale_ics_0), NOT silently to sale_std_20.
    const expected: Record<string, string> = {
      'ЗДДС, чл. 21, ал. 2': 'sale_eu_services_rc',
      'ЗДДС, чл. 53, ал. 1': 'sale_ics_0',
      'ЗДДС, чл. 28': 'sale_export_0',
      'ЗДДС, чл. 30': 'sale_intl_transport_0',
      'ЗДДС, чл. 39': 'sale_exempt',
      'ЗДДС, чл. 40': 'sale_exempt',
      'ЗДДС, чл. 41': 'sale_exempt',
      'ЗДДС, чл. 44': 'sale_exempt',
      'ЗДДС, чл. 45': 'sale_exempt',
      'ЗДДС, чл. 46': 'sale_exempt',
    };
    for (const g of VAT_EXEMPTION_GROUNDS) {
      const stored = vatGroundValue(g); // the EXACT string in invoices.noVatReason
      const op = deriveExemptVatOperation(stored);
      expect(op).toBe(expected[g.ref]);
      // regression guard for the actual bug — never the silent standard fallthrough
      expect(op).not.toBe('sale_std_20');
      // and never the register=NULL op that would drop it from кл.19
      expect(op).not.toBe('no_vat_out_of_scope');
    }
  });

  it('every curated ground is covered by the map (no ground → unclassified)', () => {
    for (const g of VAT_EXEMPTION_GROUNDS) {
      expect(deriveExemptVatOperation(vatGroundValue(g))).not.toBe('unclassified');
    }
  });

  it('null / empty / free-text ("Друго") → unclassified (manual pick)', () => {
    expect(deriveExemptVatOperation(null)).toBe('unclassified');
    expect(deriveExemptVatOperation('')).toBe('unclassified');
    expect(deriveExemptVatOperation('някакво свободно основание')).toBe('unclassified');
    expect(deriveExemptVatOperation('чл. 53')).toBe('unclassified'); // partial/abbreviated → not a known ground
  });
});

describe('deriveSaleVatOperation', () => {
  it('standard mode resolves by rate', () => {
    expect(deriveSaleVatOperation('standard', 20, null)).toBe('sale_std_20');
    expect(deriveSaleVatOperation('standard', 9, null)).toBe('sale_std_9');
    expect(deriveSaleVatOperation('standard', null, null)).toBe('sale_std_20');
  });

  it('no_vat mode delegates to the exact exempt keying', () => {
    const vod = vatGroundValue(VAT_EXEMPTION_GROUNDS[1]); // чл.53 ал.1 = ВОД
    expect(deriveSaleVatOperation('no_vat', 0, vod)).toBe('sale_ics_0');
    expect(deriveSaleVatOperation('no_vat', 0, 'свободен текст')).toBe('unclassified');
  });
});
