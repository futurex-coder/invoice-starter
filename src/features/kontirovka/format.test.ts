import { describe, it, expect } from 'vitest';
import { formatPostingNumber, formatExportMonth } from './format';

describe('formatPostingNumber', () => {
  it('pads a posted number to 10 digits', () => {
    expect(formatPostingNumber(1)).toBe('0000000001');
    expect(formatPostingNumber(12345)).toBe('0000012345');
  });
  it('shows „(нова)" while unposted (null)', () => {
    expect(formatPostingNumber(null)).toBe('(нова)');
  });
});

describe('formatExportMonth', () => {
  it('reformats YYYY-MM → MM.YYYY (Microinvest)', () => {
    expect(formatExportMonth('2026-06')).toBe('06.2026');
    expect(formatExportMonth('2025-11')).toBe('11.2025');
  });
  it('passes through anything that is not YYYY-MM', () => {
    expect(formatExportMonth('')).toBe('');
    expect(formatExportMonth('2026')).toBe('2026');
  });
});
