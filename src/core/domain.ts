import { parse } from 'tldts';

const TRACKABLE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Map a URL to the key Dwell tracks time under: the registrable ("base")
 * domain, e.g. `https://mobile.twitter.com/home` → `twitter.com`.
 * Returns `null` for anything that is not a regular web page
 * (browser pages, extension pages, files, data URLs, …).
 */
export function domainFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!TRACKABLE_PROTOCOLS.has(parsed.protocol)) return null;
  return domainFromHostname(parsed.hostname);
}

/** Base domain for a hostname; IPs and single-label hosts are returned as-is. */
export function domainFromHostname(hostname: string): string | null {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return null;
  const info = parse(host, { allowPrivateDomains: false });
  if (info.isIp) return host.replace(/^\[|\]$/g, '');
  if (info.domain) return info.domain;
  // e.g. `localhost` or an intranet host without a public suffix
  if (/^[a-z0-9-]+$/.test(host)) return host;
  return null;
}

/**
 * Normalise what a user types into a limit/ignore field:
 * `https://www.YouTube.com/shorts` → `youtube.com`. Returns `null` if invalid.
 */
export function normalizeDomainInput(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (!TRACKABLE_PROTOCOLS.has(url.protocol)) return null;
    const domain = domainFromHostname(url.hostname);
    // A bare word is almost always a typo ("youtube" instead of "youtube.com"),
    // so only accept dotted names, IPs and `localhost` from user input.
    if (domain && !domain.includes('.') && !domain.includes(':') && domain !== 'localhost') {
      return null;
    }
    return domain;
  } catch {
    return null;
  }
}

/** Parse a comma/space/newline separated list of domains, dropping invalid & duplicate ones. */
export function parseDomainList(input: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const part of input.split(/[\s,]+/)) {
    if (!part) continue;
    const d = normalizeDomainInput(part);
    if (d) {
      if (!valid.includes(d)) valid.push(d);
    } else {
      invalid.push(part);
    }
  }
  return { valid, invalid };
}
