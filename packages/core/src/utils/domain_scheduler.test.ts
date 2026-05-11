import { describe, expect, it, vi } from 'vitest';
import { DomainScheduler, domainKey } from './domain_scheduler';

// Controlled clock + sleep so tests are deterministic. We advance `now` by
// whatever amount the scheduler asks `sleep` for.
const makeClock = () => {
  let t = 1_000_000;
  const sleep = vi.fn(async (ms: number) => { t += ms; });
  const now = () => t;
  const advance = (ms: number) => { t += ms; };
  return { sleep, now, advance };
};

describe('domainKey', () => {
  it('extracts hostname from a URL', () => {
    expect(domainKey('https://www.example.com/foo')).toBe('www.example.com');
  });

  it('lowercases', () => {
    expect(domainKey('https://Example.COM/x')).toBe('example.com');
  });

  it('falls back to the raw string for unparseable input', () => {
    expect(domainKey('not a url')).toBe('not a url');
  });
});

describe('DomainScheduler', () => {
  it('serialises tasks on the same domain', async () => {
    const { sleep, now } = makeClock();
    const sched = new DomainScheduler({ minGapMs: 0, jitterMs: 0, sleep, now });

    const order: string[] = [];
    const a = sched.schedule('host', async () => { order.push('a-start'); await Promise.resolve(); order.push('a-end'); return 'a'; });
    const b = sched.schedule('host', async () => { order.push('b-start'); await Promise.resolve(); order.push('b-end'); return 'b'; });

    expect(await Promise.all([a, b])).toEqual(['a', 'b']);
    expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
  });

  it('runs tasks on different domains in parallel', async () => {
    const { sleep, now } = makeClock();
    const sched = new DomainScheduler({ minGapMs: 0, jitterMs: 0, sleep, now });

    let aStarted = false;
    let bStarted = false;
    const a = sched.schedule('host-a', async () => {
      aStarted = true;
      // b should be able to start before a resolves
      await new Promise<void>((r) => setTimeout(r, 1));
      return 'a';
    });
    const b = sched.schedule('host-b', async () => {
      bStarted = true;
      return 'b';
    });

    await b;
    expect(aStarted).toBe(true);
    expect(bStarted).toBe(true);
    await a;
  });

  it('enforces minGap between same-domain attempts', async () => {
    const { sleep, now } = makeClock();
    const sched = new DomainScheduler({ minGapMs: 3000, jitterMs: 0, sleep, now });

    await sched.schedule('host', async () => 'a');
    // First task: no prior, no sleep called
    expect(sleep).not.toHaveBeenCalled();

    await sched.schedule('host', async () => 'b');
    // Second task: needs ~3000ms wait
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(expect.any(Number));
    const waited = sleep.mock.calls[0][0];
    expect(waited).toBeGreaterThanOrEqual(2999);
  });

  it('does NOT enforce gap between different domains', async () => {
    const { sleep, now } = makeClock();
    const sched = new DomainScheduler({ minGapMs: 3000, jitterMs: 0, sleep, now });

    await sched.schedule('host-a', async () => 'a');
    await sched.schedule('host-b', async () => 'b');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does not block subsequent same-domain tasks after a failure', async () => {
    const { sleep, now } = makeClock();
    const sched = new DomainScheduler({ minGapMs: 0, jitterMs: 0, sleep, now });

    const a = sched.schedule('host', async () => { throw new Error('boom'); });
    const b = sched.schedule('host', async () => 'recovered');

    await expect(a).rejects.toThrow('boom');
    await expect(b).resolves.toBe('recovered');
  });

  it('skips waiting when enough time has already elapsed since the prior attempt', async () => {
    const { sleep, now, advance } = makeClock();
    const sched = new DomainScheduler({ minGapMs: 3000, jitterMs: 0, sleep, now });

    await sched.schedule('host', async () => 'a');
    advance(5000); // longer than minGap
    await sched.schedule('host', async () => 'b');
    expect(sleep).not.toHaveBeenCalled();
  });
});
