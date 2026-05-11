import { db } from '../db/db';
import { ProductDAL } from './dal';
import type { CreateProductInput, NotifyKind, NotifyRuleInput, Product } from './types';

const productDAL = new ProductDAL(db);

const VALID_NOTIFY_KINDS: NotifyKind[] = [
  'any_drop',
  'target_price',
  'percent_below_initial',
  'absolute_below',
];

export const createProduct = (input: CreateProductInput): Product => {
  return productDAL.create(input);
};

export const getProductById = (id: number): Product | null => {
  return productDAL.findById(id);
};

export const updateNotifyRule = (id: number, rule: NotifyRuleInput): Product | null => {
  // Service-layer validation since CHECK constraint can't be added via ALTER.
  if (rule.enabled) {
    if (!rule.kind || !VALID_NOTIFY_KINDS.includes(rule.kind)) {
      throw new Error(`Invalid notify_kind: ${rule.kind}`);
    }
    if (rule.kind !== 'any_drop' && rule.kind !== 'target_price') {
      if (rule.value === null || rule.value === undefined || !isFinite(rule.value) || rule.value <= 0) {
        throw new Error(`notify_value must be a positive number for kind ${rule.kind}`);
      }
    }
  }
  return productDAL.updateNotifyRule(id, rule);
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
