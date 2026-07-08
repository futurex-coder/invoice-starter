// GEN-1 — currency conversion to the company base currency.
//
// Canonical rate direction (used everywhere, incl. the stored `fxRate` column):
//   amount_base = amount_doc × fxRate,  where fxRate = value of 1 unit of the
//   document's currency expressed in the base currency.
//
// This module is PURE (no I/O) so the math is unit-tested in isolation. The
// live ECB rates + caching + fallback live in `./rates` (server-only).

/**
 * Bulgaria's euro adoption fixes the lev↔euro rate by law: **1 EUR = 1.95583
 * BGN**, irrevocably. This is NOT an ECB market rate — always use it for any
 * BGN↔EUR conversion (and for the legally-required dual BGN/EUR display).
 */
export const EUR_BGN_FIXED = 1.95583;

/**
 * ECB-style reference rates: **units of each currency per 1 EUR** (EUR itself
 * is the base, = 1). e.g. `{ USD: 1.0821, BGN: 1.95583 }`.
 */
export type EurRates = Record<string, number>;

/** Raised when a currency has no known rate (and isn't EUR/BGN). */
export class FxRateUnavailableError extends Error {
  constructor(readonly currency: string) {
    super(`No FX rate available for currency "${currency}"`);
    this.name = 'FxRateUnavailableError';
  }
}

/**
 * Units of `currency` per 1 EUR. EUR → 1; BGN → the fixed euro-adoption rate
 * (never the ECB value); everything else comes from `rates`.
 */
export function unitsPerEur(currency: string, rates: EurRates): number {
  if (currency === 'EUR') return 1;
  if (currency === 'BGN') return EUR_BGN_FIXED;
  const r = rates[currency];
  if (r == null || !Number.isFinite(r) || r <= 0) {
    throw new FxRateUnavailableError(currency);
  }
  return r;
}

/** Convert `amount` from one currency to another via the EUR cross-rate. */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates: EurRates
): number {
  if (from === to) return amount;
  const amountInEur = amount / unitsPerEur(from, rates);
  return amountInEur * unitsPerEur(to, rates);
}

/**
 * The frozen multiplier stored on a document: the value of 1 unit of `from`
 * expressed in `to`, so that `amount_base = amount_doc × fxRate`. Rounded to
 * 6 dp to match the `fxRate numeric(15,6)` column.
 */
export function rateToBase(from: string, to: string, rates: EurRates): number {
  return roundTo(convert(1, from, to, rates), 6);
}

/** Round half-up to `dp` decimal places (avoids float drift in money math). */
export function roundTo(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round((value + Number.EPSILON) * f) / f;
}
