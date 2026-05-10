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