import { getProductUrlsForProduct, getProductUrlById } from '../product_urls/service';
import { getAllProducts } from '../products/service';
import { createPriceCheck, getPreviousPriceCheck } from '../price_checks/service';
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

        // Persist to price_checks if we got a valid price
        let previousPrice: number | null = null;
        if (urlData.price !== null) {
            const previous = getPreviousPriceCheck(productUrl.id);
            previousPrice = previous?.price ?? null;

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
            in_stock: urlData.in_stock,
            title: urlData.title,
            source: urlData.source,
            previous_price: previousPrice,
        });
    }

    const prices = results.map((r) => r.price).filter((p): p is number => p !== null);

    return {
        productId,
        results,
        lowestPrice: prices.length ? Math.min(...prices) : null,
        averagePrice: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
        checkedAt: new Date().toISOString(),
    };
};

export const checkSingleUrl = async (productUrlId: number): Promise<PriceCheckUrlResult | null> => {
    const productUrl = getProductUrlById(productUrlId);
    if (!productUrl) return null;

    const urlData = await getDataFromUrl(productUrl.url);
    if (!urlData) return null;

    let previousPrice: number | null = null;
    if (urlData.price !== null) {
        const previous = getPreviousPriceCheck(productUrl.id);
        previousPrice = previous?.price ?? null;

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
        in_stock: urlData.in_stock,
        title: urlData.title,
        source: urlData.source,
        previous_price: previousPrice,
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
