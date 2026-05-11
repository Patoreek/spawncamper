/**
 * Per-domain promise queue with min-gap throttling.
 *
 * - `schedule(domain, fn)` runs `fn` after any prior tasks on the same domain
 *   have completed AND a minimum gap has elapsed since the previous attempt
 *   against that domain.
 * - Different domains run in parallel.
 * - A failure in `fn` does not block subsequent tasks on the same domain — the
 *   per-domain chain unblocks on settle, not on resolve.
 *
 * Replaces the older `for (...) await sleep(...)` pattern in `checkPrices` and
 * `checkAllProducts`: serial across the same retailer (politeness, bot
 * detection), parallel across different retailers (throughput).
 */
export class DomainScheduler {
  private readonly chains = new Map<string, Promise<unknown>>();
  private readonly lastAttempt = new Map<string, number>();
  private readonly minGapMs: number;
  private readonly jitterMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(opts: {
    minGapMs?: number;
    jitterMs?: number;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
  } = {}) {
    this.minGapMs = opts.minGapMs ?? 3000;
    this.jitterMs = opts.jitterMs ?? 2000;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = opts.now ?? Date.now;
  }

  schedule<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(domain) ?? Promise.resolve();

    const run = previous.then(async () => {
      const last = this.lastAttempt.get(domain) ?? 0;
      const elapsed = this.now() - last;
      const required = this.minGapMs + Math.random() * this.jitterMs;
      if (last > 0 && elapsed < required) {
        await this.sleep(required - elapsed);
      }
      this.lastAttempt.set(domain, this.now());
      return fn();
    });

    // Swallow rejections on the *chain* so a failure doesn't poison subsequent
    // tasks. Callers still observe the rejection on the returned promise.
    this.chains.set(domain, run.catch(() => {}));
    return run;
  }
}

/** Extract a stable scheduling key for a URL. Falls back to the raw string on parse failure. */
export const domainKey = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
};
