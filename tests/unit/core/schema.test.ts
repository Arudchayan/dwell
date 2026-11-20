import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  ImportError,
  sanitizeSettings,
  sanitizeLimit,
  sanitizeLimits,
  sanitizeDayUsage,
  sanitizeUnlocks,
  migrate,
  parseImport,
  buildExport,
  toCsv,
  expiredDays,
} from '../../../src/core/schema';
import type { DayUsage, Limit, Settings, Unlock } from '../../../src/core/types';
import { MINUTE, HOUR } from '../../../src/core/time';

const hoursWith = (entries: Record<number, number>): number[] => {
  const out = new Array<number>(24).fill(0);
  for (const [h, ms] of Object.entries(entries)) out[Number(h)] = ms;
  return out;
};

const validLimit = (over: Partial<Limit> = {}): Limit => ({
  id: 'l1',
  name: 'Social',
  domains: ['twitter.com', 'x.com'],
  dailyMs: 60 * MINUTE,
  days: [],
  enabled: true,
  ...over,
});

describe('sanitizeSettings', () => {
  it('returns defaults for garbage input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults field by field', () => {
    const s = sanitizeSettings({ idleSeconds: 'abc', strictMode: 'yes', resetHour: null });
    expect(s.idleSeconds).toBe(DEFAULT_SETTINGS.idleSeconds);
    expect(s.strictMode).toBe(DEFAULT_SETTINGS.strictMode);
    expect(s.resetHour).toBe(DEFAULT_SETTINGS.resetHour);
  });

  it('clamps idleSeconds to 15-3600', () => {
    expect(sanitizeSettings({ idleSeconds: 1 }).idleSeconds).toBe(15);
    expect(sanitizeSettings({ idleSeconds: 99999 }).idleSeconds).toBe(3600);
    expect(sanitizeSettings({ idleSeconds: 120 }).idleSeconds).toBe(120);
  });

  it('clamps and rounds other numeric fields', () => {
    const s = sanitizeSettings({ resetHour: 25, graceMinutes: 0, retentionDays: 4.6 });
    expect(s.resetHour).toBe(23);
    expect(s.graceMinutes).toBe(1);
    expect(s.retentionDays).toBe(7);
    expect(sanitizeSettings({ resetHour: -3 }).resetHour).toBe(0);
    expect(sanitizeSettings({ retentionDays: 99999 }).retentionDays).toBe(3650);
  });

  it('accepts numeric strings for numeric fields', () => {
    expect(sanitizeSettings({ graceMinutes: '10' }).graceMinutes).toBe(10);
  });

  it('only accepts light or dark for theme', () => {
    expect(sanitizeSettings({ theme: 'dark' }).theme).toBe('dark');
    expect(sanitizeSettings({ theme: 'light' }).theme).toBe('light');
    expect(sanitizeSettings({ theme: 'neon' }).theme).toBe('system');
  });

  it('normalizes ignored domains and removes duplicates', () => {
    const s = sanitizeSettings({
      ignoredDomains: ['https://www.Example.com/a', 'example.com', 'bad!!', 42],
    });
    expect(s.ignoredDomains).toEqual(['example.com']);
  });

  it('trims custom sentences, drops short or long ones, and caps the count', () => {
    const s = sanitizeSettings({
      customSentences: [
        '   Too   many    spaces   in   this   sentence.  ',
        'short',
        'x'.repeat(1001),
        7,
      ],
    });
    expect(s.customSentences).toEqual(['Too many spaces in this sentence.']);

    const many = Array.from({ length: 150 }, (_, i) => `Custom sentence number ${i}.`);
    expect(sanitizeSettings({ customSentences: many }).customSentences).toHaveLength(100);
  });

  it('keeps valid booleans', () => {
    const s = sanitizeSettings({ countAudibleWhenIdle: false, notifications: false });
    expect(s.countAudibleWhenIdle).toBe(false);
    expect(s.notifications).toBe(false);
  });
});

