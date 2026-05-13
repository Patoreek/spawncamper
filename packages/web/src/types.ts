export type ProductStatus = 'active' | 'paused' | 'archived';

export type NotifyKind =
  | 'any_drop'
  | 'target_price'
  | 'percent_below_initial'
  | 'absolute_below'
  | 'back_in_stock'
  | 'out_of_stock';

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
  category_id: number | null;
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
  category_id?: number | null;
}

export interface Category {
  id: number;
  name: string;
  created_at: string;
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
  /** Whether the scrape succeeded this run. False entries surface failed URLs for aggregation. */
  success: boolean;
  /** Native price as extracted from the retailer. */
  price: number | null;
  /** ISO 4217 code of the native price. */
  currency: string;
  /** Native price converted to AUD, or null if no rate available. */
  price_aud: number | null;
  in_stock: boolean;
  title: string | null;
  source: string;
  /** Previous native price for this URL. */
  previous_price: number | null;
  /** Previous AUD-converted price for this URL. */
  previous_price_aud: number | null;
  /** Previous in-stock state for this URL; null when there's no previous data. */
  previous_in_stock: boolean | null;
}

export interface PriceCheckAggregatedData {
  productId: number;
  results: PriceCheckUrlResult[];
  /** Lowest price across URLs, in AUD. */
  lowestPrice: number | null;
  /** Average price across URLs, in AUD. */
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

/** One point on the per-product history chart (native + AUD-converted). */
export interface PriceHistoryPoint {
  id: number;
  product_url_id: number;
  retailer: string;
  url: string;
  price: number;
  currency: string;
  /** Native price converted to AUD; null if the FX cache has no rate for `currency`. */
  price_aud: number | null;
  in_stock: boolean;
  created_at: string;
}

export interface ProductPriceSummary {
  /** Initial price in AUD. */
  initialPrice: number | null;
  initialRetailer: string | null;
  initialDate: string | null;
  /** Native currency of the initial price (for display context). */
  initialCurrency: string | null;
  /** Current lowest price in AUD. */
  currentLowest: number | null;
  currentLowestRetailer: string | null;
  /** Native currency of the current-lowest URL (for display context). */
  currentLowestCurrency: string | null;
  percentageDecrease: number | null;
}

export interface UrlFailureSummary {
  product_url_id: number;
  /** ISO timestamp of most recent failure, or null if the URL has never failed. */
  last_failure_at: string | null;
  failures_last_24h: number;
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
