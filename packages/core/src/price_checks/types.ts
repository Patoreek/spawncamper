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