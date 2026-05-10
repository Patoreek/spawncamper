import { createHmac, createHash } from 'crypto';
import type { UrlData } from './types';

// ── Config ──────────────────────────────────────────────

interface AmazonConfig {
    accessKey: string;
    secretKey: string;
    partnerTag: string;
}

function getConfig(): AmazonConfig | null {
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    const partnerTag = process.env.AMAZON_PARTNER_TAG;
    if (!accessKey || !secretKey || !partnerTag) return null;
    return { accessKey, secretKey, partnerTag };
}

/**
 * Map Amazon domain TLDs to PA-API regions and hosts.
 * See: https://webservices.amazon.com/paapi5/documentation/common-request-parameters.html
 */
const REGION_MAP: Record<string, { host: string; region: string }> = {
    'amazon.com':       { host: 'webservices.amazon.com',       region: 'us-east-1' },
    'amazon.co.uk':     { host: 'webservices.amazon.co.uk',     region: 'eu-west-1' },
    'amazon.de':        { host: 'webservices.amazon.de',        region: 'eu-west-1' },
    'amazon.fr':        { host: 'webservices.amazon.fr',        region: 'eu-west-1' },
    'amazon.it':        { host: 'webservices.amazon.it',        region: 'eu-west-1' },
    'amazon.es':        { host: 'webservices.amazon.es',        region: 'eu-west-1' },
    'amazon.co.jp':     { host: 'webservices.amazon.co.jp',     region: 'us-west-2' },
    'amazon.ca':        { host: 'webservices.amazon.ca',        region: 'us-east-1' },
    'amazon.com.au':    { host: 'webservices.amazon.com.au',    region: 'us-west-2' },
    'amazon.in':        { host: 'webservices.amazon.in',        region: 'eu-west-1' },
    'amazon.com.br':    { host: 'webservices.amazon.com.br',    region: 'us-east-1' },
    'amazon.com.mx':    { host: 'webservices.amazon.com.mx',    region: 'us-east-1' },
    'amazon.sg':        { host: 'webservices.amazon.sg',        region: 'us-west-2' },
    'amazon.com.tr':    { host: 'webservices.amazon.com.tr',    region: 'eu-west-1' },
    'amazon.ae':        { host: 'webservices.amazon.ae',        region: 'eu-west-1' },
    'amazon.sa':        { host: 'webservices.amazon.sa',        region: 'eu-west-1' },
    'amazon.nl':        { host: 'webservices.amazon.nl',        region: 'eu-west-1' },
    'amazon.se':        { host: 'webservices.amazon.se',        region: 'eu-west-1' },
    'amazon.pl':        { host: 'webservices.amazon.pl',        region: 'eu-west-1' },
    'amazon.com.be':    { host: 'webservices.amazon.com.be',    region: 'eu-west-1' },
};

const CURRENCY_MAP: Record<string, string> = {
    'amazon.com': 'USD', 'amazon.co.uk': 'GBP', 'amazon.de': 'EUR',
    'amazon.fr': 'EUR', 'amazon.it': 'EUR', 'amazon.es': 'EUR',
    'amazon.co.jp': 'JPY', 'amazon.ca': 'CAD', 'amazon.com.au': 'AUD',
    'amazon.in': 'INR', 'amazon.com.br': 'BRL', 'amazon.com.mx': 'MXN',
    'amazon.sg': 'SGD', 'amazon.nl': 'EUR', 'amazon.se': 'SEK',
    'amazon.pl': 'PLN', 'amazon.ae': 'AED', 'amazon.sa': 'SAR',
    'amazon.com.be': 'EUR', 'amazon.com.tr': 'TRY',
};

// ── Public API ──────────────────────────────────────────

export function isAmazonUrl(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname.includes('amazon.');
    } catch {
        return false;
    }
}

