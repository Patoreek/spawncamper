import type {
  Product, CreateProductInput, ProductUrl, CreateProductUrlInput,
  ApiResponse, LatestPriceCheck, PriceCheckAggregatedData,
  PriceCheckUrlResult, UrlData, CronStatus, ProductPriceSummary,
  NotifyRuleInput, PriceHistoryPoint, UrlFailureSummary,
} from './types';

// ── Products ────────────────────────────────────────────

export async function fetchProducts(status?: string): Promise<Product[]> {
  const params = status ? `?status=${status}` : '';
  const res = await fetch(`/api/products${params}`);
  return res.json();
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function updateProductStatus(id: number, action: 'pause' | 'activate' | 'archive'): Promise<ApiResponse> {
  const res = await fetch(`/api/products/${id}/${action}`, { method: 'PATCH' });
  return res.json();
}

export async function deleteProduct(id: number): Promise<ApiResponse> {
  const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
  return res.json();
}

// ── Notifications ───────────────────────────────────────

export async function updateNotifyRule(id: number, rule: NotifyRuleInput): Promise<Product> {
  const res = await fetch(`/api/products/${id}/notify-rule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Failed to update rule');
  return data;
}

export async function sendNotifyTest(id: number): Promise<ApiResponse> {
  const res = await fetch(`/api/products/${id}/notify-test`, { method: 'POST' });
  return res.json();
}

// ── Product URLs ────────────────────────────────────────

export async function fetchProductUrls(productId: number): Promise<ProductUrl[]> {
  const res = await fetch(`/api/products/${productId}/urls`);
  return res.json();
}

export async function createProductUrl(productId: number, input: CreateProductUrlInput): Promise<ProductUrl> {
  const res = await fetch(`/api/products/${productId}/urls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function pauseProductUrl(id: number): Promise<ApiResponse> {
  const res = await fetch(`/api/product-urls/${id}/pause`, { method: 'PATCH' });
  return res.json();
}

export async function deleteProductUrl(id: number): Promise<ApiResponse> {
  const res = await fetch(`/api/product-urls/${id}`, { method: 'DELETE' });
  return res.json();
}

// ── Price Checks ────────────────────────────────────────

export async function fetchPriceSummary(productId: number): Promise<ProductPriceSummary> {
  const res = await fetch(`/api/products/${productId}/price-summary`);
  return res.json();
}

export async function fetchLatestPrices(productId: number): Promise<LatestPriceCheck[]> {
  const res = await fetch(`/api/products/${productId}/latest-prices`);
  return res.json();
}

export async function fetchPriceHistory(urlId: number): Promise<LatestPriceCheck[]> {
  const res = await fetch(`/api/product-urls/${urlId}/price-history`);
  return res.json();
}

export async function fetchProductPriceHistory(productId: number): Promise<PriceHistoryPoint[]> {
  const res = await fetch(`/api/products/${productId}/price-history`);
  return res.json();
}

export async function fetchUrlFailureSummaries(productId: number): Promise<UrlFailureSummary[]> {
  const res = await fetch(`/api/products/${productId}/url-failure-summaries`);
  return res.json();
}

export async function checkProductPrices(productId: number): Promise<PriceCheckAggregatedData> {
  const res = await fetch(`/api/products/${productId}/check-prices`, { method: 'POST' });
  return res.json();
}

export async function scanProductUrl(urlId: number): Promise<PriceCheckUrlResult> {
  const res = await fetch(`/api/product-urls/${urlId}/scan`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? 'Scan failed');
  }
  return data;
}

export async function scanArbitraryUrl(url: string): Promise<UrlData> {
  const res = await fetch('/api/scan-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

// ── Cron ────────────────────────────────────────────────

export async function fetchCronStatus(): Promise<CronStatus> {
  const res = await fetch('/api/cron/status');
  return res.json();
}

export async function triggerCronRun(): Promise<ApiResponse> {
  const res = await fetch('/api/cron/run', { method: 'POST' });
  return res.json();
}
