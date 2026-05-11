/**
 * Reason code for a scrape failure. Free-form string today — extractor
 * strategies don't yet differentiate beyond "we got no usable data". Future
 * work to bubble specific causes (network, blocked, no_price_found, etc.) will
 * extend this set; consumers should treat unknown codes gracefully.
 */
export type ScrapeFailureReason =
  | 'extraction_failed'
  | (string & {});

export interface ScrapeFailure {
  id: number;
  product_url_id: number;
  reason: string;
  message: string | null;
  created_at: string;
}

/** Aggregated view of failure activity for a single URL. */
export interface UrlFailureSummary {
  product_url_id: number;
  last_failure_at: string | null;
  /** Count of failures in the last 24 hours. */
  failures_last_24h: number;
}
