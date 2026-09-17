import { describe, it, expect } from 'vitest';
import { buildMonthGrid } from './month-grid';
import type { VatMonthRow } from '@/src/features/bulgarian-invoicing/actions';

const row = (month: string, vatIssued: number): VatMonthRow => ({
  month,
  vatIssued,
  vatPaid: 0,
  vatNet: vatIssued,
});

describe('buildMonthGrid', () => {
  it('current year: shows every month from the current month down to January', () => {
    const grid = buildMonthGrid(2026, 2026, 7, [row('2026-01', 100), row('2026-07', 50)]);
    // 7 months, descending, none missing
    expect(grid.map((g) => g.month)).toEqual([
      '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01',
    ]);
    // data merged where present
    expect(grid[0].vatIssued).toBe(50); // Jul
    expect(grid[6].vatIssued).toBe(100); // Jan
    // gaps zero-filled (Feb–Jun)
    expect(grid.slice(1, 6).every((g) => g.vatIssued === 0)).toBe(true);
  });

  it('no future months for the current year', () => {
    const grid = buildMonthGrid(2026, 2026, 3, []);
    expect(grid.map((g) => g.month)).toEqual(['2026-03', '2026-02', '2026-01']);
  });

  it('a past year shows all 12 months, December first', () => {
    const grid = buildMonthGrid(2025, 2026, 7, [row('2025-05', 42)]);
    expect(grid.length).toBe(12);
    expect(grid[0].month).toBe('2025-12');
    expect(grid[11].month).toBe('2025-01');
    const may = grid.find((g) => g.month === '2025-05');
    expect(may?.vatIssued).toBe(42);
  });

  it('a future year shows no months', () => {
    expect(buildMonthGrid(2027, 2026, 7, [])).toEqual([]);
  });

  it('zero-filled months carry the correct zero triple', () => {
    const grid = buildMonthGrid(2026, 2026, 2, []);
    expect(grid[0]).toEqual({ month: '2026-02', vatIssued: 0, vatPaid: 0, vatNet: 0 });
  });
});
