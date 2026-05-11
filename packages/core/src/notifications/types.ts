import type { NotifyKind } from '../products/types';
import type { PriceCheckAggregatedData } from '../price_checker/types';

export type { NotifyKind } from '../products/types';

export type NotificationKind = 'alert' | 'recovery' | 'test';

export interface NotificationRecord {
  id: number;
  product_id: number;
  kind: NotificationKind;
  price: number | null;
  sent_at: string;
}

export interface CreateNotificationInput {
  product_id: number;
  kind: NotificationKind;
  price: number | null;
}

export interface RuleEvaluation {
  matches: boolean;
  /** Threshold the rule is evaluating against (e.g. target price, computed from %). null for any_drop. */
  threshold: number | null;
}

export interface EvaluateContext {
  productId: number;
  rule: { kind: NotifyKind; value: number | null; targetPrice: number | null };
  /** Lowest current price across URLs in AUD. null when no URL has a current price. */
  currentLowest: number | null;
  initialPrice: number | null;
  previousLowest: number | null;
  /** Any URL currently in stock? null = no scrape data this run. */
  currentlyInStock: boolean | null;
  /** Any URL previously in stock? null = no previous data at all. */
  previouslyInStock: boolean | null;
}

export type NotifyDecision =
  | { action: 'none' }
  | { action: 'alert'; price: number; previousLowest: number | null }
  | { action: 'recovery'; price: number; alertPrice: number };

export interface NotifyResult {
  decision: NotifyDecision;
  /** True if a message was actually dispatched to the messenger. */
  sent: boolean;
  /** Set when sent=false and messenger config is missing. */
  skippedReason?: string;
}

export interface SummaryData {
  productName: string;
  rule: { kind: NotifyKind; value: number | null; targetPrice: number | null } | null;
  aggregated: PriceCheckAggregatedData;
  initialPrice: number | null;
  initialRetailer: string | null;
  percentageDecrease: number | null;
}
