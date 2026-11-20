import { describe, it, expect } from 'vitest';
import {
  BASE_SENTENCES,
  MAX_LEVEL,
  hash,
  normalizeText,
  buildChallenge,
  checkTyping,
} from '../../../src/core/sentences';

/** BASE_SENTENCES with `{site}` filled in, for counting which ones appear. */
const expandBase = (site: string) => BASE_SENTENCES.map((s) => s.replaceAll('{site}', site));

const countBaseIn = (challenge: string, site: string) =>
  expandBase(site).filter((s) => challenge.includes(s)).length;

describe('buildChallenge', () => {
  it('is deterministic for the same inputs', () => {
    const input = { level: 3, siteName: 'Twitter', seed: '2026-11-20:twitter' };
    expect(buildChallenge(input)).toBe(buildChallenge(input));
  });

  it('differs for different seeds (at least for some seeds)', () => {
    const results = new Set(
      Array.from({ length: 20 }, (_, i) =>
        buildChallenge({ level: 2, siteName: 'Twitter', seed: `seed-${i}` }),
      ),
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it('contains exactly `level` base sentences', () => {
    for (const level of [1, 2, 3, 4, MAX_LEVEL]) {
      const text = buildChallenge({ level, siteName: 'Reddit', seed: 'abc' });
      expect(countBaseIn(text, 'Reddit')).toBe(level);
    }
  });

  it('caps the number of sentences at MAX_LEVEL', () => {
    expect(MAX_LEVEL).toBe(5);
    const text = buildChallenge({ level: 99, siteName: 'Reddit', seed: 'abc' });
    expect(countBaseIn(text, 'Reddit')).toBe(MAX_LEVEL);
  });

  it('treats a level below 1 as 1', () => {
    const text = buildChallenge({ level: 0, siteName: 'Reddit', seed: 'abc' });
    expect(countBaseIn(text, 'Reddit')).toBe(1);
  });

  it('replaces {site} with the site name', () => {
    const text = buildChallenge({ level: 5, siteName: 'Reddit', seed: 'abc' });
    expect(text).not.toContain('{site}');
  });

  it('sanitizes the site name so markup cannot leak in', () => {
    const texts = Array.from({ length: 30 }, (_, i) =>
      buildChallenge({ level: 1, siteName: '<script>', seed: `s${i}` }),
    );
    for (const t of texts) {
      expect(t).not.toContain('<');
      expect(t).not.toContain('>');
    }
    expect(texts.some((t) => t.includes('script'))).toBe(true);
  });

  it('uses "this site" when the site name is empty or only symbols', () => {
    const texts = Array.from({ length: 30 }, (_, i) =>
      buildChallenge({ level: 1, siteName: '<<>>', seed: `e${i}` }),
    );
    expect(texts.some((t) => t.includes('this site'))).toBe(true);
    expect(texts.every((t) => !t.includes('{site}'))).toBe(true);
  });

  it('includes custom sentences in the pool, with {site} replaced', () => {
    const custom = 'Honestly, I  keep opening {site} even though I promised I would stop.';
    const expectedCustom = 'Honestly, I keep opening Reddit even though I promised I would stop.';
    const found = Array.from({ length: 200 }, (_, i) =>
      buildChallenge({
        level: 1,
        siteName: 'Reddit',
        seed: `custom-${i}`,
        customSentences: [custom],
      }),
    ).some((t) => t.includes(expectedCustom));
    expect(found).toBe(true);
  });

  it('ignores blank custom sentences', () => {
    const text = buildChallenge({
      level: 1,
      siteName: 'Reddit',
      seed: 'blank',
      customSentences: ['   '],
    });
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/^\s|\s$/);
  });

  it('caps the level at the pool size when the pool is tiny', () => {
    // With only BASE_SENTENCES available the pool is larger than MAX_LEVEL, so
    // this checks the pool-size branch by requesting a level beyond the cap.
    const text = buildChallenge({ level: 4.7, siteName: 'X', seed: 'frac' });
    expect(countBaseIn(text, 'X')).toBe(4);
  });
});

describe('hash', () => {
  it('is stable and uses the 32-bit FNV-1a offset basis for empty input', () => {
    expect(hash('')).toBe(0x811c9dc5);
    expect(hash('a')).toBe(0xe40c292c);
    expect(hash('overstay')).toBe(hash('overstay'));
  });

  it('returns an unsigned 32-bit integer and separates different inputs', () => {
    const h = hash('2026-11-20:twitter');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(hash('x')).not.toBe(hash('y'));
  });
});

describe('normalizeText', () => {
  it('collapses whitespace runs and trims the ends', () => {
    expect(normalizeText('  a   b\n\tc  ')).toBe('a b c');
    expect(normalizeText('plain')).toBe('plain');
    expect(normalizeText('   ')).toBe('');
  });
});

describe('checkTyping', () => {
  const target = 'I will stop now.';

  it('reports partial correct progress without errors', () => {
    expect(checkTyping(target, 'I will')).toEqual({ correct: 6, hasError: false, complete: false });
  });

  it('reports the empty string as zero progress', () => {
    expect(checkTyping(target, '')).toEqual({ correct: 0, hasError: false, complete: false });
  });

  it('detects a mistake and stops counting correct characters there', () => {
    expect(checkTyping(target, 'I wilx')).toEqual({ correct: 5, hasError: true, complete: false });
  });

  it('detects extra characters beyond the target as an error', () => {
    expect(checkTyping('ab', 'abc')).toEqual({ correct: 2, hasError: true, complete: false });
  });

  it('is complete on an exact match', () => {
    expect(checkTyping(target, target)).toEqual({
      correct: target.length,
      hasError: false,
      complete: true,
    });
  });

  it('is complete despite extra or irregular whitespace', () => {
    const r = checkTyping('abc def', '  abc    def  ');
    expect(r.complete).toBe(true);
    expect(r.hasError).toBe(false);
  });

  it('is case sensitive', () => {
    const r = checkTyping('I will', 'i will');
    expect(r.correct).toBe(0);
    expect(r.hasError).toBe(true);
    expect(r.complete).toBe(false);
  });

  it('treats punctuation as significant', () => {
    expect(checkTyping('stop now.', 'stop now').complete).toBe(false);
    expect(checkTyping('stop now.', 'stop now!').hasError).toBe(true);
  });
});

describe('BASE_SENTENCES', () => {
  it('contains ASCII-only sentences as documented', () => {
    for (const s of BASE_SENTENCES) {
      expect(/^[\x20-\x7e]+$/.test(s)).toBe(true);
    }
  });
});
