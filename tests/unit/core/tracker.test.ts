import { describe, it, expect } from 'vitest';
import {
  MAX_GAP_MS,
  activeDomain,
  advance,
  applyChunks,
  splitInterval,
  type ActivitySnapshot,
  type Chunk,
} from '../../../src/core/tracker';
import type { DayUsage } from '../../../src/core/types';
import { MINUTE, HOUR } from '../../../src/core/time';

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s).getTime();

const snap = (over: Partial<ActivitySnapshot> = {}): ActivitySnapshot => ({
  url: 'https://www.twitter.com/home',
  windowFocused: true,
  idle: 'active',
  audible: false,
  ...over,
});

const settings = { countAudibleWhenIdle: true, ignoredDomains: [] as string[] };

const sumMs = (chunks: Chunk[]) => chunks.reduce((t, c) => t + c.ms, 0);

describe('activeDomain', () => {
  it('returns the base domain of the active tab when actively used', () => {
    expect(activeDomain(snap(), settings)).toBe('twitter.com');
  });

  it('returns null when no browser window has focus', () => {
    expect(activeDomain(snap({ windowFocused: false }), settings)).toBeNull();
  });

  it('returns null when the computer is locked', () => {
    expect(activeDomain(snap({ idle: 'locked', audible: true }), settings)).toBeNull();
  });

  it('returns null when idle and nothing is playing audio', () => {
    expect(activeDomain(snap({ idle: 'idle' }), settings)).toBeNull();
  });

  it('keeps counting when idle with audio and countAudibleWhenIdle is on', () => {
    expect(activeDomain(snap({ idle: 'idle', audible: true }), settings)).toBe('twitter.com');
  });

  it('stops counting when idle with audio but countAudibleWhenIdle is off', () => {
    expect(
      activeDomain(snap({ idle: 'idle', audible: true }), {
        ...settings,
        countAudibleWhenIdle: false,
      }),
    ).toBeNull();
  });

  it('returns null for ignored domains', () => {
    expect(activeDomain(snap(), { ...settings, ignoredDomains: ['twitter.com'] })).toBeNull();
  });

  it('returns null for non-web pages and missing URLs', () => {
    expect(activeDomain(snap({ url: 'chrome://newtab' }), settings)).toBeNull();
    expect(activeDomain(snap({ url: 'file:///C:/x.html' }), settings)).toBeNull();
    expect(activeDomain(snap({ url: null }), settings)).toBeNull();
  });
});

describe('splitInterval', () => {
  it('returns no chunks for an empty interval', () => {
    expect(splitInterval('x.com', at(2026, 11, 20, 14), at(2026, 11, 20, 14), 0)).toEqual([]);
  });

  it('keeps a span inside one hour as a single chunk', () => {
    const start = at(2026, 11, 20, 14, 10);
    const end = at(2026, 11, 20, 14, 40);
    expect(splitInterval('x.com', start, end, 0)).toEqual([
      { day: '2026-11-20', hour: 14, domain: 'x.com', ms: 30 * MINUTE },
    ]);
  });

  it('splits across an hour boundary', () => {
    const chunks = splitInterval('x.com', at(2026, 11, 20, 14, 50), at(2026, 11, 20, 15, 10), 0);
    expect(chunks).toEqual([
      { day: '2026-11-20', hour: 14, domain: 'x.com', ms: 10 * MINUTE },
      { day: '2026-11-20', hour: 15, domain: 'x.com', ms: 10 * MINUTE },
    ]);
  });

  it('assigns chunks to different Dwell days across the reset boundary', () => {
    // resetHour 4: 03:30 belongs to the previous day, 04:00 starts the new one.
    const chunks = splitInterval('x.com', at(2026, 11, 20, 3, 30), at(2026, 11, 20, 4, 30), 4);
    expect(chunks).toEqual([
      { day: '2026-11-19', hour: 3, domain: 'x.com', ms: 30 * MINUTE },
      { day: '2026-11-20', hour: 4, domain: 'x.com', ms: 30 * MINUTE },
    ]);
  });

  it('sums to the full interval length', () => {
    const start = at(2026, 11, 20, 1, 13, 7);
    const end = at(2026, 11, 20, 5, 2, 9);
    expect(sumMs(splitInterval('x.com', start, end, 4))).toBe(end - start);
  });
});

