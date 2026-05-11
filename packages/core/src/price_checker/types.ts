export interface UrlData {
    price: number | null;
    currency: string;
    in_stock: boolean;
    title: string | null;
    source: 'json-ld' | 'meta' | 'selector' | 'playwright' | 'amazon-paapi' | 'proxy';
}

export interface PriceCheckUrlResult {
    product_url_id: number;
    url: string;
    retailer: string;
    /**
     * True if the scrape returned usable data this run. False rows are surfaced
     * so the aggregator sees every URL's historical baseline even on failure
     * (otherwise `previousLowest` would silently exclude the URL).
     */
    success: boolean;
    /** Native price as extracted from the retailer. */
    price: number | null;
    /** ISO 4217 code of the native price. */
    currency: string;
    /** Native price converted to AUD via the FX cache. null if no rate available. */
    price_aud: number | null;
    in_stock: boolean;
    title: string | null;
    source: UrlData['source'] | 'failed';
    /** Previous native price for this URL. */
    previous_price: number | null;
    /** Previous price converted to AUD via the FX cache. null if no rate or no previous. */
    previous_price_aud: number | null;
    /** In-stock state from the previous check for this URL. null if no previous. */
    previous_in_stock: boolean | null;
}

export interface PriceCheckAggregatedData {
    productId: number;
    results: PriceCheckUrlResult[];
    /** Lowest price across URLs, in AUD. */
    lowestPrice: number | null;
    /** Average price across URLs, in AUD. */
    averagePrice: number | null;
    /** True if any URL is currently in stock. null if no URLs returned any data. */
    currentlyInStock: boolean | null;
    /** True if any URL was previously in stock. null if there is no previous data at all. */
    previouslyInStock: boolean | null;
    checkedAt: string;
}

export interface CheckAllResult {
    startedAt: string;
    completedAt: string;
    productsChecked: number;
    urlsChecked: number;
    results: PriceCheckAggregatedData[];
}

// ── Shared helpers ──────────────────────────────────────

export function parsePrice(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    const str = String(raw).replace(/[^0-9.,]/g, '');
    let normalized = str;
    if (str.includes(',') && str.includes('.')) {
        normalized = str.replace(/,/g, '');
    } else if (str.includes(',') && str.indexOf(',') > str.length - 4) {
        normalized = str.replace(',', '.');
    } else {
        normalized = str.replace(/,/g, '');
    }
    const num = parseFloat(normalized);
    return isNaN(num) || num <= 0 ? null : num;
}

export function parseAvailability(value: unknown): boolean {
    if (!value) return true;
    const str = String(value).toLowerCase();
    return !str.includes('outofstock') && !str.includes('out_of_stock') && !str.includes('soldout');
}

/**
 * Domains that require a headless browser (JS-rendered prices, bot detection).
 * Matched against the hostname of the URL.
 */
/**
 * Sites with aggressive WAF/CDN protection (Akamai, PerimeterX, DataDome).
 * Routed through ScraperAPI proxy which handles TLS fingerprinting and IP rotation.
 */
export const PROXY_DOMAINS = [
    'bigw.com.au',
    'ebay',
    'bestbuy',
    'walmart',
    'costco',
];

/**
 * Sites that need a headless browser for JS-rendered prices
 * but don't have aggressive bot detection.
 */
export const PLAYWRIGHT_DOMAINS = [
    'target.com',
    'target.com.au',
    'officeworks.com.au',
    'scorptec.com.au',
    'mwave.com.au',
];

export function needsProxy(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return PROXY_DOMAINS.some((d) => hostname.includes(d));
    } catch {
        return false;
    }
}

export function needsPlaywright(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return PLAYWRIGHT_DOMAINS.some((d) => hostname.includes(d));
    } catch {
        return false;
    }
}
