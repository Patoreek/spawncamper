import { db } from '../db/db';
import { ProductUrlDAL } from './dal';
import type { ApiResponse } from '../db/types';
import type { CreateProductUrl, ProductUrl } from './types';

const productUrlDAL = new ProductUrlDAL(db);

export const createProductUrl = (input: CreateProductUrl): ProductUrl => {
  return productUrlDAL.create(input);
};

export const getProductUrlById = (id: number): ProductUrl | null => {
  return productUrlDAL.findById(id);
};

export const getProductUrlsForProduct = (productId: number): ProductUrl[] => {
  return productUrlDAL.findByProductId(productId);
};

/** `null` = all URLs; boolean filters by active flag */
export const getAllProductUrls = (active: boolean | null = null): ProductUrl[] => {
  return productUrlDAL.findAll(active);
};

export const pauseProductUrl = (id: number): ApiResponse => {
  return productUrlDAL.pauseProductUrl(id);
};

export const deleteProductUrl = (id: number): ApiResponse => {
  return productUrlDAL.deleteProductUrl(id);
};
