import type { EvaluateContext, NotificationRecord, NotifyDecision, RuleEvaluation } from './types';

/**
 * Rule values are interpreted as AUD. `currentLowest`, `initialPrice` and
 * `previousLowest` in the context are already AUD-converted by the caller, so
 * comparisons here are all in the same denomination.
 */
export const evaluateRule = (ctx: EvaluateContext): RuleEvaluation => {
  const { rule, currentLowest, initialPrice, previousLowest } = ctx;

  switch (rule.kind) {
    case 'any_drop': {
      if (previousLowest === null) return { matches: false, threshold: null };
      return { matches: currentLowest < previousLowest, threshold: null };
    }
    case 'target_price': {
      if (rule.targetPrice === null) return { matches: false, threshold: null };
      return { matches: currentLowest <= rule.targetPrice, threshold: rule.targetPrice };
    }
    case 'percent_below_initial': {
      if (initialPrice === null || rule.value === null) return { matches: false, threshold: null };
      const threshold = initialPrice * (1 - rule.value / 100);
      return { matches: currentLowest <= threshold, threshold };
    }
    case 'absolute_below': {
      if (rule.value === null) return { matches: false, threshold: null };
      return { matches: currentLowest < rule.value, threshold: rule.value };
    }
  }
};

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
