export interface UrlData {
    price: number | null;
    currency: string;
    in_stock: boolean;
    title: string | null;
    source: 'json-ld' | 'meta' | 'selector' | 'playwright' | 'amazon-paapi' | 'proxy';
}

export interface PriceCheckAggregatedData {
    productId: number;
    results: UrlData[];
    lowestPrice: number | null;
    averagePrice: number | null;
    checkedAt: string;
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
