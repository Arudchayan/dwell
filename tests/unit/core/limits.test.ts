import { describe, it, expect } from 'vitest';
import {
  FINAL_WARNING_MS,
  WARN_FRACTION,
  usedMsFor,
  appliesOn,
  evaluateLimit,
  evaluateAll,
  blockedDomains,
  statusesForDomain,
  mostRestrictive,
  dueWarning,
  msUntilChange,
  type LimitStatus,
} from '../../../src/core/limits';
import type { DayUsage, Limit } from '../../../src/core/types';
import { MINUTE } from '../../../src/core/time';

const NOW = new Date(2026, 10, 20, 14, 30).getTime();

const limit = (over: Partial<Limit> = {}): Limit => ({
  id: 'l1',
  name: 'Social',
  domains: ['twitter.com', 'x.com'],
  dailyMs: 60 * MINUTE,
  days: [],
  enabled: true,
  ...over,
});

/** Usage with `ms` spent in hour 0 of the given domain. */
const usageOf = (entries: Record<string, number>): DayUsage => {
  const out: DayUsage = {};
  for (const [domain, ms] of Object.entries(entries)) {
    const hours = new Array<number>(24).fill(0);
    hours[0] = ms;
    out[domain] = hours;
  }
  return out;
};

/** Build a status directly, for tests of the aggregate helpers. */
const status = (over: Partial<LimitStatus> & { state: LimitStatus['state'] }): LimitStatus => ({
  limit: limit(),
  usedMs: 0,
  remainingMs: 0,
  ...over,
});

describe('usedMsFor', () => {
  it('sums time across all domains of a limit', () => {
    const usage = usageOf({
      'twitter.com': 10 * MINUTE,
      'x.com': 5 * MINUTE,
      'other.com': 99 * MINUTE,
    });
    expect(usedMsFor(limit(), usage)).toBe(15 * MINUTE);
  });

  it('returns 0 when none of the domains were used', () => {
    expect(usedMsFor(limit(), {})).toBe(0);
  });
});

describe('appliesOn', () => {
  it('applies every day when days is empty', () => {
    expect(appliesOn(limit(), 0)).toBe(true);
    expect(appliesOn(limit(), 6)).toBe(true);
  });

  it('applies only on the listed weekdays', () => {
    const l = limit({ days: [1, 2] });
    expect(appliesOn(l, 1)).toBe(true);
    expect(appliesOn(l, 0)).toBe(false);
  });

  it('never applies when disabled', () => {
    expect(appliesOn(limit({ enabled: false }), 3)).toBe(false);
  });
});

