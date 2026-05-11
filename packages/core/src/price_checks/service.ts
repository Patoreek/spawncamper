import { db } from '../db/db';
import { convertToAudOrNull } from '../fx/service';
import { PriceCheckDAL } from './dal';
import type { PriceCheck, PriceCheckResult, LatestPriceCheck, ProductPriceSummary, PriceHistoryPoint } from './types';

const priceCheckDAL = new PriceCheckDAL(db);

export const createPriceCheck = (input: PriceCheckResult & { product_url_id: number }): PriceCheck => {
  return priceCheckDAL.create(input);
};

export const getPreviousPriceCheck = (productUrlId: number): PriceCheck | null => {
  return priceCheckDAL.findPrevious(productUrlId);
};

export const getAllPreviousPriceChecks = (productUrlId: number): PriceCheck[] => {
  return priceCheckDAL.findAllPrevious(productUrlId);
};

export const getLatestPriceChecksForProduct = (productId: number): LatestPriceCheck[] => {
  return priceCheckDAL.findLatestForProduct(productId);
};

/**
 * Full price history across all URLs of a product, ordered by URL then time.
 * Each row carries both native price and AUD-converted price so the UI can
 * plot one chart in AUD while still showing native values in tooltips.
 */
export const getProductPriceHistory = (productId: number): PriceHistoryPoint[] => {
  const rows = priceCheckDAL.findHistoryForProduct(productId);
  return rows.map((r) => ({
    id: r.id,
    product_url_id: r.product_url_id,
    retailer: r.retailer,
    url: r.url,
    price: r.price,
    currency: r.currency,
    price_aud: convertToAudOrNull(r.price, r.currency),
    in_stock: !!r.in_stock,
    created_at: r.created_at,
  }));
};

/**
 * Returns the product's initial and current-lowest price normalised to AUD.
 * Rows whose currency can't be converted (no cached FX rate) are excluded
 * from the lowest-price calculation rather than silently treated as AUD.
 */
export const getProductPriceSummary = (productId: number): ProductPriceSummary => {
  const first = priceCheckDAL.findFirstForProduct(productId);
  const latest = priceCheckDAL.findLatestForProduct(productId);

  const initialPriceAud = first ? convertToAudOrNull(first.price, first.currency) : null;

  // Pick the row with the lowest AUD-converted price. Rows without a usable
  // rate are dropped (fail-closed).
  let currentLowest: LatestPriceCheck | null = null;
  let currentLowestAud: number | null = null;
  for (const pc of latest) {
    const aud = convertToAudOrNull(pc.price, pc.currency);
    if (aud === null) continue;
    if (currentLowestAud === null || aud < currentLowestAud) {
      currentLowestAud = aud;
      currentLowest = pc;
    }
  }

  let percentageDecrease: number | null = null;
  if (initialPriceAud !== null && currentLowestAud !== null && initialPriceAud > 0) {
    percentageDecrease = Math.round(((initialPriceAud - currentLowestAud) / initialPriceAud) * 10000) / 100;
  }

  return {
    initialPrice: initialPriceAud,
    initialRetailer: first?.retailer ?? null,
    initialDate: first?.created_at ?? null,
    initialCurrency: first?.currency ?? null,
    currentLowest: currentLowestAud,
    currentLowestRetailer: currentLowest?.retailer ?? null,
    currentLowestCurrency: currentLowest?.currency ?? null,
    percentageDecrease,
  };
};
