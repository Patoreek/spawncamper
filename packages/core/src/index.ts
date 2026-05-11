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
  ExtractResult,
  FailureReason,
} from './price_checker/types';

// Price Checks (DB queries)
export {
  createPriceCheck,
  getPreviousPriceCheck,
  getAllPreviousPriceChecks,
  getLatestPriceChecksForProduct,
  getProductPriceSummary,
  getProductPriceHistory,
} from './price_checks/service';
export type {
  PriceCheck,
  PriceCheckResult,
  LatestPriceCheck,
  ProductPriceSummary,
  PriceHistoryPoint,
} from './price_checks/types';

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

// Affiliate link rewriting (Amazon partner tag)
export { withAffiliateTag } from './affiliate/service';

// Scrape failure logging
export {
  recordScrapeFailure,
  getRecentFailuresForUrl,
  getFailureSummaryForUrl,
  getFailureSummariesForProduct,
} from './price_check_failures/service';
export type {
  ScrapeFailure,
  ScrapeFailureReason,
  UrlFailureSummary,
} from './price_check_failures/types';

// Cron / scheduled-run tracking
export { runPriceCheck, sweepStaleRunning, getCronStatus } from './cron/service';
export type {
  CronRun,
  CronRunSource,
  CronRunStatus,
  CronStatusView,
  RunPriceCheckResult,
} from './cron/types';

// Types
export type { ApiResponse, SuccessResponse, ErrorResponse } from './db/types';
