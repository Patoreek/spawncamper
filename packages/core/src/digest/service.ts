import { getAllProducts } from '../products/service';
import { getLatestPriceChecksForProduct, getProductPriceSummary } from '../price_checks/service';
import { getProductUrlsForProduct } from '../product_urls/service';
import { getMessenger } from '../notifications/messenger';
import { formatDigest } from './formatter';
import type { DigestPayload, DigestRow, DigestSendResult } from './types';

/**
 * Assemble the digest payload from currently-active products. Pure read —
 * no mutation, no notifications-table writes (digests are not part of the
 * alert state machine, so dedupe / suppression doesn't apply).
 */
export const buildDigest = (): DigestPayload => {
    const products = getAllProducts('active');
    const rows: DigestRow[] = products.map((p) => {
        const summary = getProductPriceSummary(p.id);
        const latest = getLatestPriceChecksForProduct(p.id);
        const urls = getProductUrlsForProduct(p.id);

        // currentlyInStock is null when no URL produced any check this run.
        // Same semantics here: null = unknown, false = every URL is OOS, true = at least one in stock.
        let anyInStock: boolean | null;
        if (latest.length === 0) {
            anyInStock = null;
        } else {
            anyInStock = latest.some((pc) => !!pc.in_stock);
        }

        return {
            productId: p.id,
            name: p.name,
            currentLowest: summary.currentLowest,
            currentLowestRetailer: summary.currentLowestRetailer,
            initialPrice: summary.initialPrice,
            percentageDecrease: summary.percentageDecrease,
            anyInStock,
            urlCount: urls.length,
        };
    });

    return {
        generatedAt: new Date().toISOString(),
        rows,
    };
};

export interface SendDigestOpts {
    /** When true, render the text but skip messenger dispatch. */
    dryRun?: boolean;
}

/**
 * Build + send the digest in one call. Returns the rendered text on every
 * path so callers (API dry-run, scheduler logs) can surface it.
 */
export const sendDigest = async (opts: SendDigestOpts = {}): Promise<DigestSendResult> => {
    const payload = buildDigest();
    const text = formatDigest(payload);
    const rowCount = payload.rows.length;

    if (rowCount === 0) {
        return { sent: false, text, rowCount, skippedReason: 'no_active_products' };
    }

    if (opts.dryRun) {
        return { sent: false, text, rowCount, skippedReason: 'dry_run' };
    }

    const handle = getMessenger();
    if (!handle) {
        console.warn('[digest] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping send');
        return { sent: false, text, rowCount, skippedReason: 'messenger_not_configured' };
    }

    try {
        await handle.messenger.send({ to: handle.recipient, text, parseMode: 'markdown' });
        return { sent: true, text, rowCount };
    } catch (err) {
        console.error('[digest] send failed:', err);
        return { sent: false, text, rowCount, skippedReason: 'send_failed' };
    }
};
