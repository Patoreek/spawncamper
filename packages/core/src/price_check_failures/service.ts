import { db } from '../db/db';
import { ScrapeFailuresDal } from './dal';
import type { ScrapeFailure, ScrapeFailureReason, UrlFailureSummary } from './types';

const failuresDal = new ScrapeFailuresDal(db);

/**
 * Record that an extraction attempt for a product URL failed. The price
 * checker calls this whenever `getDataFromUrl` returns null, so silent
 * scraper rot becomes a visible, queryable signal.
 *
 * Errors here are swallowed: a logging failure must never prevent the rest
 * of the check loop from continuing.
 */
export const recordScrapeFailure = (
  productUrlId: number,
  reason: ScrapeFailureReason,
  message: string | null = null,
): void => {
  try {
    failuresDal.create(productUrlId, reason, message);
  } catch (err) {
    console.error('[scrape_failures] failed to persist:', err);
  }
};

/** N most recent failures for a URL, newest first. */
export const getRecentFailuresForUrl = (productUrlId: number, limit = 20): ScrapeFailure[] => {
  return failuresDal.findRecentForUrl(productUrlId, limit);
};

/** Quick summary for the UI: last-failure timestamp + 24h count. */
export const getFailureSummaryForUrl = (productUrlId: number): UrlFailureSummary => {
  return failuresDal.summaryForUrl(productUrlId);
};

/** One summary row per URL of the product (URLs with no failures included). */
export const getFailureSummariesForProduct = (productId: number): UrlFailureSummary[] => {
  return failuresDal.summariesForProduct(productId);
};
