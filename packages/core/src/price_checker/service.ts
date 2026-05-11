import { getProductUrlsForProduct, getProductUrlById } from '../product_urls/service';
import { getAllProducts } from '../products/service';
import { createPriceCheck, getPreviousPriceCheck } from '../price_checks/service';
import { evaluateAndNotify } from '../notifications/service';
import { convertToAudOrNull, ensureRate } from '../fx/service';
import { recordScrapeFailure } from '../price_check_failures/service';
import { retry } from '../utils/retry';
import { DomainScheduler, domainKey } from '../utils/domain_scheduler';
import { extractWithCheerio } from './cheerio';
import { extractWithPlaywright } from './playwright';
import { extractWithProxy } from './proxy';
import { extractWithAmazon, isAmazonUrl } from './amazon';
import { needsProxy, needsPlaywright } from './types';
import type { ExtractResult, PriceCheckAggregatedData, PriceCheckUrlResult, CheckAllResult } from './types';
import type { ProductUrl } from '../product_urls/types';

export type { UrlData, PriceCheckAggregatedData, PriceCheckUrlResult, CheckAllResult } from './types';

// Retry config for batch scrape paths (cron + manual full-product checks).
// Single-URL scans from the UI deliberately do NOT retry — that flow exists
// for fast manual debugging, where a quick "couldn't extract" beats a 6-second
// wait while we chase a known-broken URL.
const SCRAPE_MAX_ATTEMPTS = 3;
const scrapeBackoffMs = (attempt: number): number => {
    // attempt=1 → ~500ms; attempt=2 → ~1000ms. Light jitter to avoid lockstep
    // retries when several URLs against the same host all blip at once.
    const base = 500 * Math.pow(2, attempt - 1);
    return base + Math.floor(Math.random() * 200);
};

const scrapeWithRetry = (url: string): Promise<ExtractResult> =>
    retry<ExtractResult>(
        () => getDataFromUrl(url),
        (r) => !r.ok && r.retryable === true,
        { maxAttempts: SCRAPE_MAX_ATTEMPTS, backoffMs: scrapeBackoffMs },
    );

// Shared across checkPrices + checkAllProducts so cross-product calls to the
// same retailer queue up against each other (politeness) while different
// retailers run concurrently (throughput). Manual single-URL scans bypass.
const scheduler = new DomainScheduler({ minGapMs: 3000, jitterMs: 2000 });

/**
 * Run an extraction for one product URL and build the result row. Returns a
 * fully-formed PriceCheckUrlResult (success or failure) — never throws. The
 * caller is responsible for plumbing this into the per-product aggregate.
 *
 * Goes through the shared domain scheduler so concurrent calls don't pile up
 * on the same host.
 */
const processProductUrl = async (productUrl: ProductUrl): Promise<PriceCheckUrlResult> => {
    return scheduler.schedule(domainKey(productUrl.url), async () => {
        const extractResult = await scrapeWithRetry(productUrl.url);

        // Look up the previous stored row regardless of current scrape outcome
        // — failed-scrape rows still carry the URL's historical baseline so
        // `previousLowest` doesn't silently exclude it.
        const previous = getPreviousPriceCheck(productUrl.id);
        const previousInStock = previous ? !!previous.in_stock : null;
        const previousPrice = previous?.price ?? null;
        const previousCurrency = previous?.currency ?? null;

        if (!extractResult.ok) {
            const attemptInfo = extractResult.retryable
                ? `failed after ${SCRAPE_MAX_ATTEMPTS} attempts`
                : 'failed (non-retryable)';
            const msg = extractResult.message ? `${attemptInfo}: ${extractResult.message}` : attemptInfo;
            recordScrapeFailure(productUrl.id, extractResult.reason, msg);
            return {
                product_url_id: productUrl.id,
                url: productUrl.url,
                retailer: productUrl.retailer,
                success: false,
                price: null,
                currency: previousCurrency ?? 'AUD',
                price_aud: null,
                in_stock: false,
                title: null,
                source: 'failed',
                previous_price: previousPrice,
                previous_price_aud: convertToAudOrNull(previousPrice, previousCurrency),
                previous_in_stock: previousInStock,
            };
        }

        const urlData = extractResult.data;

        if (urlData.price !== null) {
            try { await ensureRate(urlData.currency); }
            catch (err) { console.warn(`[price_checker] ensureRate(${urlData.currency}) failed:`, err); }
            createPriceCheck({
                product_url_id: productUrl.id,
                price: urlData.price,
                currency: urlData.currency,
                in_stock: urlData.in_stock,
            });
        }

        return {
            product_url_id: productUrl.id,
            url: productUrl.url,
            retailer: productUrl.retailer,
            success: true,
            price: urlData.price,
            currency: urlData.currency,
            price_aud: convertToAudOrNull(urlData.price, urlData.currency),
            in_stock: urlData.in_stock,
            title: urlData.title,
            source: urlData.source,
            previous_price: previousPrice,
            previous_price_aud: convertToAudOrNull(previousPrice, previousCurrency),
            previous_in_stock: previousInStock,
        };
    });
};

