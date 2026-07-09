import 'server-only';
import { cacheLife } from 'next/cache';
import { logger } from '@/lib/logger';
import {
  EUR_BGN_FIXED,
  type EurRates,
  rateToBase as pureRateToBase,
  convert as pureConvert,
} from './convert';

// GEN-1 — live EUR reference rates (units of each currency per 1 EUR).
//
// Source: ECB daily reference rates (the source approved in D-FX). BGN is NOT
// taken from ECB — it is forced to the fixed euro-adoption rate. Cached for a
// day; on any fetch/parse failure we fall back to the last snapshot below so a
// page never crashes over FX.

const ECB_DAILY_URL =
  'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

// Fallback snapshot (units per EUR) used only when the ECB fetch fails. EUR=1
// and BGN=fixed are always injected regardless of this table. Refresh
// occasionally; it only matters as a degraded-mode safety net.
const FALLBACK_RATES: EurRates = {
  USD: 1.08,
  GBP: 0.84,
  CHF: 0.95,
  BGN: EUR_BGN_FIXED,
};

function parseEcbXml(xml: string): EurRates {
  const rates: EurRates = {};
  const re = /currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const code = m[1];
    const rate = Number(m[2]);
    if (code && Number.isFinite(rate) && rate > 0) rates[code] = rate;
  }
  return rates;
}

/**
 * Current EUR reference rates (units per 1 EUR), cached daily. EUR is implicit
 * (=1); BGN is always the fixed euro-adoption rate. Never throws — degrades to
 * the fallback snapshot if ECB is unreachable.
 */
export async function getEurRates(): Promise<EurRates> {
  'use cache';
  cacheLife('days');

  try {
    const res = await fetch(ECB_DAILY_URL, {
      headers: { accept: 'application/xml' },
    });
    if (!res.ok) throw new Error(`ECB responded ${res.status}`);
    const xml = await res.text();
    const parsed = parseEcbXml(xml);
    // Must have at least one real rate; otherwise treat as a failed parse.
    if (Object.keys(parsed).length === 0) throw new Error('empty ECB parse');
    return { ...parsed, EUR: 1, BGN: EUR_BGN_FIXED };
  } catch (err) {
    logger.warn('FX: ECB fetch failed, using fallback snapshot', { err });
    return { ...FALLBACK_RATES, EUR: 1, BGN: EUR_BGN_FIXED };
  }
}

/**
 * Frozen multiplier `amount_base = amount_doc × fxRate` for a document created
 * now. Used to stamp `fxRate` at finalize (A2).
 */
export async function getRateToBase(
  docCurrency: string,
  baseCurrency: string
): Promise<number> {
  if (docCurrency === baseCurrency) return 1;
  const rates = await getEurRates();
  return pureRateToBase(docCurrency, baseCurrency, rates);
}

/** Convert an amount from one currency to another using live rates. */
export async function convertAmount(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  if (from === to) return amount;
  const rates = await getEurRates();
  return pureConvert(amount, from, to, rates);
}
