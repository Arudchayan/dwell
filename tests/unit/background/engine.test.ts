import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { browser } from 'wxt/browser';
import { buildRules, syncRules } from '../../../src/background/blocker';
import {
  dailyMaintenance,
  getChallenge,
  onIdleChange,
  scheduleAlarms,
  tick,
  unlock,
} from '../../../src/background/engine';
import { dayKey, MINUTE, SECOND } from '../../../src/core/time';
import type { Limit } from '../../../src/core/types';
import { parseBlockedParams } from '../../../src/shared/blocked-url';
import * as store from '../../../src/storage';

type Rule = { id: number; condition: { requestDomains?: string[] }; action: unknown };

let rules: Rule[] = [];
let notifications: { id: string; title: string }[] = [];

const T0 = new Date(2026, 10, 20, 10, 0, 0).getTime(); // Fri 2026-11-20 10:00 (UTC in tests)
const TODAY = '2026-11-20';

function installStubs() {
  rules = [];
  notifications = [];
  // APIs the fake browser does not implement.
  Object.assign(browser, {
    declarativeNetRequest: {
      getDynamicRules: vi.fn(async () => rules.slice()),
      updateDynamicRules: vi.fn(
        async ({
          removeRuleIds = [],
          addRules = [],
        }: {
          removeRuleIds?: number[];
          addRules?: Rule[];
        }) => {
          rules = rules.filter((r) => !removeRuleIds.includes(r.id)).concat(addRules);
        },
      ),
    },
    idle: { setDetectionInterval: vi.fn(), queryState: vi.fn(async () => 'active') },
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setBadgeBackgroundColor: vi.fn(async () => undefined),
    },
  });
  // The fake's getLastFocused returns the *previously* focused window; real
  // browsers return the current one.
  vi.spyOn(browser.windows, 'getLastFocused').mockImplementation(((opts?: object) =>
    browser.windows.getCurrent(opts)) as never);
  vi.spyOn(browser.notifications, 'create').mockImplementation((async (
    id: string,
    opts: { title: string },
  ) => {
    notifications.push({ id, title: opts.title });
    return id;
  }) as never);
}

async function openTab(url: string, { focused = true } = {}) {
  const win = await browser.windows.create({ focused });
  const tab = await browser.tabs.create({ windowId: win!.id, url, active: true });
  return { win, tab };
}

const twitter: Limit = {
  id: 'tw',
  name: 'Twitter',
  domains: ['twitter.com', 'x.com'],
  dailyMs: 10 * MINUTE,
  days: [],
  enabled: true,
};

async function seedUsage(domain: string, ms: number) {
  const hours = new Array<number>(24).fill(0);
  hours[9] = ms;
  await browser.storage.local.set({ [`usage:${TODAY}`]: { [domain]: hours } });
}

beforeEach(() => {
  fakeBrowser.reset();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  installStubs();
});