describe('evaluateLimit', () => {
  it('is ok while well under the limit', () => {
    const s = evaluateLimit(limit(), usageOf({ 'twitter.com': 10 * MINUTE }), 5, undefined, NOW);
    expect(s).toMatchObject({ state: 'ok', usedMs: 10 * MINUTE, remainingMs: 50 * MINUTE });
    expect(s?.graceUntil).toBeUndefined();
  });

  it('is warning at 80% of the limit', () => {
    const s = evaluateLimit(limit(), usageOf({ 'x.com': 48 * MINUTE }), 5, undefined, NOW);
    expect(s?.state).toBe('warning');
    expect(WARN_FRACTION).toBe(0.8);
  });

  it('is blocked once the limit is used up', () => {
    const s = evaluateLimit(limit(), usageOf({ 'x.com': 60 * MINUTE }), 5, undefined, NOW);
    expect(s).toMatchObject({ state: 'blocked', remainingMs: 0 });
  });

  it('is blocked when usage overshoots and remaining never goes negative', () => {
    const s = evaluateLimit(limit(), usageOf({ 'x.com': 70 * MINUTE }), 5, undefined, NOW);
    expect(s).toMatchObject({ state: 'blocked', remainingMs: 0, usedMs: 70 * MINUTE });
  });

  it('is in grace while a guilt-trip grace period runs', () => {
    const s = evaluateLimit(limit(), usageOf({ 'x.com': 60 * MINUTE }), 5, NOW + 1000, NOW);
    expect(s?.state).toBe('grace');
    expect(s?.graceUntil).toBe(NOW + 1000);
  });

  it('falls back to blocked once the grace period has expired', () => {
    const s = evaluateLimit(limit(), usageOf({ 'x.com': 60 * MINUTE }), 5, NOW - 1, NOW);
    expect(s?.state).toBe('blocked');
    expect(s?.graceUntil).toBeUndefined();
  });

  it('a grace period does not matter while there is still time left', () => {
    const s = evaluateLimit(limit(), usageOf({ 'x.com': 10 * MINUTE }), 5, NOW + 1000, NOW);
    expect(s?.state).toBe('ok');
    expect(s?.graceUntil).toBeUndefined();
  });

  it('a dailyMs of 0 is blocked from the start', () => {
    const s = evaluateLimit(limit({ dailyMs: 0 }), {}, 5, undefined, NOW);
    expect(s).toMatchObject({ state: 'blocked', remainingMs: 0 });
  });

  it('returns null when the limit does not apply today', () => {
    expect(evaluateLimit(limit({ days: [1] }), {}, 0, undefined, NOW)).toBeNull();
    expect(evaluateLimit(limit({ enabled: false }), {}, 1, undefined, NOW)).toBeNull();
  });
});

describe('evaluateAll', () => {
  it('keeps only limits that apply today, with grace applied by id', () => {
    const limits = [
      limit({ id: 'a', domains: ['x.com'], dailyMs: 10 * MINUTE }),
      limit({ id: 'b', domains: ['y.com'], days: [1] }),
      limit({ id: 'c', domains: ['z.com'], dailyMs: 10 * MINUTE }),
    ];
    const usage = usageOf({ 'x.com': 10 * MINUTE, 'z.com': 1 * MINUTE });
    const out = evaluateAll(limits, usage, 0, { a: NOW + 5000 }, NOW);
    expect(out.map((s) => [s.limit.id, s.state])).toEqual([
      ['a', 'grace'],
      ['c', 'ok'],
    ]);
  });

  it('returns an empty list when no limits apply', () => {
    expect(evaluateAll([], {}, 0, {}, NOW)).toEqual([]);
  });
});

describe('blockedDomains', () => {
  it('returns unique, sorted domains of blocked limits only', () => {
    const statuses = [
      status({ state: 'blocked', limit: limit({ domains: ['x.com', 'twitter.com'] }) }),
      status({
        state: 'blocked',
        limit: limit({ id: 'l2', domains: ['twitter.com', 'reddit.com'] }),
      }),
      status({ state: 'ok', limit: limit({ id: 'l3', domains: ['news.com'] }) }),
      status({ state: 'grace', limit: limit({ id: 'l4', domains: ['grace.com'] }) }),
    ];
    expect(blockedDomains(statuses)).toEqual(['reddit.com', 'twitter.com', 'x.com']);
  });

  it('returns an empty list when nothing is blocked', () => {
    expect(blockedDomains([])).toEqual([]);
  });
});

describe('statusesForDomain', () => {
  it('returns every status whose limit covers the domain', () => {
    const a = status({ state: 'ok', limit: limit({ id: 'a', domains: ['x.com'] }) });
    const b = status({ state: 'ok', limit: limit({ id: 'b', domains: ['y.com'] }) });
    expect(statusesForDomain([a, b], 'x.com')).toEqual([a]);
    expect(statusesForDomain([a, b], 'nope.com')).toEqual([]);
  });
});

