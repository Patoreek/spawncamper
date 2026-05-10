export interface CreateProductUrl {
  product_id: number;
  url: string;
  retailer: string;
  scrape_config?: string | null;
  /** Defaults to true when omitted */
  active?: boolean;
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