describe('tracking', () => {
  it('credits time between ticks to the active, focused tab', async () => {
    await openTab('https://www.youtube.com/watch?v=1');
    await tick('startup', T0);
    await tick('heartbeat', T0 + 30 * SECOND);
    await tick('heartbeat', T0 + 45 * SECOND);
    const usage = await store.getUsage(TODAY);
    expect(usage['youtube.com']?.[10]).toBe(45 * SECOND);
  });

  it('does not count time when no browser window has focus', async () => {
    await openTab('https://youtube.com/', { focused: false });
    await tick('startup', T0);
    await tick('heartbeat', T0 + 30 * SECOND);
    expect(await store.getUsage(TODAY)).toEqual({});
  });

  it('does not count browser-internal pages or ignored domains', async () => {
    await store.saveSettings({ ignoredDomains: ['example.com'] });
    await openTab('https://example.com/');
    await tick('startup', T0);
    await tick('heartbeat', T0 + 30 * SECOND);
    await openTab('chrome://extensions');
    await tick('tab', T0 + 31 * SECOND);
    await tick('heartbeat', T0 + 60 * SECOND);
    expect(await store.getUsage(TODAY)).toEqual({});
  });

  it('switches domains when the active tab changes', async () => {
    const { win } = await openTab('https://reddit.com/r/all');
    await tick('startup', T0);
    await browser.tabs.create({ windowId: win!.id, url: 'https://github.com/', active: true });
    await tick('tab', T0 + 20 * SECOND);
    await tick('heartbeat', T0 + 50 * SECOND);
    const usage = await store.getUsage(TODAY);
    expect(usage['reddit.com']?.[10]).toBe(20 * SECOND);
    expect(usage['github.com']?.[10]).toBe(30 * SECOND);
  });

  it('backdates the end of a segment by the idle threshold when the user goes idle', async () => {
    await store.saveSettings({ idleSeconds: 60 });
    await openTab('https://news.ycombinator.com/');
    await tick('startup', T0);
    await store.setIdleState('idle');
    await tick('idle', T0 + 5 * MINUTE);
    const usage = await store.getUsage(TODAY);
    // 5 minutes, minus the 60s it took to detect idleness, capped by MAX_GAP (2 min).
    expect(usage['ycombinator.com']?.[10]).toBe(2 * MINUTE);
    expect(await store.getSegment()).toBeNull();
  });

  it('keeps counting while idle if the tab is audible and the setting allows it', async () => {
    const { tab } = await openTab('https://youtube.com/');
    await browser.tabs.update(tab.id!, { muted: false });
    // The fake browser has no `audible`; patch the query result instead.
    const query = browser.tabs.query.bind(browser.tabs);
    vi.spyOn(browser.tabs, 'query').mockImplementation((async (q: object) =>
      (await query(q)).map((t) => ({ ...t, audible: true }))) as never);
    await onIdleChange('idle');
    await tick('heartbeat', T0);
    await tick('heartbeat', T0 + 30 * SECOND);
    expect((await store.getUsage(TODAY))['youtube.com']?.[10]).toBe(30 * SECOND);
  });
});

describe('limits and blocking', () => {
  it('blocks a site once its limit is used up and redirects open tabs', async () => {
    await store.saveLimits([twitter]);
    await seedUsage('x.com', 10 * MINUTE);
    const { tab } = await openTab('https://twitter.com/home');
    const res = await tick('heartbeat', T0);
    expect(res.blocked).toEqual(['twitter.com', 'x.com']);
    expect(rules.map((r) => r.condition.requestDomains)).toEqual([['twitter.com'], ['x.com']]);
    const updated = await browser.tabs.get(tab.id!);
    expect(updated.url).toContain('/blocked.html?limit=tw&url=');
  });

  it('removes block rules when the limit is raised', async () => {
    await store.saveLimits([twitter]);
    await seedUsage('x.com', 10 * MINUTE);
    await tick('heartbeat', T0);
    expect(rules).toHaveLength(2);
    await store.saveLimits([{ ...twitter, dailyMs: 60 * MINUTE }]);
    await tick('storage', T0 + SECOND);
    expect(rules).toHaveLength(0);
  });

  it('does not block on weekdays where the limit is inactive', async () => {
    await store.saveLimits([{ ...twitter, days: [1] }]); // Mondays only; T0 is a Friday
    await seedUsage('x.com', 60 * MINUTE);
    expect((await tick('heartbeat', T0)).blocked).toEqual([]);
  });

  it('sends each warning only once per day', async () => {
    await store.saveLimits([{ ...twitter, dailyMs: 60 * MINUTE }]);
    await seedUsage('x.com', 50 * MINUTE);
    await tick('heartbeat', T0);
    await tick('heartbeat', T0 + SECOND);
    expect(notifications.map((n) => n.id)).toEqual(['overstay:tw:eighty']);
    await seedUsage('x.com', 60 * MINUTE);
    await tick('heartbeat', T0 + 2 * SECOND);
    expect(notifications.map((n) => n.id)).toEqual(['overstay:tw:eighty', 'overstay:tw:reached']);
  });

  it('respects the notifications setting', async () => {
    await store.saveSettings({ notifications: false });
    await store.saveLimits([twitter]);
    await seedUsage('x.com', 10 * MINUTE);
    await tick('heartbeat', T0);
    expect(notifications).toEqual([]);
  });

  it('shows remaining time on the badge for the active site', async () => {
    await store.saveLimits([twitter]);
    await seedUsage('x.com', 4 * MINUTE);
    await openTab('https://x.com/');
    await tick('heartbeat', T0);
    expect(browser.action.setBadgeText).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: '6m' }),
    );
  });
});

