
import { Product, mockProduct } from "./types";


const createProduct = async (product: Product): Promise<Product> => {
  const result = mockProduct;

  return result;
}

const pauseProduct = async (id: string) => {
  const result = 0;
  return result;
}

const archiveProduct = async (id: string) => {
  const result = 0;
  return result;
}

const deleteProduct = async (id: string) => {
  const result = 0;
  return result;
}

const getActiveProducts = async (): Promise<string[]> => {
  return [];
} 
