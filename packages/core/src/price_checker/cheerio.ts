import * as cheerio from 'cheerio';
import { parsePrice, parseAvailability } from './types';
import type { UrlData } from './types';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
};

export async function extractWithCheerio(url: string): Promise<UrlData | null> {
    try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) return null;

        const html = await res.text();
        const $ = cheerio.load(html);

        return extractFromJsonLd($)
            ?? extractFromMeta($)
            ?? extractFromSelectors($, url);
    } catch {
        return null;
    }
}

// ── Strategies ──────────────────────────────────────────

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
                source: 'json-ld',
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
        source: 'meta',
    };
}

function extractFromSelectors($: cheerio.CheerioAPI, url?: string): UrlData | null {
    const priceSelectors = [
        '[data-price]',
        '.price-current',
        '.product-price',
        '.price__current',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price .a-offscreen',
        '.price .now',
        '.sale-price',
        '.current-price',
        '[itemprop="price"]',
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
            currency: detectCurrency($, raw, url),
            in_stock: true,
            title,
            source: 'selector',
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

    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) {
        return obj;
    }

    if (Array.isArray(obj['@graph'])) {
        return findProductInJsonLd(obj['@graph']);
    }
    return null;
}

function extractOffer(product: Record<string, unknown>): Record<string, string> | null {
    const offers = product.offers;
    if (!offers || typeof offers !== 'object') return null;

    const offer = Array.isArray(offers)
        ? offers[0] as Record<string, unknown>
        : offers as Record<string, unknown>;
    if (!offer) return null;

    // Direct price — most common
    if (offer.price || offer.lowPrice) {
        return offer as Record<string, string>;
    }

    // priceSpecification — used by some retailers (e.g. Rebel Sport)
    // Pick the current price (skip StrikethroughPrice / ListPrice)
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

function detectCurrency($: cheerio.CheerioAPI, priceText: string, url?: string): string {
    const metaCurrency = $('meta[itemprop="priceCurrency"]').attr('content');
    if (metaCurrency) return metaCurrency;

    if (priceText.includes('£')) return 'GBP';
    if (priceText.includes('€')) return 'EUR';
    if (priceText.includes('A$') || priceText.includes('AU$')) return 'AUD';
    if (priceText.includes('C$') || priceText.includes('CA$')) return 'CAD';
    if (priceText.includes('¥')) return 'JPY';
    if (priceText.includes('₹')) return 'INR';

    // Fallback: infer from domain
    if (url) {
        try {
            const host = new URL(url).hostname;
            if (host.endsWith('.com.au') || host.endsWith('.au')) return 'AUD';
            if (host.endsWith('.co.uk')) return 'GBP';
            if (host.endsWith('.ca')) return 'CAD';
            if (host.endsWith('.de') || host.endsWith('.fr') || host.endsWith('.it') || host.endsWith('.es')) return 'EUR';
            if (host.endsWith('.co.jp')) return 'JPY';
        } catch {}
    }
    return 'USD';
}
