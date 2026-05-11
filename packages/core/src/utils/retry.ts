export interface RetryOptions {
  /** Total attempts including the first call. Must be >= 1. */
  maxAttempts: number;
  /**
   * Delay before attempt `n` (1-indexed; n=1 means the delay before the
   * *second* attempt, since attempt 1 is the initial call with no delay).
   */
  backoffMs: (attempt: number) => number;
  /** Sleep injection — tests pass an instantaneous resolver. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn` up to `maxAttempts` times, retrying while `shouldRetry(result)` is
 * true. Returns the final result (which may be the success or the last failure
 * — interpretation is up to the caller).
 *
 * Errors are NOT caught — callers should pass a function that swallows its own
 * exceptions. This keeps the utility orthogonal: it decides what counts as
 * "retryable", not what counts as "errored".
 */
export async function retry<T>(
  fn: () => Promise<T>,
  shouldRetry: (result: T) => boolean,
  opts: RetryOptions,
): Promise<T> {
  if (opts.maxAttempts < 1) {
    throw new Error('retry: maxAttempts must be >= 1');
  }
  const sleep = opts.sleep ?? defaultSleep;
  let last: T;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    last = await fn();
    if (!shouldRetry(last)) return last;
    if (attempt < opts.maxAttempts) {
      await sleep(opts.backoffMs(attempt));
    }
  }
  return last!;
}

/**
 * Compatibility wrapper for the original null-retry semantics: retries while
 * `fn` returns `null`. Returns the first non-null result, or null when every
 * attempt produced null.
 */
export async function retryNull<T>(
  fn: () => Promise<T | null>,
  opts: RetryOptions,
): Promise<T | null> {
  return retry<T | null>(fn, (r) => r === null, opts);
}
