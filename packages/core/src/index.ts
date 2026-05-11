// Products
export {
  createProduct,
  getProductById,
  getAllProducts,
  pauseProduct,
  activateProduct,
  archiveProduct,
  deleteProduct,
  updateNotifyRule,
} from './products/service';
export type {
  Product,
  CreateProductInput,
  ProductStatus,
  NotifyKind,
  NotifyRuleInput,
} from './products/types';

// Product URLs
export {
  createProductUrl,
  getProductUrlById,
  getProductUrlsForProduct,
  getAllProductUrls,
  pauseProductUrl,
  deleteProductUrl,
} from './product_urls/service';
export type { ProductUrl, CreateProductUrl } from './product_urls/types';

// Price Checker (scraping + persistence)
export {
  checkPrices,
  checkSingleUrl,
  checkAllProducts,
  getDataFromUrl,
} from './price_checker/service';
export type {
  UrlData,
  PriceCheckAggregatedData,
  PriceCheckUrlResult,
  CheckAllResult,
} from './price_checker/types';

// Price Checks (DB queries)
export {
  createPriceCheck,
  getPreviousPriceCheck,
  getAllPreviousPriceChecks,
  getLatestPriceChecksForProduct,
  getProductPriceSummary,
} from './price_checks/service';
export type { PriceCheck, PriceCheckResult, LatestPriceCheck, ProductPriceSummary } from './price_checks/types';

// Notifications
export {
  evaluateAndNotify,
  sendTestMessage,
  clearNotificationsFor,
} from './notifications/service';
export type {
  NotifyResult,
  NotifyDecision,
  NotificationKind,
  NotificationRecord,
} from './notifications/types';

// FX (currency conversion to AUD)
export { ensureRate, convertToAudOrNull } from './fx/service';

// Types
export type { ApiResponse, SuccessResponse, ErrorResponse } from './db/types';
