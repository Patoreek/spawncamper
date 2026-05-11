import { chromium } from 'playwright';
import { extractFail, extractOk, parsePrice, parseAvailability } from './types';
import type { ExtractResult, UrlData } from './types';

const STEALTH_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-sandbox',
];

export async function extractWithPlaywright(url: string): Promise<ExtractResult> {
    // Headless first; if blocked at navigation level, retry headed once. The
    // internal headed retry only kicks in for retryable navigation failures
    // — non-retryable outcomes (e.g. no_price_found) short-circuit.
    const headless = await attempt(url, true);
    if (headless.ok) return headless;
    if (!headless.retryable) return headless;
    return attempt(url, false);
}

async function attempt(url: string, headless: boolean): Promise<ExtractResult> {
    let browser;
    try {
        browser = await chromium.launch({
            channel: 'chrome',
            headless,
            args: STEALTH_ARGS,
        });
    } catch {
        try {
            browser = await chromium.launch({ headless, args: STEALTH_ARGS });
        } catch (err) {
            return extractFail('network_error', true, `playwright launch failed: ${err instanceof Error ? err.message : err}`);
        }
    }

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
            locale: 'en-US',
            viewport: { width: 1920, height: 1080 },
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            (window as unknown as Record<string, unknown>).chrome = { runtime: {} };
        });

        const page = await context.newPage();
        let resp;
        try {
            resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        } catch (err) {
            return extractFail('network_error', true, err instanceof Error ? err.message : 'page.goto failed');
        }

        if (!resp) {
            return extractFail('network_error', true, 'no response from page.goto');
        }
        const status = resp.status();
        if (status >= 400) {
            const retryable = status >= 500 || status === 429;
            return extractFail('http_error', retryable, `HTTP ${status}`);
        }

        // Wait for JS challenges to resolve and content to load
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(2000);

        let data;
        try {
            data = await page.evaluate(extractPageData);
        } catch (err) {
            return extractFail('parse_error', false, err instanceof Error ? err.message : 'page.evaluate failed');
        }
        if (!data) return extractFail('no_price_found', false, 'no JSON-LD or selector match in DOM');

        return extractOk({
            price: parsePrice(data.price),
            currency: data.currency,
            in_stock: parseAvailability(data.availability),
            title: (data.title as string) ?? null,
            source: 'playwright',
        });
    } finally {
        await browser.close();
    }
}

// ── Page evaluation (runs in browser context) ───────────

function extractPageData() {
    // 1. Try JSON-LD
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
        try {
            const json = JSON.parse(script.textContent ?? '');
            const product = findProduct(json);
            if (!product) continue;
            const offers = product.offers ?? product.Offers;
            if (!offers) continue;

            const offer = Array.isArray(offers)
                ? offers[0]
                : offers;

            // Direct price
            if (offer?.price || offer?.lowPrice) {
                return {
                    price: String(offer.price ?? offer.lowPrice),
                    currency: offer.priceCurrency ?? 'USD',
                    availability: offer.availability ?? '',
                    title: product.name ?? product.Name ?? null,
                };
            }

            // priceSpecification (e.g. Big W, Rebel Sport)
            if (Array.isArray(offer?.priceSpecification)) {
                const current = offer.priceSpecification.find(
                    (s: Record<string, string>) => {
                        const pt = s.priceType ?? '';
                        return !pt.includes('Strikethrough') && !pt.includes('List');
                    }
                ) ?? offer.priceSpecification[offer.priceSpecification.length - 1];
                if (current?.price) {
                    return {
                        price: String(current.price),
                        currency: current.priceCurrency ?? offer.priceCurrency ?? 'USD',
                        availability: offer.availability ?? '',
                        title: product.name ?? null,
                    };
                }
            }
        } catch { /* skip */ }
    }

    // 2. Try common selectors
    const selectors = [
        '.a-price .a-offscreen',
        '#corePrice_feature_div .a-offscreen',
        '.reinventPricePriceToPayMargin .a-offscreen',
        '.priceView-customer-price span[aria-hidden="true"]',
        '[data-testid="customer-price"] span',
        '[data-test="product-price"]',
        '[itemprop="price"]',
        '[data-automation="buybox-price"]',
        '.x-price-primary span',
        '#pull-right-price',
        '[data-price]',
        '.divPriceNormal',
        '.product-price',
        '.current-price',
        '.sale-price',
        '.price',
    ];

    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const raw = (el as HTMLElement).dataset?.price
            ?? el.getAttribute('content')
            ?? el.textContent?.trim();
        if (raw && /\d/.test(raw)) {
            return {
                price: raw,
                currency: detectPageCurrency(),
                availability: '',
                title: document.querySelector('h1')?.textContent?.trim()
                    ?? document.title ?? null,
            };
        }
    }

    return null;

    // ── In-page helpers ─────────────────────────
    function findProduct(data: unknown): Record<string, unknown> | null {
        if (!data || typeof data !== 'object') return null;
        if (Array.isArray(data)) {
            for (const item of data) {
                const found = findProduct(item);
                if (found) return found;
            }
            return null;
        }
        const obj = data as Record<string, unknown>;
        if (obj['@type'] === 'Product' ||
            (Array.isArray(obj['@type']) && obj['@type'].includes('Product'))) {
            return obj;
        }
        if (Array.isArray(obj['@graph'])) return findProduct(obj['@graph']);
        return null;
    }

    function detectPageCurrency(): string {
        const meta = document.querySelector('meta[itemprop="priceCurrency"]');
        if (meta) return meta.getAttribute('content') ?? 'USD';
        const text = document.body.innerText.slice(0, 5000);
        if (text.includes('£')) return 'GBP';
        if (text.includes('€')) return 'EUR';
        if (text.includes('A$') || text.includes('AU$')) return 'AUD';
        if (text.includes('C$') || text.includes('CA$')) return 'CAD';
        // Fallback: infer from domain
        const host = window.location.hostname;
        if (host.endsWith('.com.au') || host.endsWith('.au')) return 'AUD';
        if (host.endsWith('.co.uk')) return 'GBP';
        if (host.endsWith('.ca')) return 'CAD';
        if (host.endsWith('.de') || host.endsWith('.fr') || host.endsWith('.it') || host.endsWith('.es')) return 'EUR';
        if (host.endsWith('.co.jp')) return 'JPY';
        return 'USD';
    }
}
