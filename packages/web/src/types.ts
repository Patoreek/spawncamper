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

// Price check types

export interface LatestPriceCheck {
  id: number;
  product_url_id: number;
  price: number;
  currency: string;
  in_stock: number; // SQLite returns 0/1
  created_at: string;
  url: string;
  retailer: string;
}

export interface PriceCheckUrlResult {
  product_url_id: number;
  url: string;
  retailer: string;
  price: number | null;
  currency: string;
  in_stock: boolean;
  title: string | null;
  source: string;
  previous_price: number | null;
}

export interface PriceCheckAggregatedData {
  productId: number;
  results: PriceCheckUrlResult[];
  lowestPrice: number | null;
  averagePrice: number | null;
  checkedAt: string;
}

export interface UrlData {
  price: number | null;
  currency: string;
  in_stock: boolean;
  title: string | null;
  source: string;
}

export interface ProductPriceSummary {
  initialPrice: number | null;
  initialRetailer: string | null;
  initialDate: string | null;
  initialCurrency: string | null;
  currentLowest: number | null;
  currentLowestRetailer: string | null;
  currentLowestCurrency: string | null;
  percentageDecrease: number | null;
}

export interface CronStatus {
  schedule: string;
  isRunning: boolean;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'error' | null;
  lastRunError: string | null;
  productsChecked: number;
  urlsChecked: number;
}
