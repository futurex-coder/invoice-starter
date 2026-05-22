import { describe, it, expect } from 'vitest';
import {
  parseAccountingStatus,
  parsePaymentStatus,
  parsePaymentMethod,
  parseSupplierSnapshot,
  isAccountingStatus,
  isPaymentStatus,
  isPaymentMethod,
} from './parsers';

describe('parseAccountingStatus', () => {
  it('accepts pending and accounted', () => {
    expect(parseAccountingStatus('pending')).toBe('pending');
    expect(parseAccountingStatus('accounted')).toBe('accounted');
  });

  it('falls back to pending', () => {
    expect(parseAccountingStatus(null)).toBe('pending');
    expect(parseAccountingStatus('bogus')).toBe('pending');
  });
});

describe('parsePaymentStatus', () => {
  it('accepts the 3 statuses', () => {
    expect(parsePaymentStatus('unpaid')).toBe('unpaid');
    expect(parsePaymentStatus('partial')).toBe('partial');
    expect(parsePaymentStatus('paid')).toBe('paid');
  });

  it('falls back to unpaid', () => {
    expect(parsePaymentStatus('refunded')).toBe('unpaid');
  });
});

describe('parsePaymentMethod', () => {
  it('accepts the 3 methods', () => {
    expect(parsePaymentMethod('bank')).toBe('bank');
    expect(parsePaymentMethod('cash')).toBe('cash');
    expect(parsePaymentMethod('barter')).toBe('barter');
  });

  it('falls back to bank', () => {
    expect(parsePaymentMethod('card')).toBe('bank');
  });
});

describe('parseSupplierSnapshot', () => {
  it('parses a complete snapshot', () => {
    const snap = parseSupplierSnapshot({
      legalName: 'Acme Ltd',
      eik: '123456789',
      vatNumber: 'BG123456789',
      country: 'BG',
      city: 'Sofia',
      street: 'Vitosha 1',
      postCode: '1000',
    });
    expect(snap.legalName).toBe('Acme Ltd');
    expect(snap.city).toBe('Sofia');
  });

  it('returns null-filled snapshot for nullish input', () => {
    const snap = parseSupplierSnapshot(null);
    expect(snap.legalName).toBeNull();
    expect(snap.eik).toBeNull();
    expect(snap.vatNumber).toBeNull();
  });

  it('accepts snapshots where optional fields are nullable strings', () => {
    const snap = parseSupplierSnapshot({
      legalName: 'OK',
      eik: '111111111',
      vatNumber: null,
      country: null,
      city: null,
      street: null,
      postCode: null,
    });
    expect(snap.legalName).toBe('OK');
    expect(snap.vatNumber).toBeNull();
    expect(snap.country).toBeNull();
  });
});

describe('type guards', () => {
  it('isAccountingStatus', () => {
    expect(isAccountingStatus('pending')).toBe(true);
    expect(isAccountingStatus('accounted')).toBe(true);
    expect(isAccountingStatus('booked')).toBe(false);
  });

  it('isPaymentStatus', () => {
    expect(isPaymentStatus('unpaid')).toBe(true);
    expect(isPaymentStatus('overdue')).toBe(false);
  });

  it('isPaymentMethod', () => {
    expect(isPaymentMethod('bank')).toBe(true);
    expect(isPaymentMethod('card')).toBe(false);
  });
});