describe('guilt-trip unlock', () => {
  beforeEach(async () => {
    await store.saveLimits([twitter]);
    await seedUsage('x.com', 10 * MINUTE);
    await tick('heartbeat', T0);
  });

  it('builds a challenge that escalates with every unlock', async () => {
    const first = await getChallenge('tw', T0);
    expect(first).toMatchObject({
      level: 1,
      strict: false,
      stillBlocked: true,
      limitName: 'Twitter',
    });
    expect(first!.text).toContain('Twitter');
    expect(first!.graceMs).toBe(5 * MINUTE);

    const res = await unlock('tw', first!.text!, T0);
    expect(res.ok).toBe(true);
    expect(rules).toHaveLength(0);

    // Grace over → blocked again, and the next sentence is longer.
    await tick('alarm', T0 + 6 * MINUTE);
    expect(rules).toHaveLength(2);
    const second = await getChallenge('tw', T0 + 6 * MINUTE);
    expect(second!.level).toBe(2);
    expect(second!.text!.length).toBeGreaterThan(first!.text!.length);
    expect(await store.getUnlocks(TODAY)).toEqual([
      { limitId: 'tw', at: T0, graceMs: 5 * MINUTE, level: 1 },
    ]);
  });

  it('rejects text that does not match exactly', async () => {
    const info = await getChallenge('tw', T0);
    const res = await unlock('tw', info!.text!.toLowerCase(), T0);
    expect(res).toEqual({ ok: false, reason: 'mismatch' });
    expect(rules).toHaveLength(2);
  });

  it('accepts the sentence with stray whitespace', async () => {
    const info = await getChallenge('tw', T0);
    const res = await unlock('tw', `  ${info!.text!.replace(/ /g, '  ')}  `, T0);
    expect(res.ok).toBe(true);
  });

  it('refuses every override in strict mode', async () => {
    await store.saveSettings({ strictMode: true });
    const info = await getChallenge('tw', T0);
    expect(info!.text).toBeNull();
    expect(await unlock('tw', 'anything', T0)).toEqual({ ok: false, reason: 'strict' });
  });

  it('refuses unknown limits and limits that are not blocked', async () => {
    expect(await unlock('nope', 'x', T0)).toEqual({ ok: false, reason: 'unknown-limit' });
    expect(await getChallenge('nope', T0)).toBeNull();
    await store.saveLimits([{ ...twitter, dailyMs: 60 * MINUTE }]);
    const info = await getChallenge('tw', T0);
    expect(await unlock('tw', info!.text!, T0)).toEqual({ ok: false, reason: 'not-blocked' });
  });

  it('schedules an alarm for the end of the grace period', async () => {
    const info = await getChallenge('tw', T0);
    await unlock('tw', info!.text!, T0);
    const alarm = await browser.alarms.get('overstay:grace:tw');
    expect(alarm?.scheduledTime).toBe(T0 + 5 * MINUTE + 500);
  });
});

describe('maintenance', () => {
  it('removes alarms left over from the Dwell-era build', async () => {
    await browser.alarms.create('dwell:heartbeat', { periodInMinutes: 0.5 });
    await scheduleAlarms(undefined, T0);
    expect(await browser.alarms.get('dwell:heartbeat')).toBeUndefined();
    expect(await browser.alarms.get('overstay:heartbeat')).toBeDefined();
  });

  it('schedules the heartbeat and the daily reset alarm', async () => {
    await store.saveSettings({ resetHour: 4 });
    await scheduleAlarms(undefined, T0);
    expect(await browser.alarms.get('overstay:heartbeat')).toBeDefined();
    const reset = await browser.alarms.get('overstay:reset');
    expect(reset?.scheduledTime).toBe(new Date(2026, 10, 21, 4).getTime());
  });

  it('prunes history beyond the retention window', async () => {
    await store.saveSettings({ retentionDays: 30 });
    await browser.storage.local.set({
      'usage:2026-01-01': { 'a.com': new Array(24).fill(1) },
      'unlocks:2026-01-01': [],
      [`usage:${TODAY}`]: { 'a.com': new Array(24).fill(1) },
    });
    await dailyMaintenance(T0);
    expect(await store.listDataDays()).toEqual([TODAY]);
  });
});

