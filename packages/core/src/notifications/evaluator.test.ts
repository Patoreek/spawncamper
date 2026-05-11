import { describe, it, expect } from 'vitest';
import { decide, evaluateRule } from './evaluator';
import type {
  EvaluateContext,
  NotificationRecord,
  RuleEvaluation,
} from './types';

// ── Helpers ──────────────────────────────────────────────

const ctx = (overrides: Partial<EvaluateContext> = {}): EvaluateContext => ({
  productId: 1,
  rule: { kind: 'any_drop', value: null, targetPrice: null },
  currentLowest: 100,
  initialPrice: 200,
  previousLowest: 150,
  currentlyInStock: true,
  previouslyInStock: true,
  ...overrides,
});

const alertRecord = (price: number | null = 120): NotificationRecord => ({
  id: 1,
  product_id: 1,
  kind: 'alert',
  price,
  sent_at: '2026-01-01T00:00:00Z',
});

const recoveryRecord = (price: number | null = 130): NotificationRecord => ({
  id: 2,
  product_id: 1,
  kind: 'recovery',
  price,
  sent_at: '2026-01-02T00:00:00Z',
});

const matched = (threshold: number | null = null): RuleEvaluation => ({
  matches: true,
  threshold,
});
const unmatched: RuleEvaluation = { matches: false, threshold: null };

// ── evaluateRule ────────────────────────────────────────

describe('evaluateRule — any_drop', () => {
  it('does not match when there is no previous price', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'any_drop', value: null, targetPrice: null }, previousLowest: null })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('matches when current is strictly lower than previous', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'any_drop', value: null, targetPrice: null }, currentLowest: 100, previousLowest: 150 })),
    ).toEqual({ matches: true, threshold: null });
  });

  it('does not match when current equals previous', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'any_drop', value: null, targetPrice: null }, currentLowest: 150, previousLowest: 150 })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('does not match when current is higher than previous', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'any_drop', value: null, targetPrice: null }, currentLowest: 160, previousLowest: 150 })),
    ).toEqual({ matches: false, threshold: null });
  });
});

describe('evaluateRule — target_price', () => {
  it('does not match when target is null', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'target_price', value: null, targetPrice: null } })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('matches when current is below target', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'target_price', value: null, targetPrice: 120 }, currentLowest: 100 })),
    ).toEqual({ matches: true, threshold: 120 });
  });

  it('matches when current equals target (inclusive)', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'target_price', value: null, targetPrice: 100 }, currentLowest: 100 })),
    ).toEqual({ matches: true, threshold: 100 });
  });

  it('does not match when current is above target', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'target_price', value: null, targetPrice: 80 }, currentLowest: 100 })),
    ).toEqual({ matches: false, threshold: 80 });
  });
});

describe('evaluateRule — percent_below_initial', () => {
  it('does not match when initial price is null', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'percent_below_initial', value: 20, targetPrice: null }, initialPrice: null })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('does not match when value is null', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'percent_below_initial', value: null, targetPrice: null } })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('matches when current is below the percent threshold', () => {
    // initial=200, value=25 → threshold=150. current=120 <= 150 ✓
    expect(
      evaluateRule(ctx({ rule: { kind: 'percent_below_initial', value: 25, targetPrice: null }, initialPrice: 200, currentLowest: 120 })),
    ).toEqual({ matches: true, threshold: 150 });
  });

  it('matches when current equals the percent threshold (inclusive)', () => {
    // initial=200, value=25 → threshold=150. current=150 → match
    expect(
      evaluateRule(ctx({ rule: { kind: 'percent_below_initial', value: 25, targetPrice: null }, initialPrice: 200, currentLowest: 150 })),
    ).toEqual({ matches: true, threshold: 150 });
  });

  it('does not match when current is above the percent threshold', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'percent_below_initial', value: 25, targetPrice: null }, initialPrice: 200, currentLowest: 160 })),
    ).toEqual({ matches: false, threshold: 150 });
  });

  it('treats initial=0 as a degenerate threshold of 0', () => {
    // initial=0 → threshold=0. current=0 → match (degenerate but consistent).
    expect(
      evaluateRule(ctx({ rule: { kind: 'percent_below_initial', value: 25, targetPrice: null }, initialPrice: 0, currentLowest: 0 })),
    ).toEqual({ matches: true, threshold: 0 });
  });
});

