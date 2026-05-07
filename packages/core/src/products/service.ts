import { db } from '../db/db';
import { ProductDAL } from './dal';
import type { CreateProductInput, Product } from './types';

const productDAL = new ProductDAL(db);

export const createProduct = (input: CreateProductInput): Product => {
  return productDAL.create(input);
};

const pauseProduct = async (id: string) => {
  const result = 0;
  return result;
};

const archiveProduct = async (id: string) => {
  const result = 0;
  return result;
};

const deleteProduct = async (id: string) => {
  const result = 0;
  return result;
};

const getActiveProducts = async (): Promise<string[]> => {
  return [];
};
