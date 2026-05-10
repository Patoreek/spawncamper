export type ProductStatus = 'active' | 'paused' | 'archived';

export interface Product {
  id: number;
  name: string;
  target_price: number | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  name: string;
  target_price?: number | null;
  status?: ProductStatus;
}

export interface ProductUrl {
  id: number;
  product_id: number;
  url: string;
  retailer: string;
  scrape_config: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductUrlInput {
  url: string;
  retailer: string;
  scrape_config?: string | null;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: { code: string; message: string };
}
