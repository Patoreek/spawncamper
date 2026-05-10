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

export const activateProduct = async (id: number) => {
  return productDAL.activateProduct(id);
};

export const archiveProduct = async (id: number) => {
  return productDAL.archiveProduct(id);
};

export const deleteProduct = async (id: number) => {
  return productDAL.deleteProduct(id);
};

export const getAllProducts = (status: string | null = null): Product[] => {
  return productDAL.findAll(status);
};