describe('mostRestrictive', () => {
  it('returns null for no statuses', () => {
    expect(mostRestrictive([])).toBeNull();
  });

  it('prefers blocked over grace over warning over ok', () => {
    const ok = status({ state: 'ok', remainingMs: 1 });
    const warning = status({ state: 'warning', remainingMs: 2 });
    const grace = status({ state: 'grace', remainingMs: 0 });
    const blocked = status({ state: 'blocked', remainingMs: 0 });
    expect(mostRestrictive([ok, warning])).toBe(warning);
    expect(mostRestrictive([warning, grace])).toBe(grace);
    expect(mostRestrictive([grace, blocked, ok])).toBe(blocked);
  });

  it('breaks ties by least time remaining', () => {
    const roomy = status({ state: 'warning', remainingMs: 10 * MINUTE });
    const tight = status({ state: 'warning', remainingMs: 1 * MINUTE });
    expect(mostRestrictive([roomy, tight])).toBe(tight);
    expect(mostRestrictive([tight, roomy])).toBe(tight);
  });
});

describe('dueWarning', () => {
  const st = (usedMs: number, dailyMs = 60 * MINUTE) => {
    const l = limit({ dailyMs });
    const remainingMs = Math.max(0, dailyMs - usedMs);
    const state = remainingMs <= 0 ? 'blocked' : 'ok';
    return { limit: l, usedMs, remainingMs, state } as LimitStatus;
  };

  it('shows nothing below 80% of the limit', () => {
    expect(dueWarning(st(45 * MINUTE), [])).toEqual({ show: null, fire: [] });
  });

  it('shows the 80% warning when first crossing it', () => {
    expect(dueWarning(st(50 * MINUTE), [])).toEqual({ show: 'eighty', fire: ['eighty'] });
  });

  it('shows nothing when the 80% warning already fired', () => {
    expect(dueWarning(st(50 * MINUTE), ['eighty'])).toEqual({ show: null, fire: [] });
  });

  it('shows the five-minute warning when five minutes or less remain', () => {
    const usedMs = 60 * MINUTE - FINAL_WARNING_MS;
    expect(dueWarning(st(usedMs), [])).toEqual({
      show: 'five',
      fire: ['eighty', 'five'],
    });
    expect(dueWarning(st(usedMs), ['eighty'])).toEqual({ show: 'five', fire: ['five'] });
  });

  it('jumping straight to exhausted shows "reached" and fires all three', () => {
    expect(dueWarning(st(60 * MINUTE), [])).toEqual({
      show: 'reached',
      fire: ['eighty', 'five', 'reached'],
    });
  });

  it('after exhaustion has been announced nothing more is shown', () => {
    expect(dueWarning(st(60 * MINUTE), ['eighty', 'five', 'reached'])).toEqual({
      show: null,
      fire: [],
    });
  });

  it('shows nothing for a zero-length limit, even though it is exhausted', () => {
    expect(dueWarning(st(0, 0), [])).toEqual({
      show: null,
      fire: ['eighty', 'five', 'reached'],
    });
  });
});

describe('msUntilChange', () => {
  it('returns null when there are no statuses', () => {
    expect(msUntilChange([], NOW)).toBeNull();
  });

  it('returns the time left for an ok or warning limit', () => {
    const s = status({ state: 'warning', remainingMs: 30 * MINUTE });
    expect(msUntilChange([s], NOW)).toBe(30 * MINUTE);
  });

  it('returns the time until a grace period ends', () => {
    const s = status({ state: 'grace', remainingMs: 0, graceUntil: NOW + 2000 });
    expect(msUntilChange([s], NOW)).toBe(2000);
  });

  it('ignores blocked limits and grace periods that already ended', () => {
    const blocked = status({ state: 'blocked', remainingMs: 0 });
    const expired = status({ state: 'grace', remainingMs: 0, graceUntil: NOW - 1 });
    expect(msUntilChange([blocked, expired], NOW)).toBeNull();
  });

  it('returns the soonest change across several limits', () => {
    const a = status({ state: 'ok', remainingMs: 30 * MINUTE });
    const b = status({ state: 'grace', remainingMs: 0, graceUntil: NOW + 2000 });
    expect(msUntilChange([a, b], NOW)).toBe(2000);
  });
});
