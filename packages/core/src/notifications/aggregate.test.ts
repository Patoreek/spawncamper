import { describe, expect, it } from 'vitest';
import { previousLowestFor } from './aggregate';
import type { PriceCheckAggregatedData, PriceCheckUrlResult } from '../price_checker/types';

const result = (overrides: Partial<PriceCheckUrlResult>): PriceCheckUrlResult => ({
  product_url_id: 1,
  url: 'https://example.com',
  retailer: 'Example',
  success: true,
  price: 100,
  currency: 'AUD',
  price_aud: 100,
  in_stock: true,
  title: null,
  source: 'json-ld',
  previous_price: null,
  previous_price_aud: null,
  previous_in_stock: null,
  ...overrides,
});

const aggregated = (results: PriceCheckUrlResult[]): PriceCheckAggregatedData => ({
  productId: 1,
  results,
  lowestPrice: null,
  averagePrice: null,
  currentlyInStock: null,
  previouslyInStock: null,
  checkedAt: '2026-05-11T00:00:00Z',
});

describe('previousLowestFor', () => {
  it('returns null when no row has a previous price', () => {
    expect(
      previousLowestFor(aggregated([result({ previous_price_aud: null }), result({ product_url_id: 2, previous_price_aud: null })])),
    ).toBeNull();
  });

  it('returns the minimum previous price across all URLs', () => {
    expect(
      previousLowestFor(
        aggregated([
          result({ product_url_id: 1, previous_price_aud: 90 }),
          result({ product_url_id: 2, previous_price_aud: 80 }),
          result({ product_url_id: 3, previous_price_aud: 100 }),
        ]),
      ),
    ).toBe(80);
  });

  // ── Regression: scraper-failure baseline bug ────────────────
  // Before the fix, URLs that failed to scrape this run were dropped from
  // `aggregated.results` entirely. If the lowest historical URL failed,
  // its previous price was excluded from `previousLowest`, silently
  // inflating the baseline and biasing `any_drop` toward false alerts.
  // The fix surfaces failed URLs as `success: false` rows that still carry
  // their `previous_price_aud`, so the baseline stays correct.
  it('includes failed-scrape URLs in the baseline (regression test)', () => {
    const failedLowestUrl = result({
      product_url_id: 1,
      success: false,
      price: null,
      price_aud: null,
      source: 'failed',
      previous_price_aud: 80,
    });
    const successfulUrl = result({
      product_url_id: 2,
      previous_price_aud: 100,
    });

    expect(previousLowestFor(aggregated([failedLowestUrl, successfulUrl]))).toBe(80);
  });

  it('returns the only previous price when other rows have no history', () => {
    expect(
      previousLowestFor(
        aggregated([
          result({ product_url_id: 1, previous_price_aud: 75 }),
          result({ product_url_id: 2, previous_price_aud: null }),
        ]),
      ),
    ).toBe(75);
  });
});
