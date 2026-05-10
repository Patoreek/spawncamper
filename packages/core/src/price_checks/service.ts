import { db } from '../db/db';
import { PriceCheckDAL } from './dal';
import type { PriceCheck, PriceCheckResult } from './types';

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