describe('evaluateRule — back_in_stock', () => {
  const stockRule: EvaluateContext['rule'] = { kind: 'back_in_stock', value: null, targetPrice: null };

  it('does not match when previouslyInStock is null (no previous data)', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, currentlyInStock: true, previouslyInStock: null })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('does not match when currentlyInStock is null (no scrape data)', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, currentlyInStock: null, previouslyInStock: false })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('matches on the out→in transition', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, previouslyInStock: false, currentlyInStock: true })),
    ).toEqual({ matches: true, threshold: null });
  });

  it('does not match when stock has stayed in', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, previouslyInStock: true, currentlyInStock: true })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('does not match when stock has stayed out', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, previouslyInStock: false, currentlyInStock: false })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('does not match on the in→out transition (that is out_of_stock territory)', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, previouslyInStock: true, currentlyInStock: false })),
    ).toEqual({ matches: false, threshold: null });
  });
});

describe('evaluateRule — out_of_stock', () => {
  const stockRule: EvaluateContext['rule'] = { kind: 'out_of_stock', value: null, targetPrice: null };

  it('does not match when stock context is null', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, currentlyInStock: null, previouslyInStock: true })),
    ).toEqual({ matches: false, threshold: null });
    expect(
      evaluateRule(ctx({ rule: stockRule, currentlyInStock: false, previouslyInStock: null })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('matches on the in→out transition', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, previouslyInStock: true, currentlyInStock: false })),
    ).toEqual({ matches: true, threshold: null });
  });

  it('does not match on the out→in transition', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, previouslyInStock: false, currentlyInStock: true })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('does not match when stock has stayed in', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, previouslyInStock: true, currentlyInStock: true })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('does not match when stock has stayed out', () => {
    expect(
      evaluateRule(ctx({ rule: stockRule, previouslyInStock: false, currentlyInStock: false })),
    ).toEqual({ matches: false, threshold: null });
  });
});

describe('evaluateRule — absolute_below', () => {
  it('does not match when value is null', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'absolute_below', value: null, targetPrice: null } })),
    ).toEqual({ matches: false, threshold: null });
  });

  it('matches when current is strictly below the threshold', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'absolute_below', value: 100, targetPrice: null }, currentLowest: 99.99 })),
    ).toEqual({ matches: true, threshold: 100 });
  });

  it('does not match when current equals the threshold (exclusive)', () => {
    // NOTE: absolute_below uses strict `<` while target_price uses `<=`.
    // If this assertion ever flips, that decision was changed deliberately
    // and the formatter / docs should be updated to match.
    expect(
      evaluateRule(ctx({ rule: { kind: 'absolute_below', value: 100, targetPrice: null }, currentLowest: 100 })),
    ).toEqual({ matches: false, threshold: 100 });
  });

  it('does not match when current is above the threshold', () => {
    expect(
      evaluateRule(ctx({ rule: { kind: 'absolute_below', value: 100, targetPrice: null }, currentLowest: 101 })),
    ).toEqual({ matches: false, threshold: 100 });
  });
});

// ── decide ───────────────────────────────────────────────

describe('evaluateRule — no current price', () => {
  it('every price rule returns no-match when currentLowest is null', () => {
    const kinds: Array<EvaluateContext['rule']> = [
      { kind: 'any_drop', value: null, targetPrice: null },
      { kind: 'target_price', value: null, targetPrice: 100 },
      { kind: 'percent_below_initial', value: 25, targetPrice: null },
      { kind: 'absolute_below', value: 100, targetPrice: null },
    ];
    for (const rule of kinds) {
      expect(
        evaluateRule(ctx({ rule, currentLowest: null })),
      ).toEqual({ matches: false, threshold: null });
    }
  });
});

describe('decide — matches=true', () => {
  it('alerts when there is no prior notification', () => {
    expect(decide(ctx({ currentLowest: 90, previousLowest: 100 }), matched(), null)).toEqual({
      action: 'alert',
      price: 90,
      previousLowest: 100,
    });
  });

  it('alerts when the prior notification was a recovery', () => {
    expect(decide(ctx({ currentLowest: 90 }), matched(), recoveryRecord(120))).toEqual({
      action: 'alert',
      price: 90,
      previousLowest: 150,
    });
  });

  it('re-alerts when current is strictly below the last alert price', () => {
    expect(decide(ctx({ currentLowest: 100 }), matched(), alertRecord(120))).toEqual({
      action: 'alert',
      price: 100,
      previousLowest: 150,
    });
  });

  it('does not re-alert when current equals the last alert price', () => {
    expect(decide(ctx({ currentLowest: 120 }), matched(), alertRecord(120))).toEqual({
      action: 'none',
    });
  });

  it('does not re-alert when current is above the last alert price', () => {
    // Match still holds (e.g. still under target) but the price is higher than
    // last alert — staying quiet is correct.
    expect(decide(ctx({ currentLowest: 130 }), matched(), alertRecord(120))).toEqual({
      action: 'none',
    });
  });

  it('does not re-alert when the latest alert has a null stored price', () => {
    expect(decide(ctx({ currentLowest: 50 }), matched(), alertRecord(null))).toEqual({
      action: 'none',
    });
  });
});