describe('advance', () => {
  const t0 = at(2026, 11, 20, 14, 0);

  it('opens a segment when there was none before', () => {
    const r = advance(null, 'x.com', t0, { resetHour: 0 });
    expect(r).toEqual({ segment: { domain: 'x.com', since: t0 }, chunks: [] });
  });

  it('credits the running segment and opens a new one for the next domain', () => {
    const r = advance({ domain: 'a.com', since: t0 }, 'b.com', t0 + 10 * MINUTE, {
      resetHour: 0,
      maxGapMs: HOUR,
    });
    expect(sumMs(r.chunks)).toBe(10 * MINUTE);
    expect(r.chunks.every((c) => c.domain === 'a.com')).toBe(true);
    expect(r.segment).toEqual({ domain: 'b.com', since: t0 + 10 * MINUTE });
  });

  it('closes the segment without opening one when nextDomain is null', () => {
    const r = advance({ domain: 'a.com', since: t0 }, null, t0 + 5 * MINUTE, {
      resetHour: 0,
      maxGapMs: HOUR,
    });
    expect(r.segment).toBeNull();
    expect(sumMs(r.chunks)).toBe(5 * MINUTE);
  });

  it('credits nothing when no time has passed', () => {
    const r = advance({ domain: 'a.com', since: t0 }, 'a.com', t0, { resetHour: 0 });
    expect(r.chunks).toEqual([]);
    expect(r.segment).toEqual({ domain: 'a.com', since: t0 });
  });

  it('honours endAt when the user went idle earlier than now', () => {
    const r = advance({ domain: 'a.com', since: t0 }, null, t0 + 20 * MINUTE, {
      resetHour: 0,
      endAt: t0 + 4 * MINUTE,
      maxGapMs: HOUR,
    });
    expect(sumMs(r.chunks)).toBe(4 * MINUTE);
  });

  it('caps credit at MAX_GAP_MS after a long suspend', () => {
    const r = advance({ domain: 'a.com', since: t0 }, 'a.com', t0 + 30 * MINUTE, { resetHour: 0 });
    expect(MAX_GAP_MS).toBe(2 * MINUTE);
    expect(sumMs(r.chunks)).toBe(MAX_GAP_MS);
  });

  it('honours a custom maxGapMs', () => {
    const r = advance({ domain: 'a.com', since: t0 }, null, t0 + 30 * MINUTE, {
      resetHour: 0,
      maxGapMs: 5 * MINUTE,
    });
    expect(sumMs(r.chunks)).toBe(5 * MINUTE);
  });

  it('splits credited time across hours', () => {
    const start = at(2026, 11, 20, 14, 50);
    const r = advance({ domain: 'a.com', since: start }, null, start + 20 * MINUTE, {
      resetHour: 0,
      maxGapMs: HOUR,
    });
    expect(r.chunks.map((c) => c.hour)).toEqual([14, 15]);
  });
});

describe('applyChunks', () => {
  it('accumulates chunks into per-day, per-domain, per-hour totals', () => {
    const usage: Record<string, DayUsage> = {};
    const touched = applyChunks(usage, [
      { day: '2026-11-20', hour: 14, domain: 'x.com', ms: 1000 },
      { day: '2026-11-20', hour: 14, domain: 'x.com', ms: 500 },
      { day: '2026-11-20', hour: 15, domain: 'x.com', ms: 200 },
      { day: '2026-11-19', hour: 23, domain: 'y.com', ms: 300 },
    ]);
    expect(usage['2026-11-20']!['x.com']![14]).toBe(1500);
    expect(usage['2026-11-20']!['x.com']![15]).toBe(200);
    expect(usage['2026-11-19']!['y.com']![23]).toBe(300);
    expect(usage['2026-11-19']!['y.com']).toHaveLength(24);
    expect(touched.sort()).toEqual(['2026-11-19', '2026-11-20']);
  });

  it('adds to existing usage rather than replacing it', () => {
    const hours = new Array<number>(24).fill(0);
    hours[9] = 100;
    const usage: Record<string, DayUsage> = { '2026-11-20': { 'x.com': hours } };
    applyChunks(usage, [{ day: '2026-11-20', hour: 9, domain: 'x.com', ms: 50 }]);
    expect(usage['2026-11-20']!['x.com']![9]).toBe(150);
  });

  it('returns no days for no chunks', () => {
    const usage: Record<string, DayUsage> = {};
    expect(applyChunks(usage, [])).toEqual([]);
    expect(usage).toEqual({});
  });
});