describe('sanitizeLimit', () => {
  it('returns null for non-objects', () => {
    expect(sanitizeLimit(null)).toBeNull();
    expect(sanitizeLimit('x')).toBeNull();
    expect(sanitizeLimit(['a'])).toBeNull();
  });

  it('rejects a missing or empty id', () => {
    expect(sanitizeLimit({ domains: ['x.com'], dailyMs: 1000 })).toBeNull();
    expect(sanitizeLimit({ id: '', domains: ['x.com'], dailyMs: 1000 })).toBeNull();
  });

  it('rejects a limit with no valid domains', () => {
    expect(sanitizeLimit({ id: 'a', domains: [], dailyMs: 1000 })).toBeNull();
    expect(sanitizeLimit({ id: 'a', domains: ['!!!', 3], dailyMs: 1000 })).toBeNull();
    expect(sanitizeLimit({ id: 'a', dailyMs: 1000 })).toBeNull();
  });

  it('rejects a missing or non-numeric dailyMs', () => {
    expect(sanitizeLimit({ id: 'a', domains: ['x.com'] })).toBeNull();
    expect(sanitizeLimit({ id: 'a', domains: ['x.com'], dailyMs: 'lots' })).toBeNull();
  });

  // Suspected bug: a negative dailyMs is clamped to 0 by clampInt (min = 0) and
  // accepted, so the `dailyMs < 0` guard in sanitizeLimit is unreachable for
  // negative numbers. The spec expects such a limit to be rejected.
  it('rejects a negative dailyMs', () => {
    expect(sanitizeLimit({ id: 'a', domains: ['x.com'], dailyMs: -5000 })).toBeNull();
  });

  it('clamps dailyMs to at most 24 hours', () => {
    const l = sanitizeLimit({ id: 'a', domains: ['x.com'], dailyMs: 999999999999 });
    expect(l?.dailyMs).toBe(24 * HOUR);
  });

  it('accepts dailyMs of zero', () => {
    expect(sanitizeLimit({ id: 'a', domains: ['x.com'], dailyMs: 0 })?.dailyMs).toBe(0);
  });

  it('dedupes and sorts weekdays, dropping invalid ones', () => {
    const l = sanitizeLimit({
      id: 'a',
      domains: ['x.com'],
      dailyMs: 1000,
      days: [5, 1, 5, 9, -1, 2.5, '3', 0],
    });
    expect(l?.days).toEqual([0, 1, 5]);
  });

  it('defaults days to an empty list (every day)', () => {
    expect(sanitizeLimit({ id: 'a', domains: ['x.com'], dailyMs: 1000 })?.days).toEqual([]);
  });

  it('falls back to the first domain as the name', () => {
    const l = sanitizeLimit({
      id: 'a',
      name: '   ',
      domains: ['https://www.reddit.com/'],
      dailyMs: 1000,
    });
    expect(l?.name).toBe('reddit.com');
  });

  it('trims and truncates the name to 60 characters', () => {
    const l = sanitizeLimit({
      id: 'a',
      name: `  ${'n'.repeat(100)}  `,
      domains: ['x.com'],
      dailyMs: 1,
    });
    expect(l?.name).toHaveLength(60);
    expect(l?.name.startsWith('n')).toBe(true);
  });

  it('truncates very long ids to 64 characters', () => {
    const l = sanitizeLimit({ id: 'i'.repeat(100), domains: ['x.com'], dailyMs: 1 });
    expect(l?.id).toHaveLength(64);
  });

  it('treats enabled as true unless explicitly false', () => {
    expect(sanitizeLimit({ id: 'a', domains: ['x.com'], dailyMs: 1 })?.enabled).toBe(true);
    expect(
      sanitizeLimit({ id: 'a', domains: ['x.com'], dailyMs: 1, enabled: false })?.enabled,
    ).toBe(false);
  });
});

describe('sanitizeLimits', () => {
  it('returns an empty list for non-arrays', () => {
    expect(sanitizeLimits(null)).toEqual([]);
    expect(sanitizeLimits({ id: 'a' })).toEqual([]);
  });

  it('drops invalid entries and dedupes by id, keeping the first', () => {
    const out = sanitizeLimits([
      { id: 'a', name: 'First', domains: ['x.com'], dailyMs: 1000 },
      { id: 'a', name: 'Second', domains: ['y.com'], dailyMs: 2000 },
      { id: 'b', domains: [], dailyMs: 1000 },
      null,
      { id: 'c', name: 'Third', domains: ['z.com'], dailyMs: 3000 },
    ]);
    expect(out.map((l) => [l.id, l.name])).toEqual([
      ['a', 'First'],
      ['c', 'Third'],
    ]);
  });
});

