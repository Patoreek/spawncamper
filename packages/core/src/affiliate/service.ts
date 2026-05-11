/**
 * Rewrites an Amazon product URL to include the configured Associates partner
 * tag. No-op for non-Amazon hostnames, empty/missing tag, or unparseable URLs.
 *
 * `partnerTag` defaults to `process.env.AMAZON_PARTNER_TAG` so production
 * callers can use the bare `withAffiliateTag(url)` form while tests can pass
 * the tag explicitly without mutating global env.
 */
export const withAffiliateTag = (url: string, partnerTag?: string): string => {
  const tag = (partnerTag ?? process.env.AMAZON_PARTNER_TAG ?? '').trim();
  if (!tag) return url;
  if (!isAmazonHostname(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('tag', tag);
    return u.toString();
  } catch {
    return url;
  }
};

const isAmazonHostname = (url: string): boolean => {
  try {
    // Matches amazon.com, amazon.com.au, amazon.co.uk, amazon.de, etc. — but
    // not unrelated hosts that happen to contain "amazon" elsewhere.
    const host = new URL(url).hostname.toLowerCase();
    return host === 'amazon' || host.startsWith('amazon.') || host.includes('.amazon.');
  } catch {
    return false;
  }
};
