import type { NotifyKind } from '../products/types';
import type { PriceCheckUrlResult } from '../price_checker/types';
import type { SummaryData } from './types';

const fmtPrice = (price: number | null, currency: string | null = null): string => {
  if (price === null) return '—';
  const c = (currency ?? 'AUD').toUpperCase();
  if (c === 'AUD') return `A$${price.toFixed(2)}`;
  if (c === 'USD') return `US$${price.toFixed(2)}`;
  if (c === 'GBP') return `£${price.toFixed(2)}`;
  if (c === 'EUR') return `€${price.toFixed(2)}`;
  return `${c} ${price.toFixed(2)}`;
};

/** Format a per-URL price showing native + AUD-equivalent when applicable. */
const fmtNativeWithAud = (
  price: number | null,
  currency: string | null,
  priceAud: number | null,
): string => {
  if (price === null) return '—';
  const native = fmtPrice(price, currency);
  const isAud = (currency ?? 'AUD').toUpperCase() === 'AUD';
  if (isAud || priceAud === null) return native;
  return `${native} (≈ ${fmtPrice(priceAud, 'AUD')})`;
};

const describeRule = (
  kind: NotifyKind,
  value: number | null,
  targetPrice: number | null,
): string => {
  switch (kind) {
    case 'any_drop': return 'on any price drop';
    case 'target_price': return targetPrice !== null ? `when ≤ ${fmtPrice(targetPrice)}` : 'when price meets target';
    case 'percent_below_initial': return value !== null ? `when ${value}% below initial price` : 'when below initial';
    case 'absolute_below': return value !== null ? `when below ${fmtPrice(value)}` : 'when below threshold';
    case 'back_in_stock': return 'when back in stock';
    case 'out_of_stock': return 'when goes out of stock';
  }
};

const renderUrlList = (results: PriceCheckUrlResult[], lowestAud: number | null): string => {
  if (results.length === 0) return '';
  const lines = results.map((r) => {
    const isLowest = r.price_aud !== null && r.price_aud === lowestAud;
    const marker = isLowest ? ' (lowest)' : '';
    const stock = r.price === null ? 'no price' : r.in_stock ? 'in stock' : 'out of stock';
    return `• ${r.retailer}: ${fmtNativeWithAud(r.price, r.currency, r.price_aud)} — ${stock}${marker}`;
  });
  return lines.join('\n');
};

export const formatAlertMessage = (
  data: SummaryData,
  alertPrice: number,
  previousLowest: number | null,
): string => {
  const { productName, rule, aggregated, initialPrice, percentageDecrease } = data;
  const lowestResult = aggregated.results.find((r) => r.price_aud === aggregated.lowestPrice);
  const retailer = lowestResult?.retailer ?? 'unknown retailer';

  const lines: string[] = [];
  lines.push(`*Price drop:* ${productName}`);
  lines.push('');
  if (previousLowest !== null) {
    lines.push(`${fmtPrice(previousLowest)} → ${fmtPrice(alertPrice)} (${retailer})`);
  } else {
    lines.push(`Now ${fmtPrice(alertPrice)} (${retailer})`);
  }
  if (initialPrice !== null && percentageDecrease !== null) {
    lines.push(`Initial: ${fmtPrice(initialPrice)} — down ${percentageDecrease.toFixed(1)}%`);
  }

  const urls = renderUrlList(aggregated.results, aggregated.lowestPrice);
  if (urls) {
    lines.push('');
    lines.push(urls);
  }

  if (rule) {
    lines.push('');
    lines.push(`Rule: ${describeRule(rule.kind, rule.value, rule.targetPrice)}`);
  }

  return lines.join('\n');
};

