export type ProductStatus = 'active' | 'paused' | 'archived';

export type NotifyKind =
  | 'any_drop'
  | 'target_price'
  | 'percent_below_initial'
  | 'absolute_below';

export interface NotifyRuleInput {
  enabled: boolean;
  kind: NotifyKind | null;
  value: number | null;
}

export interface CreateProductInput {
  name: string;
  target_price?: number | null;
  status?: ProductStatus;
}

export interface Product {
  id: number;
  name: string;
  target_price: number | null;
  status: ProductStatus;
  notify_enabled: 0 | 1;
  notify_kind: NotifyKind | null;
  notify_value: number | null;
  created_at: string;
  updated_at: string;
}

export const mockNewProduct:CreateProductInput = {
    name: "Test",
    target_price: 12.50,
    status: "active"
}
export const mockProduct:Product = {
    id: 1,
    name: "Test",
    target_price: 12.50,
    status: "active",
    notify_enabled: 0,
    notify_kind: null,
    notify_value: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01'
}
