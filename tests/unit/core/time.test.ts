import { describe, it, expect } from 'vitest';
import {
  SECOND,
  MINUTE,
  HOUR,
  DAY,
  dayKey,
  hourOf,
  parseDayKey,
  isDayKey,
  addDays,
  weekdayOf,
  lastNDays,
  nextResetAt,
  nextHourAt,
  formatDuration,
  formatBadge,
} from '../../../src/core/time';

/** Local timestamp helper; month is 1-based for readability. */
const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s).getTime();

describe('time constants', () => {
  it('exposes consistent unit sizes', () => {
    expect(SECOND).toBe(1000);
    expect(MINUTE).toBe(60 * SECOND);
    expect(HOUR).toBe(60 * MINUTE);
    expect(DAY).toBe(24 * HOUR);
  });
});

describe('dayKey', () => {
  it('formats the local calendar day', () => {
    expect(dayKey(at(2026, 11, 20, 14, 30))).toBe('2026-11-20');
  });

  it('treats midnight as the start of the same day when resetHour is 0', () => {
    expect(dayKey(at(2026, 11, 5, 0, 0))).toBe('2026-11-05');
    expect(dayKey(at(2026, 11, 5, 23, 59))).toBe('2026-11-05');
  });

  it('assigns 02:00 to the previous day when resetHour is 4', () => {
    expect(dayKey(at(2026, 11, 5, 2, 0), 4)).toBe('2026-11-04');
  });

  it('starts the new tracking day exactly at the reset hour', () => {
    expect(dayKey(at(2026, 11, 5, 4, 0), 4)).toBe('2026-11-05');
    expect(dayKey(at(2026, 11, 5, 3, 59, 59), 4)).toBe('2026-11-04');
  });

  it('rolls back across a month boundary', () => {
    expect(dayKey(at(2026, 12, 1, 2, 0), 4)).toBe('2026-11-30');
  });

  it('rolls back across a year boundary', () => {
    expect(dayKey(at(2027, 1, 1, 1, 0), 4)).toBe('2026-12-31');
  });
});

describe('hourOf', () => {
  it('returns the local hour', () => {
    expect(hourOf(at(2026, 11, 20, 14, 30))).toBe(14);
    expect(hourOf(at(2026, 11, 20, 0, 5))).toBe(0);
  });
});

describe('parseDayKey', () => {
  it('returns a local Date at midnight', () => {
    const d = parseDayKey('2026-11-20');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(0);
  });
});

describe('isDayKey', () => {
  it('accepts real calendar dates', () => {
    expect(isDayKey('2026-11-20')).toBe(true);
    expect(isDayKey('2024-02-29')).toBe(true);
  });

  it('rejects impossible dates', () => {
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-02-29')).toBe(false);
    expect(isDayKey('2026-13-01')).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isDayKey('2026-2-1')).toBe(false);
    expect(isDayKey('20-11-2026')).toBe(false);
    expect(isDayKey('2026-11-20T00:00')).toBe(false);
    expect(isDayKey('not-a-date')).toBe(false);
    expect(isDayKey('')).toBe(false);
  });
});

describe('addDays', () => {
  it('moves forward and backward by whole days', () => {
    expect(addDays('2026-11-20', 1)).toBe('2026-11-21');
    expect(addDays('2026-11-20', -1)).toBe('2026-11-19');
    expect(addDays('2026-11-20', 0)).toBe('2026-11-20');
  });

  it('crosses a month boundary forward', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
  });

  it('crosses a year boundary forward and backward', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('handles large negative offsets', () => {
    expect(addDays('2026-11-20', -365)).toBe('2025-11-20');
  });
});

describe('weekdayOf', () => {
  it('returns 0 (Sunday) to 6 (Saturday)', () => {
    expect(weekdayOf('2026-11-20')).toBe(5); // Friday
    expect(weekdayOf('2026-11-22')).toBe(0); // Sunday
    expect(weekdayOf('2026-11-21')).toBe(6); // Saturday
  });
});

describe('lastNDays', () => {
  it('returns n keys ending at the given day, oldest first', () => {
    expect(lastNDays('2026-11-20', 3)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
  });

  it('crosses a month boundary', () => {
    expect(lastNDays('2026-03-02', 4)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
  });

  it('returns just the end day for n = 1 and an empty list for n = 0', () => {
    expect(lastNDays('2026-11-20', 1)).toEqual(['2026-11-20']);
    expect(lastNDays('2026-11-20', 0)).toEqual([]);
  });
});

describe('nextResetAt', () => {
  it('returns the next reset hour later the same day when it is still ahead', () => {
    expect(nextResetAt(at(2026, 11, 20, 2, 0), 4)).toBe(at(2026, 11, 20, 4, 0));
  });

  it('returns the following day when the reset hour has passed', () => {
    expect(nextResetAt(at(2026, 11, 20, 10, 0), 4)).toBe(at(2026, 11, 21, 4, 0));
  });

  it('is strictly after: exactly at the reset hour yields the next day', () => {
    expect(nextResetAt(at(2026, 11, 20, 4, 0), 4)).toBe(at(2026, 11, 21, 4, 0));
  });

  it('defaults to midnight', () => {
    expect(nextResetAt(at(2026, 11, 20, 14, 30))).toBe(at(2026, 11, 21, 0, 0));
  });
});

describe('nextHourAt', () => {
  it('returns the start of the next local hour', () => {
    expect(nextHourAt(at(2026, 11, 20, 14, 30))).toBe(at(2026, 11, 20, 15, 0));
  });

  it('is strictly after: exactly on the hour yields the following hour', () => {
    expect(nextHourAt(at(2026, 11, 20, 14, 0))).toBe(at(2026, 11, 20, 15, 0));
  });

  it('rolls over midnight', () => {
    expect(nextHourAt(at(2026, 11, 30, 23, 30))).toBe(at(2026, 12, 1, 0, 0));
  });
});

describe('formatDuration', () => {
  it('formats zero and sub-minute values in seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45 * SECOND)).toBe('45s');
    expect(formatDuration(59.9 * SECOND)).toBe('59s');
  });

  it('formats minutes without seconds by default', () => {
    expect(formatDuration(12 * MINUTE)).toBe('12m');
    expect(formatDuration(12 * MINUTE + 5 * SECOND)).toBe('12m');
  });

  it('shows seconds when requested', () => {
    expect(formatDuration(12 * MINUTE + 5 * SECOND, { seconds: true })).toBe('12m 05s');
  });

  it('formats hours with zero-padded minutes', () => {
    expect(formatDuration(65 * MINUTE)).toBe('1h 05m');
    expect(formatDuration(3 * HOUR)).toBe('3h');
  });

  it('clamps negative durations to zero', () => {
    expect(formatDuration(-5000)).toBe('0s');
  });
});

describe('formatBadge', () => {
  it('uses seconds below a minute', () => {
    expect(formatBadge(0)).toBe('0s');
    expect(formatBadge(30 * SECOND)).toBe('30s');
    expect(formatBadge(1)).toBe('1s');
  });

  it('rounds minutes up', () => {
    expect(formatBadge(61 * SECOND)).toBe('2m');
    expect(formatBadge(45 * MINUTE)).toBe('45m');
  });

  it('uses whole hours from one hour up', () => {
    expect(formatBadge(2 * HOUR)).toBe('2h');
    expect(formatBadge(90 * MINUTE)).toBe('1h');
  });

  it('clamps negative values to zero', () => {
    expect(formatBadge(-1000)).toBe('0s');
  });
});