export const formatRecoveryMessage = (
  data: SummaryData,
  alertPrice: number,
  currentPrice: number,
): string => {
  const { productName, rule, aggregated } = data;
  const lowestResult = aggregated.results.find((r) => r.price_aud === aggregated.lowestPrice);
  const retailer = lowestResult?.retailer ?? 'unknown retailer';

  const lines: string[] = [];
  lines.push(`*Price back up:* ${productName}`);
  lines.push('');
  lines.push(`Was ${fmtPrice(alertPrice)}, now ${fmtPrice(currentPrice)} (${retailer})`);
  lines.push('You missed the drop.');

  const urls = renderUrlList(aggregated.results, aggregated.lowestPrice);
  if (urls) {
    lines.push('');
    lines.push(urls);
  }

  if (rule) {
    lines.push('');
    lines.push(`Rule: ${describeRule(rule.kind, rule.value, rule.targetPrice)}`);
  }

  return lines.join('\n');
};

export const formatBackInStockMessage = (data: SummaryData): string => {
  const { productName, rule, aggregated } = data;
  const inStockResults = aggregated.results.filter((r) => r.in_stock);
  const lowest = aggregated.lowestPrice;
  const lowestResult = inStockResults.find((r) => r.price_aud === lowest);
  const retailerTail = lowestResult?.retailer ? ` at ${lowestResult.retailer}` : '';

  const lines: string[] = [];
  lines.push(`*Back in stock:* ${productName}${retailerTail}`);
  if (lowest !== null) {
    lines.push('');
    lines.push(`Currently ${fmtPrice(lowest)}${lowestResult?.retailer ? ` (${lowestResult.retailer})` : ''}`);
  }

  const urls = renderUrlList(aggregated.results, aggregated.lowestPrice);
  if (urls) {
    lines.push('');
    lines.push(urls);
  }

  if (rule) {
    lines.push('');
    lines.push(`Rule: ${describeRule(rule.kind, rule.value, rule.targetPrice)}`);
  }
  return lines.join('\n');
};

export const formatOutOfStockMessage = (data: SummaryData): string => {
  const { productName, rule, aggregated } = data;

  const lines: string[] = [];
  lines.push(`*Out of stock:* ${productName}`);
  lines.push('');
  lines.push('All retailers now showing out of stock.');

  const urls = renderUrlList(aggregated.results, aggregated.lowestPrice);
  if (urls) {
    lines.push('');
    lines.push(urls);
  }

  if (rule) {
    lines.push('');
    lines.push(`Rule: ${describeRule(rule.kind, rule.value, rule.targetPrice)}`);
  }
  return lines.join('\n');
};

export const formatTestMessage = (data: SummaryData): string => {
  const { productName, rule, aggregated, initialPrice, initialRetailer, percentageDecrease } = data;
  const lowestResult = aggregated.results.find((r) => r.price_aud === aggregated.lowestPrice);

  const lines: string[] = [];
  lines.push(`*Test message:* ${productName}`);
  lines.push('');
  if (initialPrice !== null) {
    const tail = initialRetailer ? ` (${initialRetailer})` : '';
    lines.push(`Initial: ${fmtPrice(initialPrice)}${tail}`);
  }
  if (aggregated.lowestPrice !== null) {
    const retailer = lowestResult?.retailer ?? '';
    const pct = percentageDecrease !== null ? `  ↓ ${percentageDecrease.toFixed(1)}%` : '';
    lines.push(`Lowest: ${fmtPrice(aggregated.lowestPrice)}${retailer ? ` (${retailer})` : ''}${pct}`);
  } else {
    lines.push('No price data yet — run a check first.');
  }

  const urls = renderUrlList(aggregated.results, aggregated.lowestPrice);
  if (urls) {
    lines.push('');
    lines.push(urls);
  }

  lines.push('');
  if (rule) {
    lines.push(`Rule: ${describeRule(rule.kind, rule.value, rule.targetPrice)}`);
  } else {
    lines.push('Rule: notifications disabled');
  }
  lines.push(`Checked: ${new Date(aggregated.checkedAt).toLocaleString('en-AU')}`);

  return lines.join('\n');
};
