export type ProductStatus = 'active' | 'paused' | 'archived';

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
    created_at: '2026-01-01',
    updated_at: '2026-01-01'
}