import { db } from '../db/db';
import { ProductDAL } from './dal';
import type { CreateProductInput, Product } from './types';

const productDAL = new ProductDAL(db);

export const createProduct = (input: CreateProductInput): Product => {
  return productDAL.create(input);
};

export const pauseProduct = async (id: number) => {
  return productDAL.pauseProduct(id);
};

export const activateProduct = async (id: string) => {
  // return productDAL.activateProduct(id);
};

const archiveProduct = async (id: string) => {
  const result = 0;
  return result;
};

const deleteProduct = async (id: string) => {
  const result = 0;
  return result;
};

export const getAllProducts = (status: string | null = null): Product[] => {
  return productDAL.findAll(status);
};
