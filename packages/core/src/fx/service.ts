import { db } from '../db/db';
import { FxDal } from './dal';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FRANKFURTER_BASE = 'https://api.frankfurter.app/latest';

const fxDal = new FxDal(db);

type CachedRate = { rate: number; fetchedAt: number };
const cache = new Map<string, CachedRate>();
let hydrated = false;

const hydrate = (): void => {
  if (hydrated) return;
  for (const row of fxDal.findAll()) {
    cache.set(row.currency, {
      rate: row.rate,
      fetchedAt: new Date(row.fetched_at).getTime(),
    });
  }
  hydrated = true;
};

const normalise = (currency: string | null | undefined): string | null => {
  if (!currency) return null;
  const c = currency.trim().toUpperCase();
  return c.length === 0 ? null : c;
};

const fetchRate = async (currency: string): Promise<number> => {
  const url = `${FRANKFURTER_BASE}?from=${encodeURIComponent(currency)}&to=AUD`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FX fetch failed for ${currency}: HTTP ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, number> };
  const rate = data.rates?.AUD;
  if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) {
    throw new Error(`FX response missing AUD rate for ${currency}`);
  }
  return rate;
};

/**
 * Ensure a rate to AUD is cached for the given currency. Fetches from the FX
 * provider if the cache is empty or older than MAX_AGE_MS. Falls back to a
 * stale cached rate (with a warning) if the fetch fails. Throws only when no
 * cached rate exists and the fetch fails.
 *
 * Call this from async paths (the check loop) before persisting a price.
 */
export const ensureRate = async (rawCurrency: string): Promise<number> => {
  hydrate();
  const currency = normalise(rawCurrency);
  if (!currency) throw new Error('ensureRate: empty currency');
  if (currency === 'AUD') return 1;

  const cached = cache.get(currency);
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) {
    return cached.rate;
  }

  try {
    const rate = await fetchRate(currency);
    cache.set(currency, { rate, fetchedAt: Date.now() });
    fxDal.upsert(currency, rate);
    return rate;
  } catch (err) {
    if (cached) {
      console.warn(`[fx] using stale rate for ${currency}:`, err);
      return cached.rate;
    }
    throw err;
  }
};

/**
 * Synchronously convert a native price to AUD using the in-memory cache.
 * Returns null if the price is null, the currency is missing, or no rate is
 * cached. Use this from read paths that need to aggregate across currencies.
 *
 * The contract is fail-closed: rows that can't be converted are excluded from
 * aggregation rather than silently treated as AUD.
 */
export const convertToAudOrNull = (
  price: number | null | undefined,
  rawCurrency: string | null | undefined,
): number | null => {
  if (price === null || price === undefined) return null;
  hydrate();
  const currency = normalise(rawCurrency ?? null);
  if (!currency) return null;
  if (currency === 'AUD') return price;
  const cached = cache.get(currency);
  if (!cached) return null;
  return price * cached.rate;
};