describe('sanitizeDayUsage', () => {
  it('returns an empty map for non-objects', () => {
    expect(sanitizeDayUsage(null)).toEqual({});
    expect(sanitizeDayUsage([1, 2])).toEqual({});
    expect(sanitizeDayUsage('x')).toEqual({});
  });

  it('drops arrays that are not exactly 24 long', () => {
    expect(sanitizeDayUsage({ 'twitter.com': [1, 2, 3] })).toEqual({});
    expect(sanitizeDayUsage({ 'twitter.com': 'nope' })).toEqual({});
  });

  it('drops domains that are not in normalized form', () => {
    const hours = new Array<number>(24).fill(1);
    expect(sanitizeDayUsage({ 'www.x.com': hours, 'x.com': hours })).toEqual({ 'x.com': hours });
  });

  it('clamps and sanitizes hour values', () => {
    const raw = [-5, 'x', NaN, 1.4, 99999999999, ...new Array<number>(19).fill(0)];
    const out = sanitizeDayUsage({ 'reddit.com': raw });
    expect(out['reddit.com']!.slice(0, 5)).toEqual([0, 0, 0, 1, HOUR]);
    expect(out['reddit.com']).toHaveLength(24);
  });
});

describe('sanitizeUnlocks', () => {
  it('returns an empty list for non-arrays', () => {
    expect(sanitizeUnlocks(null)).toEqual([]);
    expect(sanitizeUnlocks({})).toEqual([]);
  });

  it('keeps well-formed unlocks and drops the rest', () => {
    const out = sanitizeUnlocks([
      { limitId: 'l1', at: 1000, graceMs: 300000, level: 1 },
      { limitId: 5, at: 1000, graceMs: 1, level: 1 },
      { limitId: 'l2', at: 'nope', graceMs: 1, level: 1 },
      { limitId: 'l3', at: '2000', graceMs: '60000', level: '2' },
      null,
    ]);
    expect(out).toEqual([
      { limitId: 'l1', at: 1000, graceMs: 300000, level: 1 },
      { limitId: 'l3', at: 2000, graceMs: 60000, level: 2 },
    ]);
  });
});

describe('migrate', () => {
  it('stamps the current schema version', () => {
    expect(migrate({ foo: 1, schemaVersion: 0 }, 0)).toEqual({
      foo: 1,
      schemaVersion: SCHEMA_VERSION,
    });
  });
});

