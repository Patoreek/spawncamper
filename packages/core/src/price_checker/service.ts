import { getProductUrlsForProduct } from '../product_urls/service';
import { extractWithCheerio } from './cheerio';
import { extractWithPlaywright } from './playwright';
import { extractWithProxy } from './proxy';
import { extractWithAmazon, isAmazonUrl } from './amazon';
import { needsProxy, needsPlaywright } from './types';
import type { UrlData, PriceCheckAggregatedData } from './types';

export type { UrlData, PriceCheckAggregatedData } from './types';

export const checkPrices = async (productId: number): Promise<PriceCheckAggregatedData> => {
    const productUrls = getProductUrlsForProduct(productId);
    const results: UrlData[] = [];

    for (const productUrl of productUrls) {
        if (!productUrl.active) continue;
        const urlData = await getDataFromUrl(productUrl.url);
        if (urlData) results.push(urlData);
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

export const getDataFromUrl = async (url: string): Promise<UrlData | null> => {
    if (isAmazonUrl(url)) return extractWithAmazon(url);
    if (needsProxy(url)) return extractWithProxy(url);
    if (needsPlaywright(url)) return extractWithPlaywright(url);
    return extractWithCheerio(url);
};
