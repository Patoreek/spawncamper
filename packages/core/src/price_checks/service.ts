import { db } from '../db/db';
import { PriceCheckDAL } from './dal';
import type { PriceCheck, PriceCheckResult, LatestPriceCheck, ProductPriceSummary } from './types';

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

export const getProductPriceSummary = (productId: number): ProductPriceSummary => {
  const first = priceCheckDAL.findFirstForProduct(productId);
  const latest = priceCheckDAL.findLatestForProduct(productId);

  const currentLowest = latest.length > 0
    ? latest.reduce((min, pc) => pc.price < min.price ? pc : min, latest[0])
    : null;

  let percentageDecrease: number | null = null;
  if (first && currentLowest && first.price > 0) {
    percentageDecrease = Math.round(((first.price - currentLowest.price) / first.price) * 10000) / 100;
  }

  return {
    initialPrice: first?.price ?? null,
    initialRetailer: first?.retailer ?? null,
    initialDate: first?.created_at ?? null,
    initialCurrency: first?.currency ?? null,
    currentLowest: currentLowest?.price ?? null,
    currentLowestRetailer: currentLowest?.retailer ?? null,
    currentLowestCurrency: currentLowest?.currency ?? null,
    percentageDecrease,
  };
};