export async function extractWithAmazon(url: string): Promise<UrlData | null> {
    const config = getConfig();
    if (!config) {
        console.warn('[amazon] Missing AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, or AMAZON_PARTNER_TAG env vars');
        return null;
    }

    const asin = extractAsin(url);
    if (!asin) {
        console.warn('[amazon] Could not extract ASIN from URL:', url);
        return null;
    }

    const domainKey = getDomainKey(url);
    const endpoint = REGION_MAP[domainKey];
    if (!endpoint) {
        console.warn('[amazon] Unsupported Amazon domain:', domainKey);
        return null;
    }

    try {
        const body = JSON.stringify({
            ItemIds: [asin],
            Resources: [
                'ItemInfo.Title',
                'Offers.Listings.Price',
                'Offers.Listings.Availability.Type',
                'Offers.Listings.Availability.Message',
                'Offers.Listings.DeliveryInfo.IsAmazonFulfilled',
            ],
            PartnerTag: config.partnerTag,
            PartnerType: 'Associates',
            Marketplace: `www.${domainKey}`,
        });

        const path = '/paapi5/getitems';
        const headers = sign({
            method: 'POST',
            host: endpoint.host,
            path,
            region: endpoint.region,
            body,
            accessKey: config.accessKey,
            secretKey: config.secretKey,
        });

        const res = await fetch(`https://${endpoint.host}${path}`, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json; charset=utf-8',
                'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
                'Content-Encoding': 'amz-1.0',
            },
            body,
        });

        if (!res.ok) {
            const err = await res.text();
            console.warn(`[amazon] PA-API error ${res.status}:`, err.slice(0, 200));
            return null;
        }

        const data = await res.json() as PaapiResponse;
        return parseResponse(data, domainKey);
    } catch (err) {
        console.warn('[amazon] Request failed:', err);
        return null;
    }
}

// ── URL parsing ─────────────────────────────────────────

function extractAsin(url: string): string | null {
    // Patterns: /dp/ASIN, /gp/product/ASIN, /exec/obidos/ASIN/ASIN, /gp/aw/d/ASIN
    const match = url.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/([A-Z0-9]{10})/i);
    return match?.[1]?.toUpperCase() ?? null;
}

function getDomainKey(url: string): string {
    const hostname = new URL(url).hostname.toLowerCase().replace('www.', '');
    // hostname = "amazon.com.au" → match against keys
    for (const key of Object.keys(REGION_MAP)) {
        if (hostname.endsWith(key)) return key;
    }
    return 'amazon.com';
}

// ── Response parsing ────────────────────────────────────

interface PaapiResponse {
    ItemsResult?: {
        Items?: PaapiItem[];
    };
    Errors?: Array<{ Code: string; Message: string }>;
}

interface PaapiItem {
    ASIN: string;
    ItemInfo?: {
        Title?: { DisplayValue?: string };
    };
    Offers?: {
        Listings?: PaapiListing[];
    };
}

interface PaapiListing {
    Price?: {
        Amount?: number;
        Currency?: string;
        DisplayAmount?: string;
    };
    Availability?: {
        Type?: string;
        Message?: string;
    };
}

function parseResponse(data: PaapiResponse, domainKey: string): UrlData | null {
    const item = data.ItemsResult?.Items?.[0];
    if (!item) return null;

    const listing = item.Offers?.Listings?.[0];
    const price = listing?.Price?.Amount ?? null;
    const currency = listing?.Price?.Currency ?? CURRENCY_MAP[domainKey] ?? 'USD';
    const title = item.ItemInfo?.Title?.DisplayValue ?? null;

    const availType = listing?.Availability?.Type ?? '';
    const in_stock = availType !== 'OutOfStock';

    return {
        price,
        currency,
        in_stock,
        title,
        source: 'amazon-paapi',
    };
}

// ── AWS Signature v4 (minimal) ──────────────────────────

interface SignInput {
    method: string;
    host: string;
    path: string;
    region: string;
    body: string;
    accessKey: string;
    secretKey: string;
}

function sign(input: SignInput): Record<string, string> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const dateStamp = amzDate.slice(0, 8);
    const service = 'ProductAdvertisingAPI';
    const scope = `${dateStamp}/${input.region}/${service}/aws4_request`;

    const payloadHash = sha256(input.body);

    const canonicalHeaders =
        `content-encoding:amz-1.0\n` +
        `content-type:application/json; charset=utf-8\n` +
        `host:${input.host}\n` +
        `x-amz-date:${amzDate}\n` +
        `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems\n`;

    const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';

    const canonicalRequest = [
        input.method,
        input.path,
        '', // no query string
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        scope,
        sha256(canonicalRequest),
    ].join('\n');

    const signingKey = getSignatureKey(input.secretKey, dateStamp, input.region, service);
    const signature = hmac(signingKey, stringToSign).toString('hex');

    return {
        'Authorization': `AWS4-HMAC-SHA256 Credential=${input.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'X-Amz-Date': amzDate,
    };
}

function sha256(data: string): string {
    return createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key: string | Buffer, data: string): Buffer {
    return createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSignatureKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = hmac(`AWS4${secret}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    return hmac(kService, 'aws4_request');
}
