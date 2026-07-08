import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { formatDate, formatMoney, relativeTime } from './format';

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const r = formatDate('2026-05-27');
    // Bulgarian DD.MM.YYYY
    expect(r).toBe('27.05.2026');
  });

  it('formats a Date object', () => {
    const d = new Date('2026-01-15T00:00:00Z');
    // Note: actual output depends on timezone. We assert the format shape.
    const r = formatDate(d);
    expect(r).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('returns "—" for null/undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns the original string for unparseable input', () => {
    expect(formatDate('not a date')).toBe('not a date');
  });

  it('returns "—" for an unparseable Date object', () => {
    expect(formatDate(new Date('invalid'))).toBe('—');
  });
});

describe('formatMoney', () => {
  it('formats with two decimal places', () => {
    expect(formatMoney(100)).toMatch(/^100[.,]00$/);
    expect(formatMoney(1.5)).toMatch(/^1[.,]50$/);
  });

  it('pads sub-cent values to 2 decimals', () => {
    expect(formatMoney(0)).toMatch(/^0[.,]00$/);
    expect(formatMoney(0.1)).toMatch(/^0[.,]10$/);
  });

  it('truncates to 2 decimals (does not extend precision)', () => {
    const r = formatMoney(1.236);
    // toLocaleString rounds — exact behavior depends on locale
    expect(r).toMatch(/^1[.,]24$/);
  });

  it('handles negative amounts', () => {
    expect(formatMoney(-100)).toMatch(/^-100[.,]00$/);
  });
});

describe('relativeTime', () => {
  let now: number;
  beforeAll(() => {
    now = Date.parse('2026-05-27T12:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for < 1 minute', () => {
    expect(relativeTime(new Date(now - 30_000))).toBe('току-що');
    expect(relativeTime(new Date(now))).toBe('току-що');
  });

  it('returns minute count up to 59 minutes', () => {
    expect(relativeTime(new Date(now - 5 * 60_000))).toBe('преди 5 мин');
    expect(relativeTime(new Date(now - 59 * 60_000))).toBe('преди 59 мин');
  });

  it('returns hour count up to 23 hours', () => {
    expect(relativeTime(new Date(now - 2 * 3_600_000))).toBe('преди 2 ч');
    expect(relativeTime(new Date(now - 23 * 3_600_000))).toBe('преди 23 ч');
  });

  it('returns day count up to 29 days', () => {
    expect(relativeTime(new Date(now - 2 * 86_400_000))).toBe('преди 2 дни');
    expect(relativeTime(new Date(now - 29 * 86_400_000))).toBe('преди 29 дни');
  });

  it('falls back to formatted date for dates older than 30 days', () => {
    const old = new Date('2026-01-01T00:00:00Z');
    const r = relativeTime(old);
    expect(r).toMatch(/^\d{2}\.\d{2}\.2026$/);
  });

  it('returns "" for null / undefined / invalid date', () => {
    expect(relativeTime(null)).toBe('');
    expect(relativeTime(undefined)).toBe('');
    expect(relativeTime('not a date')).toBe('');
  });

  it('accepts ISO strings', () => {
    const iso = new Date(now - 10 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe('преди 10 мин');
  });
});
