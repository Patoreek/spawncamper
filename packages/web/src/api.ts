import type { Product, CreateProductInput, ProductUrl, CreateProductUrlInput, ApiResponse } from './types';

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