export const checkPrices = async (productId: number): Promise<PriceCheckAggregatedData> => {
    const productUrls = getProductUrlsForProduct(productId);
    const active = productUrls.filter((u) => u.active);

    // URLs run concurrently, gated by the domain scheduler — different
    // retailers proceed in parallel; same retailer queues up with the
    // configured min-gap. The old serial loop's politeness sleep was the
    // motivation for this; the scheduler subsumes it.
    const results = await Promise.all(active.map(processProductUrl));

    const audPrices = results.map((r) => r.price_aud).filter((p): p is number => p !== null);
    // Current-state aggregates ignore failed scrapes — we don't know the URL's
    // real current state on failure, so treating those URLs as out-of-stock
    // would manufacture false negatives.
    const successfulResults = results.filter((r) => r.success);
    const currentlyInStock = successfulResults.length === 0 ? null : successfulResults.some((r) => r.in_stock);
    // Prior-state aggregates use all results — stored data is valid regardless
    // of whether this run's scrape succeeded.
    const prevStockResults = results.filter((r) => r.previous_in_stock !== null);
    const previouslyInStock = prevStockResults.length === 0
        ? null
        : prevStockResults.some((r) => r.previous_in_stock === true);

    const aggregated: PriceCheckAggregatedData = {
        productId,
        results,
        lowestPrice: audPrices.length ? Math.min(...audPrices) : null,
        averagePrice: audPrices.length ? audPrices.reduce((a, b) => a + b, 0) / audPrices.length : null,
        currentlyInStock,
        previouslyInStock,
        checkedAt: new Date().toISOString(),
    };

    // Fire-and-don't-block: a messenger failure shouldn't surface as a price-check failure.
    try {
        await evaluateAndNotify(productId, aggregated);
    } catch (err) {
        console.error('[price_checker] notify dispatch failed:', err);
    }

    return aggregated;
};

export const checkSingleUrl = async (productUrlId: number): Promise<PriceCheckUrlResult | null> => {
    const productUrl = getProductUrlById(productUrlId);
    if (!productUrl) return null;

    const extractResult = await scrapeWithRetry(productUrl.url);
    if (!extractResult.ok) {
        const attemptInfo = extractResult.retryable
            ? `failed after ${SCRAPE_MAX_ATTEMPTS} attempts`
            : 'failed (non-retryable)';
        const msg = extractResult.message ? `${attemptInfo}: ${extractResult.message}` : attemptInfo;
        recordScrapeFailure(productUrlId, extractResult.reason, msg);
        return null;
    }
    const urlData = extractResult.data;

    if (urlData.price !== null) {
        try { await ensureRate(urlData.currency); }
        catch (err) { console.warn(`[price_checker] ensureRate(${urlData.currency}) failed:`, err); }
    }

    let previousPrice: number | null = null;
    let previousCurrency: string | null = null;
    let previousInStock: boolean | null = null;
    const previous = getPreviousPriceCheck(productUrl.id);
    if (previous) {
        previousInStock = !!previous.in_stock;
    }
    if (urlData.price !== null) {
        previousPrice = previous?.price ?? null;
        previousCurrency = previous?.currency ?? null;

        createPriceCheck({
            product_url_id: productUrl.id,
            price: urlData.price,
            currency: urlData.currency,
            in_stock: urlData.in_stock,
        });
    }

    return {
        product_url_id: productUrl.id,
        url: productUrl.url,
        retailer: productUrl.retailer,
        success: true,
        price: urlData.price,
        currency: urlData.currency,
        price_aud: convertToAudOrNull(urlData.price, urlData.currency),
        in_stock: urlData.in_stock,
        title: urlData.title,
        source: urlData.source,
        previous_price: previousPrice,
        previous_price_aud: convertToAudOrNull(previousPrice, previousCurrency),
        previous_in_stock: previousInStock,
    };
};

export const checkAllProducts = async (): Promise<CheckAllResult> => {
    const startedAt = new Date().toISOString();
    const products = getAllProducts('active');

    // All products run in parallel. The shared DomainScheduler inside
    // `processProductUrl` ensures URLs hitting the same hostname queue up
    // politely (regardless of which product they belong to), so cross-product
    // collisions on Amazon / Big W / etc. are still serialised.
    const allResults = await Promise.all(products.map((p) => checkPrices(p.id)));
    const totalUrls = allResults.reduce((acc, r) => acc + r.results.length, 0);

    return {
        startedAt,
        completedAt: new Date().toISOString(),
        productsChecked: products.length,
        urlsChecked: totalUrls,
        results: allResults,
    };
};

export const getDataFromUrl = async (url: string): Promise<ExtractResult> => {
    if (isAmazonUrl(url)) return extractWithAmazon(url);
    if (needsProxy(url)) return extractWithProxy(url);
    if (needsPlaywright(url)) return extractWithPlaywright(url);
    return extractWithCheerio(url);
};
