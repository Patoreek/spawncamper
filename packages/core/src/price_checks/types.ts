export interface PriceCheck {
    id: number;
    product_url_id: number;
    price: number;
    currency: string;
    in_stock: boolean;
    created_at: string;
}

export interface PriceCheckResult {
    price: number;
    currency: string;
    in_stock: boolean;
}

export interface LatestPriceCheck extends PriceCheck {
    url: string;
    retailer: string;
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

/** One point on the per-product history chart. Joins price_checks + product_urls. */
export interface PriceHistoryPoint {
    id: number;
    product_url_id: number;
    retailer: string;
    url: string;
    /** Native price as stored. */
    price: number;
    currency: string;
    /** Converted to AUD via the FX cache; null if no rate available. */
    price_aud: number | null;
    in_stock: boolean;
    created_at: string;
}