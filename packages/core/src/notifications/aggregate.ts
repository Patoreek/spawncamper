import type { PriceCheckAggregatedData } from '../price_checker/types';

/**
 * Compute the previous lowest price (AUD) across all URLs of a product.
 *
 * Looks at every result row's `previous_price_aud` — including rows where the
 * current scrape failed. Failed-scrape rows still carry the URL's historical
 * baseline, and excluding them would silently understate the reference point
 * used to decide whether the current run represents a real price drop.
 *
 * Pure function — no DB or side effects, kept in its own module so unit tests
 * don't drag in the SQLite singleton.
 */
export const previousLowestFor = (aggregated: PriceCheckAggregatedData): number | null => {
  const prevPrices = aggregated.results
    .map((r) => r.previous_price_aud)
    .filter((p): p is number => p !== null && p !== undefined);
  return prevPrices.length ? Math.min(...prevPrices) : null;
};
