import { describe, expect, it, vi } from 'vitest';
import { retry, retryNull } from './retry';

const noSleep = () => Promise.resolve();

describe('retryNull', () => {
  it('returns the first non-null result without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retryNull(fn, { maxAttempts: 3, backoffMs: () => 10, sleep: noSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on null and returns the eventual success', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('ok');
    const result = await retryNull(fn, { maxAttempts: 3, backoffMs: () => 10, sleep: noSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns null when every attempt is null', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const result = await retryNull(fn, { maxAttempts: 3, backoffMs: () => 10, sleep: noSleep });
    expect(result).toBeNull();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects maxAttempts=1 (no retry)', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const result = await retryNull(fn, { maxAttempts: 1, backoffMs: () => 10, sleep: noSleep });
    expect(result).toBeNull();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls sleep with the value produced by backoffMs, between attempts only', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const backoffMs = vi.fn((n: number) => n * 100);

    await retryNull(fn, { maxAttempts: 3, backoffMs, sleep });

    // 3 attempts → 2 inter-attempt sleeps
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('does not sleep after the final attempt fails', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await retryNull(fn, { maxAttempts: 2, backoffMs: () => 5, sleep });
    expect(sleep).toHaveBeenCalledTimes(1); // only between attempts 1 and 2
  });

  it('does not sleep when fn succeeds on the first try', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    await retryNull(() => Promise.resolve('x'), { maxAttempts: 5, backoffMs: () => 9999, sleep });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('throws when maxAttempts is < 1', async () => {
    await expect(
      retryNull(() => Promise.resolve('x'), { maxAttempts: 0, backoffMs: () => 0 }),
    ).rejects.toThrow(/maxAttempts/);
  });
});

describe('retry (generic)', () => {
  type Result = { ok: boolean; retryable?: boolean };

  it('uses the supplied predicate to decide retry vs stop', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ ok: false, retryable: true })
      .mockResolvedValueOnce({ ok: false, retryable: true })
      .mockResolvedValueOnce({ ok: true });
    const result = await retry<Result>(
      fn,
      (r) => !r.ok && r.retryable === true,
      { maxAttempts: 5, backoffMs: () => 1, sleep: noSleep },
    );
    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops immediately on a non-retryable failure', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, retryable: false });
    const result = await retry<Result>(
      fn,
      (r) => !r.ok && r.retryable === true,
      { maxAttempts: 5, backoffMs: () => 1, sleep: noSleep },
    );
    expect(result).toEqual({ ok: false, retryable: false });
    // Single call — predicate returned false (don't retry), we stop.
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns the last result when retries are exhausted', async () => {
    let n = 0;
    const fn = vi.fn(async (): Promise<Result> => ({ ok: false, retryable: true, ...{ attempt: ++n } } as Result));
    const result = await retry<Result>(
      fn,
      (r) => !r.ok && r.retryable === true,
      { maxAttempts: 3, backoffMs: () => 1, sleep: noSleep },
    );
    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
