import { getProductUrlsForProduct, getProductUrlById } from '../product_urls/service';
import { getAllProducts } from '../products/service';
import { createPriceCheck, getPreviousPriceCheck } from '../price_checks/service';
import { evaluateAndNotify } from '../notifications/service';
import { convertToAudOrNull, ensureRate } from '../fx/service';
import { extractWithCheerio } from './cheerio';
import { extractWithPlaywright } from './playwright';
import { extractWithProxy } from './proxy';
import { extractWithAmazon, isAmazonUrl } from './amazon';
import { needsProxy, needsPlaywright } from './types';
import type { UrlData, PriceCheckAggregatedData, PriceCheckUrlResult, CheckAllResult } from './types';

export type { UrlData, PriceCheckAggregatedData, PriceCheckUrlResult, CheckAllResult } from './types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const checkPrices = async (productId: number): Promise<PriceCheckAggregatedData> => {
    const productUrls = getProductUrlsForProduct(productId);
    const results: PriceCheckUrlResult[] = [];
    let checkedCount = 0;

    for (const productUrl of productUrls) {
        if (!productUrl.active) continue;

        // Delay between URL checks to avoid bot detection
        if (checkedCount > 0) {
            await sleep(3000 + Math.random() * 2000);
        }

        const urlData = await getDataFromUrl(productUrl.url);
        checkedCount++;

        // Look up the previous stored row regardless of current scrape outcome
        // — failed-scrape rows still carry the URL's historical baseline so
        // `previousLowest` doesn't silently exclude it.
        const previous = getPreviousPriceCheck(productUrl.id);
        const previousInStock = previous ? !!previous.in_stock : null;
        const previousPrice = previous?.price ?? null;
        const previousCurrency = previous?.currency ?? null;

        if (!urlData) {
            results.push({
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
            });
            continue;
        }

        // Make sure we have an AUD rate cached for this currency before we
        // persist anything — guarantees the read path can convert later.
        if (urlData.price !== null) {
            try { await ensureRate(urlData.currency); }
            catch (err) { console.warn(`[price_checker] ensureRate(${urlData.currency}) failed:`, err); }
        }

        // Persist to price_checks if we got a valid price
        if (urlData.price !== null) {
            createPriceCheck({
                product_url_id: productUrl.id,
                price: urlData.price,
                currency: urlData.currency,
                in_stock: urlData.in_stock,
            });
        }

        results.push({
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
        });
    }

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

    const urlData = await getDataFromUrl(productUrl.url);
    if (!urlData) return null;

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
    const allResults: PriceCheckAggregatedData[] = [];
    let totalUrls = 0;

    for (let i = 0; i < products.length; i++) {
        const result = await checkPrices(products[i].id);
        allResults.push(result);
        totalUrls += result.results.length;

        // Delay between products to avoid bot detection
        if (i < products.length - 1) {
            await sleep(5000 + Math.random() * 5000);
        }
    }

    return {
        startedAt,
        completedAt: new Date().toISOString(),
        productsChecked: products.length,
        urlsChecked: totalUrls,
        results: allResults,
    };
};

export const getDataFromUrl = async (url: string): Promise<UrlData | null> => {
    if (isAmazonUrl(url)) return extractWithAmazon(url);
    if (needsProxy(url)) return extractWithProxy(url);
    if (needsPlaywright(url)) return extractWithPlaywright(url);
    return extractWithCheerio(url);
};
