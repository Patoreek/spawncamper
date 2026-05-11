import type { EvaluateContext, NotificationRecord, NotifyDecision, NotifyKind, RuleEvaluation } from './types';

/**
 * Rule values are interpreted as AUD. `currentLowest`, `initialPrice` and
 * `previousLowest` in the context are already AUD-converted by the caller, so
 * comparisons here are all in the same denomination.
 */
export const evaluateRule = (ctx: EvaluateContext): RuleEvaluation => {
  const { rule, currentLowest, initialPrice, previousLowest, currentlyInStock, previouslyInStock } = ctx;

  switch (rule.kind) {
    case 'any_drop': {
      if (currentLowest === null || previousLowest === null) return { matches: false, threshold: null };
      return { matches: currentLowest < previousLowest, threshold: null };
    }
    case 'target_price': {
      if (currentLowest === null || rule.targetPrice === null) return { matches: false, threshold: null };
      return { matches: currentLowest <= rule.targetPrice, threshold: rule.targetPrice };
    }
    case 'percent_below_initial': {
      if (currentLowest === null || initialPrice === null || rule.value === null) return { matches: false, threshold: null };
      const threshold = initialPrice * (1 - rule.value / 100);
      return { matches: currentLowest <= threshold, threshold };
    }
    case 'absolute_below': {
      if (currentLowest === null || rule.value === null) return { matches: false, threshold: null };
      return { matches: currentLowest < rule.value, threshold: rule.value };
    }
    case 'back_in_stock': {
      if (currentlyInStock === null || previouslyInStock === null) return { matches: false, threshold: null };
      return { matches: !previouslyInStock && currentlyInStock, threshold: null };
    }
    case 'out_of_stock': {
      if (currentlyInStock === null || previouslyInStock === null) return { matches: false, threshold: null };
      return { matches: previouslyInStock && !currentlyInStock, threshold: null };
    }
  }
};

const isStockKind = (k: NotifyKind): boolean =>
  k === 'back_in_stock' || k === 'out_of_stock';

/**
 * State machine that decides what notification (if any) to fire.
 *
 *   matches?  | latest notification  | decision
 *   --------- | -------------------- | ---------------------------------------------
 *   yes       | none / recovery      | alert
 *   yes       | alert at price P     | alert if currentLowest < P, else none
 *   no        | alert (state rule)   | recovery
 *   no        | alert (any_drop)     | none (any_drop has no recovery semantic)
 *   no        | none / recovery      | none
 */
export const decide = (
  ctx: EvaluateContext,
  evaluation: RuleEvaluation,
  latest: NotificationRecord | null,
): NotifyDecision => {
  const { currentLowest, previousLowest, rule } = ctx;

  // Stock rules: every `matches=true` represents a discrete transition that
  // by construction can only fire once per state flip. No re-alert dedupe and
  // no recovery semantics — the symmetric rule (back_in_stock ↔ out_of_stock)
  // exists for users who want the inverse signal.
  if (isStockKind(rule.kind)) {
    if (!evaluation.matches) return { action: 'none' };
    return { action: 'alert', price: currentLowest ?? 0, previousLowest: null };
  }

  // Price rules: currentLowest must be non-null because evaluateRule already
  // requires it to evaluate any price-based match.
  if (currentLowest === null) return { action: 'none' };

  if (evaluation.matches) {
    if (latest?.kind === 'alert') {
      if (latest.price !== null && currentLowest < latest.price) {
        return { action: 'alert', price: currentLowest, previousLowest };
      }
      return { action: 'none' };
    }
    return { action: 'alert', price: currentLowest, previousLowest };
  }

  // Rule doesn't match.
  if (latest?.kind === 'alert' && rule.kind !== 'any_drop') {
    return { action: 'recovery', price: currentLowest, alertPrice: latest.price ?? currentLowest };
  }
  return { action: 'none' };
};
