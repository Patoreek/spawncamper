export interface CreateProductUrl {
  url: string;
  retailer?: number | null;
  scrape_config?: string;
}

export interface ProductUrl {
    id: number;
    product_id: number;
    url: string;
    retailer?: string;
    scrape_config: string;
    active: boolean;
    created_at: string;
    updated_at: string;
}