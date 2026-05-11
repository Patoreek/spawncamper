import { describe, expect, it } from 'vitest';
import { withAffiliateTag } from './service';

const TAG = 'spawncamper-20';

describe('withAffiliateTag', () => {
  it('returns the URL unchanged when no partner tag is configured', () => {
    expect(withAffiliateTag('https://www.amazon.com/dp/B0EXAMPLE', '')).toBe('https://www.amazon.com/dp/B0EXAMPLE');
  });

  it('returns the URL unchanged for non-Amazon hostnames', () => {
    expect(withAffiliateTag('https://www.bestbuy.com/p/123', TAG)).toBe('https://www.bestbuy.com/p/123');
  });

  it('does not match hostnames that merely contain "amazon" as a substring', () => {
    // amazonbasics-replicas.example.com isn't Amazon — make sure we don't
    // accidentally rewrite it.
    expect(withAffiliateTag('https://fake-amazon.example.com/p/1', TAG)).toBe('https://fake-amazon.example.com/p/1');
  });

  it('appends a tag to an Amazon URL with no query string', () => {
    expect(withAffiliateTag('https://www.amazon.com/dp/B0EXAMPLE', TAG))
      .toBe(`https://www.amazon.com/dp/B0EXAMPLE?tag=${TAG}`);
  });

  it('appends a tag to an Amazon AU URL', () => {
    expect(withAffiliateTag('https://www.amazon.com.au/dp/B0EXAMPLE', TAG))
      .toBe(`https://www.amazon.com.au/dp/B0EXAMPLE?tag=${TAG}`);
  });

  it('replaces an existing tag rather than duplicating it', () => {
    expect(withAffiliateTag(`https://www.amazon.com/dp/B0EXAMPLE?tag=someone-else`, TAG))
      .toBe(`https://www.amazon.com/dp/B0EXAMPLE?tag=${TAG}`);
  });

  it('preserves other query params alongside the tag', () => {
    const result = withAffiliateTag('https://www.amazon.com/dp/B0EXAMPLE?ref=abc&keywords=foo', TAG);
    const u = new URL(result);
    expect(u.searchParams.get('ref')).toBe('abc');
    expect(u.searchParams.get('keywords')).toBe('foo');
    expect(u.searchParams.get('tag')).toBe(TAG);
  });

  it('returns the original string for unparseable URLs', () => {
    expect(withAffiliateTag('not a url at all', TAG)).toBe('not a url at all');
  });
});
