import { db } from '../db/db';
import { CategoryDAL } from './dal';
import type { Category } from './types';

const categoryDAL = new CategoryDAL(db);

export const getAllCategories = (): Category[] => {
  return categoryDAL.findAll();
};

export const createCategory = (name: string): Category => {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name cannot be empty');

  const existing = categoryDAL.findByName(trimmed);
  if (existing) return existing;

  return categoryDAL.create(trimmed);
};
