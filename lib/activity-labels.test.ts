import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_LABELS,
  isActivityType,
  formatActivityAction,
} from './activity-labels';
import { ActivityType } from '@/lib/db/schema';

describe('isActivityType', () => {
  it('returns true for every ActivityType enum value', () => {
    for (const v of Object.values(ActivityType)) {
      expect(isActivityType(v)).toBe(true);
    }
  });

  it('returns false for unknown strings', () => {
    expect(isActivityType('not_a_real_action')).toBe(false);
    expect(isActivityType('')).toBe(false);
  });
});

describe('ACTIVITY_LABELS', () => {
  it('has a label for every ActivityType (exhaustive)', () => {
    for (const v of Object.values(ActivityType)) {
      expect(ACTIVITY_LABELS[v]).toBeTruthy();
    }
  });

  it('labels are non-empty user-readable strings', () => {
    for (const label of Object.values(ACTIVITY_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
      // Should start with a capital Cyrillic letter (BG UI, consistency check)
      expect(label[0]).toMatch(/^[А-Я]/);
    }
  });
});

describe('formatActivityAction', () => {
  it('returns the label for known ActivityType strings', () => {
    expect(formatActivityAction(ActivityType.SIGN_IN)).toBe('Вход');
    expect(formatActivityAction(ActivityType.CREATE_INVOICE)).toBe(
      'Създадена фактура'
    );
    expect(formatActivityAction(ActivityType.FINALIZE_INVOICE)).toBe(
      'Издадена фактура'
    );
  });

  it('returns the fallback for unrecognized strings', () => {
    expect(formatActivityAction('not_a_real_action')).toBe(
      'Неизвестно действие'
    );
    expect(formatActivityAction('')).toBe('Неизвестно действие');
  });
});
