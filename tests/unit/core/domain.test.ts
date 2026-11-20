import { describe, it, expect } from 'vitest';
import {
  domainFromUrl,
  domainFromHostname,
  normalizeDomainInput,
  parseDomainList,
} from '../../../src/core/domain';

describe('domainFromUrl', () => {
  it('maps subdomains to the registrable base domain', () => {
    expect(domainFromUrl('https://mobile.twitter.com/home')).toBe('twitter.com');
    expect(domainFromUrl('https://www.bbc.co.uk/news')).toBe('bbc.co.uk');
    expect(domainFromUrl('http://example.com')).toBe('example.com');
  });

  it('lowercases the host and drops a trailing dot', () => {
    expect(domainFromUrl('https://WWW.Example.COM./path')).toBe('example.com');
  });

  it('returns null for non-http protocols', () => {
    expect(domainFromUrl('chrome://extensions')).toBeNull();
    expect(domainFromUrl('about:blank')).toBeNull();
    expect(domainFromUrl('file:///C:/notes/index.html')).toBeNull();
    expect(domainFromUrl('chrome-extension://abcdef/popup.html')).toBeNull();
    expect(domainFromUrl('data:text/plain,hello')).toBeNull();
    expect(domainFromUrl('javascript:alert(1)')).toBeNull();
  });

  it('returns null for invalid, empty or missing input', () => {
    expect(domainFromUrl('not a url')).toBeNull();
    expect(domainFromUrl('https://')).toBeNull();
    expect(domainFromUrl('')).toBeNull();
    expect(domainFromUrl(undefined)).toBeNull();
    expect(domainFromUrl(null)).toBeNull();
  });

  it('returns IPv4 addresses as-is', () => {
    expect(domainFromUrl('http://192.168.1.10:8080/x')).toBe('192.168.1.10');
  });

  it('returns IPv6 addresses without brackets', () => {
    expect(domainFromUrl('http://[::1]:3000/')).toBe('::1');
  });

  it('keeps localhost and single-label intranet hosts', () => {
    expect(domainFromUrl('http://localhost:5173/')).toBe('localhost');
    expect(domainFromUrl('http://intranet/wiki')).toBe('intranet');
  });
});

describe('domainFromHostname', () => {
  it('returns the registrable domain of a hostname', () => {
    expect(domainFromHostname('foo.bar.co.uk')).toBe('bar.co.uk');
    expect(domainFromHostname('LOCALHOST')).toBe('localhost');
  });

  it('returns null for blank hostnames', () => {
    expect(domainFromHostname('')).toBeNull();
    expect(domainFromHostname('   ')).toBeNull();
  });

  it('handles IPs and strips brackets from IPv6', () => {
    expect(domainFromHostname('10.0.0.1')).toBe('10.0.0.1');
    expect(domainFromHostname('[::1]')).toBe('::1');
  });
});

describe('normalizeDomainInput', () => {
  it('strips scheme, www, path and case', () => {
    expect(normalizeDomainInput('https://www.YouTube.com/shorts')).toBe('youtube.com');
    expect(normalizeDomainInput('YOUTUBE.COM')).toBe('youtube.com');
  });

  it('accepts bare hosts with a path', () => {
    expect(normalizeDomainInput('twitter.com/home')).toBe('twitter.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeDomainInput('  x.com  ')).toBe('x.com');
  });

  it('drops a port', () => {
    expect(normalizeDomainInput('example.com:8080')).toBe('example.com');
  });

  it('reduces subdomains to the base domain', () => {
    expect(normalizeDomainInput('mobile.twitter.com')).toBe('twitter.com');
  });

  it('returns null for empty or blank input', () => {
    expect(normalizeDomainInput('')).toBeNull();
    expect(normalizeDomainInput('   ')).toBeNull();
  });

  it('returns null for garbage', () => {
    expect(normalizeDomainInput('not a domain!')).toBeNull();
  });

  it('returns null for non-http schemes', () => {
    expect(normalizeDomainInput('ftp://example.com')).toBeNull();
    expect(normalizeDomainInput('chrome://settings')).toBeNull();
  });
});

describe('parseDomainList', () => {
  it('splits on commas and whitespace, normalizes, and removes duplicates', () => {
    const { valid, invalid } = parseDomainList(
      'twitter.com, x.com\nTWITTER.com  https://www.reddit.com/r/x',
    );
    expect(valid).toEqual(['twitter.com', 'x.com', 'reddit.com']);
    expect(invalid).toEqual([]);
  });

  it('reports invalid entries separately', () => {
    const { valid, invalid } = parseDomainList('twitter.com, bad!!, ftp://nope.com');
    expect(valid).toEqual(['twitter.com']);
    expect(invalid).toEqual(['bad!!', 'ftp://nope.com']);
  });

  it('returns empty lists for empty input', () => {
    expect(parseDomainList('')).toEqual({ valid: [], invalid: [] });
    expect(parseDomainList(' , \n ')).toEqual({ valid: [], invalid: [] });
  });
});

describe('normalizeDomainInput rejects bare words', () => {
  it('rejects single-label typos but keeps localhost and IPs', () => {
    expect(normalizeDomainInput('youtube')).toBeNull();
    expect(normalizeDomainInput('not')).toBeNull();
    expect(normalizeDomainInput('localhost')).toBe('localhost');
    expect(normalizeDomainInput('192.168.1.10')).toBe('192.168.1.10');
  });
});