describe('blocker', () => {
  it('builds redirect rules that carry the limit id and original URL', () => {
    const [rule] = buildRules(new Map([['x.com', 'tw']]));
    expect(rule).toMatchObject({
      id: 1,
      condition: { requestDomains: ['x.com'], resourceTypes: ['main_frame'] },
      action: { type: 'redirect' },
    });
    expect(JSON.stringify(rule)).toContain('blocked.html?limit=tw&raw=\\\\0');
  });

  it('skips updates when the rule set is unchanged', async () => {
    const map = new Map([['x.com', 'tw']]);
    expect(await syncRules(map)).toBe(true);
    expect(await syncRules(map)).toBe(false);
    expect(await syncRules(new Map())).toBe(true);
    expect(rules).toEqual([]);
  });
});

describe('storage', () => {
  it('round-trips a full export through import', async () => {
    await store.saveLimits([twitter]);
    await store.saveSettings({ graceMinutes: 10 });
    await store.recordChunks([{ day: TODAY, hour: 9, domain: 'x.com', ms: 1234 }]);
    await store.addUnlock(TODAY, { limitId: 'tw', at: T0, graceMs: 1, level: 1 });
    const bundle = await store.exportAll(T0);
    await store.clearAll();
    expect(await store.getLimits()).toEqual([]);
    await store.importAll(bundle);
    expect(await store.getLimits()).toEqual([twitter]);
    expect((await store.getSettings()).graceMinutes).toBe(10);
    expect((await store.getUsage(TODAY))['x.com']?.[9]).toBe(1234);
    expect(await store.getUnlocks(TODAY)).toHaveLength(1);
    expect(await store.getFirstDay()).toBe(TODAY);
  });

  it('tracks the first day with data', async () => {
    await store.recordChunks([{ day: TODAY, hour: 1, domain: 'a.com', ms: 1 }]);
    await store.recordChunks([{ day: '2026-11-01', hour: 1, domain: 'a.com', ms: 1 }]);
    await store.recordChunks([{ day: '2026-11-10', hour: 1, domain: 'a.com', ms: 1 }]);
    expect(await store.getFirstDay()).toBe('2026-11-01');
  });

  it('upserts and deletes limits', async () => {
    await store.upsertLimit(twitter);
    await store.upsertLimit({ ...twitter, name: 'X' });
    expect((await store.getLimits()).map((l) => l.name)).toEqual(['X']);
    await store.deleteLimit('tw');
    expect(await store.getLimits()).toEqual([]);
  });

  it('expires stale grace entries when setting a new one', async () => {
    await store.setGrace('old', T0 - 1, T0);
    await store.setGrace('new', T0 + MINUTE, T0);
    expect(await store.getGrace()).toEqual({ new: T0 + MINUTE });
  });

  it('day keys respect the reset hour', () => {
    expect(dayKey(new Date(2026, 10, 21, 3).getTime(), 4)).toBe(TODAY);
  });
});

describe('parseBlockedParams', () => {
  it('reads the raw URL appended by redirect rules, including its own query string', () => {
    expect(parseBlockedParams('?limit=tw&raw=https://x.com/search?q=a&b=c')).toEqual({
      limitId: 'tw',
      original: 'https://x.com/search?q=a&b=c',
    });
  });

  it('reads an encoded url parameter', () => {
    expect(
      parseBlockedParams(`?limit=tw&url=${encodeURIComponent('https://x.com/a?b=1')}`),
    ).toEqual({ limitId: 'tw', original: 'https://x.com/a?b=1' });
  });

  it('drops non-http URLs and handles missing values', () => {
    expect(parseBlockedParams('?limit=tw&url=javascript:alert(1)').original).toBeNull();
    expect(parseBlockedParams('?limit=tw&raw=not a url').original).toBeNull();
    expect(parseBlockedParams('')).toEqual({ limitId: null, original: null });
  });
});