describe('parseImport and buildExport', () => {
  const settings: Settings = sanitizeSettings({ resetHour: 4, ignoredDomains: ['x.com'] });
  const limits = [validLimit()];
  const usage: Record<string, DayUsage> = {
    '2026-11-20': { 'twitter.com': hoursWith({ 14: 90000, 15: 1000 }) },
  };
  const unlocks: Record<string, Unlock[]> = {
    '2026-11-20': [{ limitId: 'l1', at: 1700000000000, graceMs: 300000, level: 1 }],
  };

  it('round-trips a bundle through JSON', () => {
    const bundle = buildExport(settings, limits, usage, unlocks, Date.UTC(2026, 10, 20, 12));
    expect(bundle.exportedAt).toBe('2026-11-20T12:00:00.000Z');
    const parsed = parseImport(JSON.stringify(bundle));
    expect(parsed).toEqual(bundle);
  });

  it('buildExport uses the current time by default', () => {
    const bundle = buildExport(settings, [], {}, {});
    expect(typeof bundle.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(bundle.exportedAt))).toBe(false);
    expect(bundle.app).toBe('dwell');
    expect(bundle.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('throws ImportError for invalid JSON', () => {
    expect(() => parseImport('{not json')).toThrow(ImportError);
    expect(() => parseImport('{not json')).toThrow('not valid JSON');
  });

  it('throws ImportError for a file from another app', () => {
    const err = catchError(() => parseImport(JSON.stringify({ app: 'other', schemaVersion: 1 })));
    expect(err).toBeInstanceOf(ImportError);
    expect((err as Error).message).toMatch(/does not look like a Dwell backup/);
  });

  it('throws ImportError for JSON that is not an object', () => {
    expect(() => parseImport('null')).toThrow(ImportError);
    expect(() => parseImport('[]')).toThrow(ImportError);
  });

  it('throws ImportError for a newer schema version', () => {
    const err = catchError(() =>
      parseImport(JSON.stringify({ app: 'dwell', schemaVersion: SCHEMA_VERSION + 1 })),
    );
    expect(err).toBeInstanceOf(ImportError);
    expect((err as Error).message).toMatch(/newer version/);
  });

  it('throws ImportError for version 0 and missing versions', () => {
    const zero = catchError(() => parseImport(JSON.stringify({ app: 'dwell', schemaVersion: 0 })));
    expect(zero).toBeInstanceOf(ImportError);
    expect((zero as Error).message).toMatch(/Unknown backup version/);
    expect(() => parseImport(JSON.stringify({ app: 'dwell' }))).toThrow(ImportError);
  });

  it('drops invalid day keys and sanitizes the rest', () => {
    const raw = {
      app: 'dwell',
      schemaVersion: 1,
      usage: {
        '2026-02-30': { 'x.com': hoursWith({ 1: 5 }) },
        bogus: { 'x.com': hoursWith({ 1: 5 }) },
        '2026-11-20': { 'x.com': hoursWith({ 1: 5 }) },
      },
      unlocks: { '2026-11-20': 'nope' },
    };
    const out = parseImport(JSON.stringify(raw));
    expect(Object.keys(out.usage)).toEqual(['2026-11-20']);
    expect(out.unlocks).toEqual({ '2026-11-20': [] });
    expect(out.settings).toEqual(sanitizeSettings(undefined));
    expect(out.limits).toEqual([]);
  });

  it('tolerates missing usage/unlocks and fills in exportedAt', () => {
    const out = parseImport(JSON.stringify({ app: 'dwell', schemaVersion: 1 }));
    expect(out.usage).toEqual({});
    expect(out.unlocks).toEqual({});
    expect(typeof out.exportedAt).toBe('string');
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('toCsv', () => {
  it('writes only the header for empty usage', () => {
    expect(toCsv({})).toBe('date,domain,hour,seconds\n');
  });

  it('writes one row per non-zero hour, with seconds rounded', () => {
    const csv = toCsv({
      '2026-11-20': { 'twitter.com': hoursWith({ 14: 61000, 15: 1499 }) },
    });
    expect(csv).toBe(
      [
        'date,domain,hour,seconds',
        '2026-11-20,twitter.com,14,61',
        '2026-11-20,twitter.com,15,1',
        '',
      ].join('\n'),
    );
  });

  it('skips zero hours entirely', () => {
    const csv = toCsv({ '2026-11-20': { 'x.com': hoursWith({ 3: 5000 }) } });
    expect(csv.split('\n').filter((l) => l.includes('x.com'))).toEqual(['2026-11-20,x.com,3,5']);
  });

  it('sorts days and domains', () => {
    const csv = toCsv({
      '2026-11-21': { 'b.com': hoursWith({ 0: 1000 }) },
      '2026-11-20': { 'z.com': hoursWith({ 0: 1000 }), 'a.com': hoursWith({ 0: 1000 }) },
    });
    const rows = csv.trim().split('\n').slice(1);
    expect(rows).toEqual(['2026-11-20,a.com,0,1', '2026-11-20,z.com,0,1', '2026-11-21,b.com,0,1']);
  });

  it('defuses formula injection in domain cells and quotes them', () => {
    const csv = toCsv({ '2026-11-20': { '=HYPERLINK("x")': hoursWith({ 3: 5000 }) } });
    const row = csv.trim().split('\n')[1]!;
    expect(row).toBe('2026-11-20,"\'=HYPERLINK(""x"")",3,5');
    expect(row.split(',')[1]!.startsWith('=')).toBe(false);
  });
});

describe('expiredDays', () => {
  const days = ['2026-11-01', '2026-11-14', '2026-11-15', '2026-11-20'];

  it('returns days older than the retention window (today counts as day 1)', () => {
    // 7-day retention keeps 2026-11-14 .. 2026-11-20.
    expect(expiredDays(days, '2026-11-20', 7)).toEqual(['2026-11-01']);
  });

  it('with 1-day retention only today survives', () => {
    expect(expiredDays(days, '2026-11-20', 1)).toEqual(['2026-11-01', '2026-11-14', '2026-11-15']);
  });

  it('returns nothing when everything is recent', () => {
    expect(expiredDays(days, '2026-11-20', 365)).toEqual([]);
  });
});

function catchError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}
