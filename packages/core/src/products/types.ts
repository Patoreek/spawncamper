export interface Product {
    id: number;
    name: string;
    target_price: number;
    status: string;
    created_at?: string;
    updated_at?: string;
}

export const mockProduct = {
    id: 1,
    name: "Test",
    target_price: 12.50,
    status: "active"
}