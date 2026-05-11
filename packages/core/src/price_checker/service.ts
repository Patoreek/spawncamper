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

        if (!urlData) continue;

        // Make sure we have an AUD rate cached for this currency before we
        // persist anything — guarantees the read path can convert later.
        if (urlData.price !== null) {
            try { await ensureRate(urlData.currency); }
            catch (err) { console.warn(`[price_checker] ensureRate(${urlData.currency}) failed:`, err); }
        }

        // Persist to price_checks if we got a valid price
        let previousPrice: number | null = null;
        let previousCurrency: string | null = null;
        if (urlData.price !== null) {
            const previous = getPreviousPriceCheck(productUrl.id);
            previousPrice = previous?.price ?? null;
            previousCurrency = previous?.currency ?? null;

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
            price: urlData.price,
            currency: urlData.currency,
            price_aud: convertToAudOrNull(urlData.price, urlData.currency),
            in_stock: urlData.in_stock,
            title: urlData.title,
            source: urlData.source,
            previous_price: previousPrice,
            previous_price_aud: convertToAudOrNull(previousPrice, previousCurrency),
        });
    }

    const audPrices = results.map((r) => r.price_aud).filter((p): p is number => p !== null);

    const aggregated: PriceCheckAggregatedData = {
        productId,
        results,
        lowestPrice: audPrices.length ? Math.min(...audPrices) : null,
        averagePrice: audPrices.length ? audPrices.reduce((a, b) => a + b, 0) / audPrices.length : null,
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
    if (urlData.price !== null) {
        const previous = getPreviousPriceCheck(productUrl.id);
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
        price: urlData.price,
        currency: urlData.currency,
        price_aud: convertToAudOrNull(urlData.price, urlData.currency),
        in_stock: urlData.in_stock,
        title: urlData.title,
        source: urlData.source,
        previous_price: previousPrice,
        previous_price_aud: convertToAudOrNull(previousPrice, previousCurrency),
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
