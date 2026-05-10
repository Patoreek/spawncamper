import { db } from '../db/db';
import { ProductUrlDAL } from './dal';
import type { CreateProductUrl, ProductUrl } from './types';

const productDAL = new ProductUrlDAL(db);

export const createProduct = (input: CreateProductUrl): ProductUrl => {
  return productDAL.create(input);
};

export const pauseProduct = async (id: number) => {
  return productDAL.pauseProduct(id);
};