import * as cheerio from 'cheerio';
import { parsePrice, parseAvailability } from './types';
import type { UrlData } from './types';

/**
 * Fetches a URL through ScraperAPI (renders JS, rotates IPs, bypasses WAFs)
 * then extracts price data with cheerio.
 *
 * Requires SCRAPER_API_KEY env var.
 * Sign up: https://www.scraperapi.com (free tier: 5,000 requests/month)
 */
export async function extractWithProxy(url: string): Promise<UrlData | null> {
    const apiKey = process.env.SCRAPER_API_KEY;
    if (!apiKey) {
        console.warn('[proxy] Missing SCRAPER_API_KEY env var');
        return null;
    }

    try {
        const proxyUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;

        const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) {
            console.warn(`[proxy] ScraperAPI returned ${res.status} for ${url}`);
            return null;
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        return extractFromJsonLd($)
            ?? extractFromMeta($)
            ?? extractFromSelectors($);
    } catch (err) {
        console.warn('[proxy] Request failed:', err);
        return null;
    }
}

// ── Extraction (same logic as cheerio.ts) ───────────────

function extractFromJsonLd($: cheerio.CheerioAPI): UrlData | null {
    const scripts = $('script[type="application/ld+json"]');
    for (const el of scripts) {
        try {
            const data = JSON.parse($(el).html() ?? '');
            const product = findProductInJsonLd(data);
            if (!product) continue;

            const offer = extractOffer(product);
            if (!offer) continue;

            return {
                price: parsePrice(offer.price ?? offer.lowPrice),
                currency: offer.priceCurrency ?? 'USD',
                in_stock: parseAvailability(offer.availability),
                title: (product.name as string) ?? null,
                source: 'proxy',
            };
        } catch {
            continue;
        }
    }
    return null;
}

function extractFromMeta($: cheerio.CheerioAPI): UrlData | null {
    const price = $('meta[property="product:price:amount"]').attr('content')
        ?? $('meta[property="og:price:amount"]').attr('content');
    if (!price) return null;

    const currency = $('meta[property="product:price:currency"]').attr('content')
        ?? $('meta[property="og:price:currency"]').attr('content')
        ?? 'USD';

    const availability = $('meta[property="product:availability"]').attr('content') ?? '';
    const title = $('meta[property="og:title"]').attr('content') ?? null;

    return {
        price: parsePrice(price),
        currency,
        in_stock: parseAvailability(availability),
        title,
        source: 'proxy',
    };
}

function extractFromSelectors($: cheerio.CheerioAPI): UrlData | null {
    const priceSelectors = [
        '[data-price]',
        '.price-current',
        '.product-price',
        '.price__current',
        '.a-price .a-offscreen',
        '#corePrice_feature_div .a-offscreen',
        '.priceView-customer-price span[aria-hidden="true"]',
        '[data-test="product-price"]',
        '[itemprop="price"]',
        '[data-automation="buybox-price"]',
        '.x-price-primary span',
        '.price .now',
        '.sale-price',
        '.current-price',
        '.pdp-price',
        '.product-info-price .price',
    ];

    for (const sel of priceSelectors) {
        const el = $(sel).first();
        if (!el.length) continue;

        const raw = el.attr('data-price') ?? el.attr('content') ?? el.text();
        const price = parsePrice(raw);
        if (price === null) continue;

        const title = $('h1').first().text().trim() || $('title').text().trim() || null;

        return {
            price,
            currency: detectCurrency($, raw),
            in_stock: true,
            title,
            source: 'proxy',
        };
    }
    return null;
}

// ── Helpers ─────────────────────────────────────────────

function findProductInJsonLd(data: unknown): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;
    if (Array.isArray(data)) {
        for (const item of data) {
            const found = findProductInJsonLd(item);
            if (found) return found;
        }
        return null;
    }
    const obj = data as Record<string, unknown>;
    const type = obj['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return obj;
    if (Array.isArray(obj['@graph'])) return findProductInJsonLd(obj['@graph']);
    return null;
}

function extractOffer(product: Record<string, unknown>): Record<string, string> | null {
    const offers = product.offers;
    if (!offers || typeof offers !== 'object') return null;

    const offer = Array.isArray(offers)
        ? offers[0] as Record<string, unknown>
        : offers as Record<string, unknown>;
    if (!offer) return null;

    if (offer.price || offer.lowPrice) return offer as Record<string, string>;

    // priceSpecification (Rebel Sport, Big W, etc.)
    const specs = offer.priceSpecification;
    if (Array.isArray(specs)) {
        const current = specs.find((s: Record<string, string>) => {
            const type = s.priceType ?? '';
            return !type.includes('Strikethrough') && !type.includes('List');
        }) ?? specs[specs.length - 1];
        if (current) {
            return {
                price: current.price,
                priceCurrency: current.priceCurrency ?? (offer.priceCurrency as string) ?? 'USD',
                availability: offer.availability as string ?? '',
            };
        }
    }

    return offer as Record<string, string>;
}

function detectCurrency($: cheerio.CheerioAPI, priceText: string): string {
    const metaCurrency = $('meta[itemprop="priceCurrency"]').attr('content');
    if (metaCurrency) return metaCurrency;
    if (priceText.includes('£')) return 'GBP';
    if (priceText.includes('€')) return 'EUR';
    if (priceText.includes('A$') || priceText.includes('AU$')) return 'AUD';
    if (priceText.includes('C$') || priceText.includes('CA$')) return 'CAD';
    if (priceText.includes('¥')) return 'JPY';
    if (priceText.includes('₹')) return 'INR';
    return 'USD';
}
