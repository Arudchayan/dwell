import { describe, it, expect } from 'vitest';
import {
  dayTotal,
  domainTotals,
  topWithOther,
  hourlyTotals,
  dailySeries,
  weekdayHourHeatmap,
  averageActiveDay,
  percentChange,
  unlockSeries,
  cleanStreak,
} from '../../../src/core/stats';
import type { DayUsage, Unlock } from '../../../src/core/types';

/** Usage with the given ms per domain, all in hour 9. */
const u = (entries: Record<string, number>): DayUsage => {
  const out: DayUsage = {};
  for (const [domain, ms] of Object.entries(entries)) {
    const hours = new Array<number>(24).fill(0);
    hours[9] = ms;
    out[domain] = hours;
  }
  return out;
};

const unlock = (limitId = 'l1'): Unlock => ({ limitId, at: 1, graceMs: 60000, level: 1 });

describe('dayTotal', () => {
  it('is zero for a missing day', () => {
    expect(dayTotal(undefined)).toBe(0);
  });

  it('sums every domain and hour', () => {
    const usage: DayUsage = {
      'a.com': [1, 2, ...new Array<number>(22).fill(0)],
      'b.com': [0, 0, 0, 10, ...new Array<number>(20).fill(0)],
    };
    expect(dayTotal(usage)).toBe(13);
  });
});

describe('domainTotals', () => {
  it('sums across days, sorts largest first and skips missing days', () => {
    const totals = domainTotals([
      u({ 'a.com': 100, 'b.com': 300 }),
      undefined,
      u({ 'a.com': 250 }),
    ]);
    expect(totals).toEqual([
      { domain: 'a.com', ms: 350 },
      { domain: 'b.com', ms: 300 },
    ]);
  });

  it('breaks ties alphabetically', () => {
    const totals = domainTotals([u({ 'zeta.com': 100, 'alpha.com': 100, 'mid.com': 50 })]);
    expect(totals.map((t) => t.domain)).toEqual(['alpha.com', 'zeta.com', 'mid.com']);
  });

  it('filters out domains with zero time', () => {
    const totals = domainTotals([u({ 'zero.com': 0, 'real.com': 5 })]);
    expect(totals).toEqual([{ domain: 'real.com', ms: 5 }]);
  });

  it('returns an empty list for no data', () => {
    expect(domainTotals([])).toEqual([]);
    expect(domainTotals([undefined])).toEqual([]);
  });
});

describe('topWithOther', () => {
  const totals = [
    { domain: 'a.com', ms: 500 },
    { domain: 'b.com', ms: 300 },
    { domain: 'c.com', ms: 100 },
    { domain: 'd.com', ms: 50 },
  ];

  it('returns the list unchanged when it fits', () => {
    expect(topWithOther(totals, 4)).toBe(totals);
    expect(topWithOther(totals, 10)).toBe(totals);
  });

  it('aggregates the remainder into "Other"', () => {
    expect(topWithOther(totals, 2)).toEqual([
      { domain: 'a.com', ms: 500 },
      { domain: 'b.com', ms: 300 },
      { domain: 'Other', ms: 150 },
    ]);
  });
});

describe('hourlyTotals', () => {
  it('returns 24 buckets summed across days', () => {
    const d1: DayUsage = { 'a.com': hoursAt({ 14: 100, 15: 5 }), 'b.com': hoursAt({ 14: 50 }) };
    const d2: DayUsage = { 'a.com': hoursAt({ 14: 25 }) };
    const out = hourlyTotals([d1, undefined, d2]);
    expect(out).toHaveLength(24);
    expect(out[14]).toBe(175);
    expect(out[15]).toBe(5);
    expect(out[0]).toBe(0);
  });

  it('is all zeros for no data', () => {
    expect(hourlyTotals([])).toEqual(new Array<number>(24).fill(0));
  });
});

describe('dailySeries', () => {
  it('returns one total per requested day, with zero for missing days', () => {
    const byDay = {
      '2026-11-18': u({ 'a.com': 100 }),
      '2026-11-20': u({ 'a.com': 40, 'b.com': 60 }),
    };
    expect(dailySeries(byDay, ['2026-11-18', '2026-11-19', '2026-11-20'])).toEqual([100, 0, 100]);
  });
});

describe('weekdayHourHeatmap', () => {
  it('builds a 7x24 grid with Sunday first', () => {
    const byDay = {
      '2026-11-20': u({ 'a.com': 1000 }), // Friday
      '2026-11-27': u({ 'a.com': 500 }), // Friday again
      '2026-11-22': u({ 'b.com': 7 }), // Sunday
    };
    const grid = weekdayHourHeatmap(byDay, [
      '2026-11-20',
      '2026-11-22',
      '2026-11-27',
      '2026-11-28',
    ]);
    expect(grid).toHaveLength(7);
    expect(grid.every((row) => row.length === 24)).toBe(true);
    expect(grid[5]![9]).toBe(1500); // Friday, 09:00
    expect(grid[0]![9]).toBe(7); // Sunday, 09:00
    expect(grid[6]![9]).toBe(0); // Saturday 2026-11-28 has no data
  });

  it('ignores days in the request that have no usage', () => {
    const grid = weekdayHourHeatmap({}, ['2026-11-20']);
    expect(grid.flat().every((v) => v === 0)).toBe(true);
  });
});

describe('averageActiveDay', () => {
  it('averages only days with activity', () => {
    expect(averageActiveDay([0, 100, 300, 0])).toBe(200);
  });

  it('returns 0 when there is no activity', () => {
    expect(averageActiveDay([])).toBe(0);
    expect(averageActiveDay([0, 0])).toBe(0);
  });
});

describe('percentChange', () => {
  it('computes the rounded percentage change', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(100, 300)).toBe(-67);
    expect(percentChange(0, 100)).toBe(-100);
  });

  it('returns null when there is no baseline', () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });
});

describe('unlockSeries', () => {
  it('counts unlocks per requested day, with zero for missing days', () => {
    const unlocks = {
      '2026-11-19': [unlock(), unlock('l2')],
      '2026-11-20': [unlock()],
    };
    expect(unlockSeries(unlocks, ['2026-11-18', '2026-11-19', '2026-11-20'])).toEqual([0, 2, 1]);
  });
});

describe('cleanStreak', () => {
  const days = ['2026-11-20', '2026-11-19', '2026-11-18', '2026-11-17', '2026-11-16'];

  it('counts consecutive clean days from the newest', () => {
    expect(cleanStreak({}, days, null)).toBe(5);
  });

  it('stops at the most recent day with an unlock', () => {
    expect(cleanStreak({ '2026-11-18': [unlock()] }, days, null)).toBe(2);
  });

  it('returns 0 when today already has an unlock', () => {
    expect(cleanStreak({ '2026-11-20': [unlock()] }, days, null)).toBe(0);
  });

  it('stops at firstDay, the day tracking started', () => {
    expect(cleanStreak({}, days, '2026-11-18')).toBe(3);
  });

  it('returns 0 for no days', () => {
    expect(cleanStreak({}, [], null)).toBe(0);
  });
});

/** Hour-keyed usage for a single domain, used by the hourly tests. */
function hoursAt(entries: Record<number, number>): number[] {
  const out = new Array<number>(24).fill(0);
  for (const [h, ms] of Object.entries(entries)) out[Number(h)] = ms;
  return out;
}
