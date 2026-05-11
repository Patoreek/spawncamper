/**
 * A single row in the daily/weekly digest — one active product distilled to
 * the few numbers that matter at a glance. All prices are in AUD.
 *
 * `currentLowest` is null when no URL has produced a usable price yet (new
 * product, or every URL has only ever failed to scrape). The formatter
 * surfaces these distinctly from "we have a price and it's just zero".
 */
export interface DigestRow {
    productId: number;
    name: string;
    /** Lowest current price across the product's URLs, in AUD. */
    currentLowest: number | null;
    /** Retailer at the lowest current price. null when currentLowest is null. */
    currentLowestRetailer: string | null;
    /** First-ever price logged for this product, in AUD. */
    initialPrice: number | null;
    /**
     * Percentage decrease from initialPrice to currentLowest. Positive = drop,
     * negative = price went up. null when either anchor is missing.
     */
    percentageDecrease: number | null;
    /** True if any URL of this product is currently in stock. null = no data. */
    anyInStock: boolean | null;
    /** How many URLs are attached to this product (active or not). */
    urlCount: number;
}

export interface DigestPayload {
    /** ISO timestamp when the digest was assembled. */
    generatedAt: string;
    rows: DigestRow[];
}

export interface DigestSendResult {
    sent: boolean;
    /** Rendered Markdown — included even on dry-run / send failures. */
    text: string;
    rowCount: number;
    /** Set when sent=false. */
    skippedReason?:
        | 'messenger_not_configured'
        | 'send_failed'
        | 'no_active_products'
        | 'dry_run';
}