describe('decide — stock rules', () => {
  const backInStock: EvaluateContext['rule'] = { kind: 'back_in_stock', value: null, targetPrice: null };
  const outOfStock: EvaluateContext['rule'] = { kind: 'out_of_stock', value: null, targetPrice: null };

  it('back_in_stock alerts on match regardless of latest notification', () => {
    // The state machine for price rules would skip a re-alert here; stock
    // rules deliberately bypass that because the match itself encodes a
    // discrete transition.
    expect(
      decide(
        ctx({ rule: backInStock, previouslyInStock: false, currentlyInStock: true, currentLowest: 89 }),
        matched(),
        alertRecord(95),
      ),
    ).toEqual({ action: 'alert', price: 89, previousLowest: null });
  });

  it('back_in_stock alerts with price=0 when current price unavailable', () => {
    expect(
      decide(
        ctx({ rule: backInStock, previouslyInStock: false, currentlyInStock: true, currentLowest: null }),
        matched(),
        null,
      ),
    ).toEqual({ action: 'alert', price: 0, previousLowest: null });
  });

  it('back_in_stock does nothing when not matching', () => {
    expect(
      decide(
        ctx({ rule: backInStock, previouslyInStock: true, currentlyInStock: true }),
        unmatched,
        alertRecord(50),
      ),
    ).toEqual({ action: 'none' });
  });

  it('out_of_stock alerts on the in→out transition', () => {
    expect(
      decide(
        ctx({ rule: outOfStock, previouslyInStock: true, currentlyInStock: false, currentLowest: 50 }),
        matched(),
        null,
      ),
    ).toEqual({ action: 'alert', price: 50, previousLowest: null });
  });

  it('stock rules never emit recovery', () => {
    expect(
      decide(
        ctx({ rule: backInStock, previouslyInStock: true, currentlyInStock: true }),
        unmatched,
        alertRecord(89),
      ),
    ).toEqual({ action: 'none' });
  });
});

describe('decide — matches=false', () => {
  it('emits recovery when last alert was a state rule (target_price)', () => {
    expect(
      decide(
        ctx({ rule: { kind: 'target_price', value: null, targetPrice: 100 }, currentLowest: 130 }),
        unmatched,
        alertRecord(95),
      ),
    ).toEqual({ action: 'recovery', price: 130, alertPrice: 95 });
  });

  it('emits recovery when last alert was percent_below_initial', () => {
    expect(
      decide(
        ctx({ rule: { kind: 'percent_below_initial', value: 25, targetPrice: null }, currentLowest: 200 }),
        unmatched,
        alertRecord(140),
      ),
    ).toEqual({ action: 'recovery', price: 200, alertPrice: 140 });
  });

  it('emits recovery when last alert was absolute_below', () => {
    expect(
      decide(
        ctx({ rule: { kind: 'absolute_below', value: 100, targetPrice: null }, currentLowest: 150 }),
        unmatched,
        alertRecord(90),
      ),
    ).toEqual({ action: 'recovery', price: 150, alertPrice: 90 });
  });

  it('falls back to currentLowest as the alertPrice when the alert record has null price', () => {
    expect(
      decide(
        ctx({ rule: { kind: 'target_price', value: null, targetPrice: 100 }, currentLowest: 130 }),
        unmatched,
        alertRecord(null),
      ),
    ).toEqual({ action: 'recovery', price: 130, alertPrice: 130 });
  });

  it('does NOT recover when last alert was any_drop (no recovery semantics)', () => {
    expect(
      decide(
        ctx({ rule: { kind: 'any_drop', value: null, targetPrice: null } }),
        unmatched,
        alertRecord(95),
      ),
    ).toEqual({ action: 'none' });
  });

  it('does nothing when the last notification was already a recovery', () => {
    expect(
      decide(
        ctx({ rule: { kind: 'target_price', value: null, targetPrice: 100 } }),
        unmatched,
        recoveryRecord(130),
      ),
    ).toEqual({ action: 'none' });
  });

  it('does nothing when there is no prior notification', () => {
    expect(
      decide(
        ctx({ rule: { kind: 'target_price', value: null, targetPrice: 100 } }),
        unmatched,
        null,
      ),
    ).toEqual({ action: 'none' });
  });
});
