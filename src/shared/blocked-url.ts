/**
 * Read the block page's query string. Two formats reach it:
 *  - `?limit=<id>&raw=<url>` from declarativeNetRequest redirects, where the
 *    original URL is appended unencoded and therefore must be the last parameter;
 *  - `?limit=<id>&url=<encoded url>` when Dwell redirects an already-open tab.
 * Only http(s) URLs are returned, so the page can never be used to open
 * `javascript:` or other unexpected schemes.
 */
export function parseBlockedParams(search: string): {
  limitId: string | null;
  original: string | null;
} {
  let query = search;
  let original: string | null = null;
  const rawIdx = search.indexOf('&raw=');
  if (rawIdx >= 0) {
    original = search.slice(rawIdx + 5);
    query = search.slice(0, rawIdx);
  }
  const params = new URLSearchParams(query);
  original ??= params.get('url');
  if (original) {
    try {
      const u = new URL(original);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') original = null;
    } catch {
      original = null;
    }
  }
  return { limitId: params.get('limit') || null, original };
}
