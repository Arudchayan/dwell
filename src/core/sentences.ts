/**
 * The guilt-trip challenge. To get past a block the user must type one of these
 * by hand. Every unlock on the same day adds another sentence, so the price of
 * giving in keeps going up. `{site}` is replaced by the limit's name.
 *
 * Contributions welcome: keep sentences ASCII-only (easy to type on any
 * keyboard layout), first person, honest rather than cruel, and 20-30 words.
 */
export const BASE_SENTENCES: readonly string[] = [
  'I promised myself I would stop at my limit, and here I am again, choosing {site} over the things I actually care about.',
  'I am fully aware that nothing important is happening on {site} right now, and I am going to waste my time there anyway.',
  'My future self is watching me type this and quietly losing respect for me, because I said I would be stronger than this.',
  'I set this limit when I was thinking clearly, and I am now overruling the wiser version of me for a few more minutes of scrolling.',
  'The people I love deserve my attention more than {site} does, yet I am typing this sentence instead of being present with them.',
  'I could be learning something, building something, resting, or moving my body, but I am choosing to feed my habit on {site} instead.',
  'This is not a break, it is a relapse, and I know the next few minutes will not make me feel any better than the last hour did.',
  'I am typing this entire sentence because my self-control has run out for today, and I accept that this is a choice I am making.',
  'Somewhere there is a goal I keep saying matters to me, and right now I am putting it on hold again for more of {site}.',
  'I know exactly how I will feel after this: tired, a little empty, and annoyed that I gave away even more of my day to {site}.',
  'Every minute I spend here is a minute I will never get back, and I am deliberately trading it for something I will not remember tomorrow.',
  'I am not missing out on anything important; I am missing out on my own life while I refresh {site} one more time.',
];

/** Unlock number N on a day requires N sentences, up to this many. */
export const MAX_LEVEL = 5;

/** Deterministic 32-bit FNV-1a hash, so a page reload shows the same challenge. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Collapse runs of whitespace so stray double spaces never fail a challenge. */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Strip characters a site name could use to break the sentence. */
function cleanSiteName(name: string): string {
  return normalizeText(name.replace(/[^\p{L}\p{N} .'&/+-]/gu, '')) || 'this site';
}

export interface ChallengeInput {
  /** 1 for the first unlock of the day, 2 for the second, … */
  level: number;
  siteName: string;
  /** Stable per day + limit, e.g. `2026-11-20:twitter`. */
  seed: string;
  customSentences?: readonly string[];
}

/** Build the exact text the user must type. */
export function buildChallenge({
  level,
  siteName,
  seed,
  customSentences = [],
}: ChallengeInput): string {
  const pool = [...BASE_SENTENCES, ...customSentences.map(normalizeText).filter(Boolean)];
  const count = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL, pool.length);
  const rand = rng(hash(`${seed}:${level}`));
  // Partial Fisher-Yates shuffle: take `count` distinct sentences.
  const picked: string[] = [];
  const copy = pool.slice();
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rand() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    picked.push(copy[i]!);
  }
  const site = cleanSiteName(siteName);
  return normalizeText(picked.join(' ').replaceAll('{site}', site));
}

export interface TypingProgress {
  /** Number of leading characters typed correctly. */
  correct: number;
  /** True if the typed text has a mistake (anything after `correct`). */
  hasError: boolean;
  /** True when the full challenge has been typed exactly. */
  complete: boolean;
}

/** Compare what the user typed so far against the challenge. Case and punctuation matter. */
export function checkTyping(target: string, typed: string): TypingProgress {
  const t = normalizeText(target);
  const u = typed.replace(/\s+/g, ' ').replace(/^ /, '');
  let correct = 0;
  while (correct < u.length && correct < t.length && u[correct] === t[correct]) correct++;
  const hasError = correct < u.trimEnd().length;
  return { correct, hasError, complete: !hasError && normalizeText(u) === t };
}
