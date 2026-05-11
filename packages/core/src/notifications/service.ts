import { db } from '../db/db';
import { convertToAudOrNull } from '../fx/service';
import { getProductById } from '../products/service';
import { getLatestPriceChecksForProduct, getProductPriceSummary } from '../price_checks/service';
import { NotificationDAL } from './dal';
import { previousLowestFor } from './aggregate';
import { decide, evaluateRule } from './evaluator';
import {
  formatAlertMessage,
  formatBackInStockMessage,
  formatOutOfStockMessage,
  formatRecoveryMessage,
  formatTestMessage,
} from './formatter';
import { getMessenger } from './messenger';
import type {
  EvaluateContext,
  NotifyResult,
  SummaryData,
} from './types';
import type { NotifyKind, Product } from '../products/types';
import type { PriceCheckAggregatedData } from '../price_checker/types';

const isStockRule = (k: NotifyKind): boolean =>
  k === 'back_in_stock' || k === 'out_of_stock';

const notificationDAL = new NotificationDAL(db);

const buildSummaryData = (product: Product, aggregated: PriceCheckAggregatedData): SummaryData => {
  const summary = getProductPriceSummary(product.id);
  return {
    productName: product.name,
    rule: product.notify_kind
      ? { kind: product.notify_kind, value: product.notify_value, targetPrice: product.target_price }
      : null,
    aggregated,
    initialPrice: summary.initialPrice,
    initialRetailer: summary.initialRetailer,
    percentageDecrease: summary.percentageDecrease,
  };
};

const send = async (text: string): Promise<{ sent: boolean; skippedReason?: string }> => {
  const handle = getMessenger();
  if (!handle) {
    console.warn('[notifications] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping send');
    return { sent: false, skippedReason: 'messenger_not_configured' };
  }
  try {
    await handle.messenger.send({ to: handle.recipient, text, parseMode: 'markdown' });
    return { sent: true };
  } catch (err) {
    console.error('[notifications] send failed:', err);
    return { sent: false, skippedReason: 'send_failed' };
  }
};

/**
 * Evaluate the product's notify rule against the latest price check result
 * and dispatch a notification if the state machine says so.
 */
export const evaluateAndNotify = async (
  productId: number,
  aggregated: PriceCheckAggregatedData,
): Promise<NotifyResult> => {
  const product = getProductById(productId);
  if (!product) return { decision: { action: 'none' }, sent: false, skippedReason: 'product_not_found' };
  if (!product.notify_enabled || !product.notify_kind) {
    return { decision: { action: 'none' }, sent: false, skippedReason: 'disabled' };
  }
  // Price rules need a current price to compare against; stock rules don't.
  if (!isStockRule(product.notify_kind) && aggregated.lowestPrice === null) {
    return { decision: { action: 'none' }, sent: false, skippedReason: 'no_price' };
  }

  const summary = getProductPriceSummary(productId);
  const ctx: EvaluateContext = {
    productId,
    rule: {
      kind: product.notify_kind,
      value: product.notify_value,
      targetPrice: product.target_price,
    },
    currentLowest: aggregated.lowestPrice,
    initialPrice: summary.initialPrice,
    previousLowest: previousLowestFor(aggregated),
    currentlyInStock: aggregated.currentlyInStock,
    previouslyInStock: aggregated.previouslyInStock,
  };

  const evaluation = evaluateRule(ctx);
  const latest = notificationDAL.findLatest(productId);
  const decision = decide(ctx, evaluation, latest);

  if (decision.action === 'none') {
    return { decision, sent: false };
  }

  const summaryData = buildSummaryData(product, aggregated);
  let text: string;
  if (decision.action === 'alert') {
    if (product.notify_kind === 'back_in_stock') {
      text = formatBackInStockMessage(summaryData);
    } else if (product.notify_kind === 'out_of_stock') {
      text = formatOutOfStockMessage(summaryData);
    } else {
      text = formatAlertMessage(summaryData, decision.price, decision.previousLowest);
    }
  } else {
    text = formatRecoveryMessage(summaryData, decision.alertPrice, decision.price);
  }

  const result = await send(text);
  if (result.sent) {
    notificationDAL.create({
      product_id: productId,
      kind: decision.action,
      price: decision.price,
    });
  }
  return { decision, ...result };
};

/**
 * Send a manual test summary for a product, regardless of rule state.
 * Does not record into the notifications table (it's not part of the state machine).
 */
export const sendTestMessage = async (productId: number): Promise<NotifyResult> => {
  const product = getProductById(productId);
  if (!product) {
    return { decision: { action: 'none' }, sent: false, skippedReason: 'product_not_found' };
  }

  const summary = getProductPriceSummary(productId);
  const latest = getLatestPriceChecksForProduct(productId);

  // Build a synthetic aggregated structure from cached latest checks so we can
  // reuse the same formatter. The `source` field is required by the type union
  // but not displayed in the message itself.
  const results = latest.map((p): PriceCheckAggregatedData['results'][number] => ({
    product_url_id: p.product_url_id,
    url: p.url,
    retailer: p.retailer,
    success: true,
    price: p.price,
    currency: p.currency,
    price_aud: convertToAudOrNull(p.price, p.currency),
    in_stock: !!p.in_stock,
    title: null,
    source: 'selector',
    previous_price: null,
    previous_price_aud: null,
    previous_in_stock: null,
  }));
  const audPrices = results.map((r) => r.price_aud).filter((p): p is number => p !== null);

  const aggregated: PriceCheckAggregatedData = {
    productId,
    results,
    lowestPrice: audPrices.length ? Math.min(...audPrices) : null,
    averagePrice: audPrices.length ? audPrices.reduce((a, b) => a + b, 0) / audPrices.length : null,
    currentlyInStock: results.length === 0 ? null : results.some((r) => r.in_stock),
    previouslyInStock: null,
    checkedAt: latest[0]?.created_at ?? new Date().toISOString(),
  };

  const summaryData: SummaryData = {
    productName: product.name,
    rule: product.notify_kind
      ? { kind: product.notify_kind, value: product.notify_value, targetPrice: product.target_price }
      : null,
    aggregated,
    initialPrice: summary.initialPrice,
    initialRetailer: summary.initialRetailer,
    percentageDecrease: summary.percentageDecrease,
  };

  const text = formatTestMessage(summaryData);
  const result = await send(text);
  return {
    decision: { action: 'none' },
    ...result,
  };
};

/** Clear notification state for a product. Called when the rule changes. */
export const clearNotificationsFor = (productId: number): void => {
  notificationDAL.clearForProduct(productId);
};
