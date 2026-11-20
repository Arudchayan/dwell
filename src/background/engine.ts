/**
 * The background engine: on every browser event or heartbeat it
 *   1. credits the time since the last tick to the domain that was active,
 *   2. re-evaluates today's limits,
 *   3. updates blocking rules, notifications and the badge.
 * All state is read from and written to storage, so the MV3 service worker can
 * be suspended and restarted at any time without losing data.
 */
import { browser } from 'wxt/browser';
import { domainFromUrl } from '../core/domain';
import {
  blockedDomains,
  dueWarning,
  evaluateAll,
  mostRestrictive,
  msUntilChange,
  statusesForDomain,
  type LimitStatus,
} from '../core/limits';
import { buildChallenge, checkTyping } from '../core/sentences';
import { dayKey, nextResetAt, weekdayOf, SECOND, MINUTE } from '../core/time';
import { activeDomain, advance, type ActivitySnapshot, type IdleState } from '../core/tracker';
import type { Settings } from '../core/types';
import type { ChallengeInfo, UnlockResult } from '../shared/messages';
import * as store from '../storage';
import { redirectOpenTabs, syncRules } from './blocker';
import { ALARMS, graceDurationMs } from './config';
import { showWarning, updateBadge } from './notify';

let queue: Promise<unknown> = Promise.resolve();

/** Run `fn` after every previously queued task, so ticks never interleave. */
export function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export type TickReason =
  'startup' | 'heartbeat' | 'tab' | 'window' | 'idle' | 'storage' | 'alarm' | 'message' | 'timer';

/** Gather what the browser is doing right now. */
export async function takeSnapshot(): Promise<ActivitySnapshot & { tabId?: number }> {
  const idle = await store.getIdleState();
  let win: { focused?: boolean; id?: number } | undefined;
  try {
    win = await browser.windows.getLastFocused({ populate: false });
  } catch {
    win = undefined;
  }
  const [tab] =
    win?.id !== undefined ? await browser.tabs.query({ active: true, windowId: win.id }) : [];
  return {
    url: tab?.url ?? null,
    windowFocused: !!win?.focused,
    idle,
    audible: !!tab?.audible,
    tabId: tab?.id,
  };
}

let preciseTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePrecise(ms: number | null): void {
  if (preciseTimer) clearTimeout(preciseTimer);
  preciseTimer = undefined;
  // Alarms are only accurate to ~30s; for the last minute use a timer so the
  // block lands on time. If the worker is suspended first, the heartbeat
  // alarm still catches it.
  if (ms !== null && ms < MINUTE) {
    preciseTimer = setTimeout(() => void tick('timer'), Math.max(0, ms) + 250);
  }
}

export interface TickResult {
  activeDomain: string | null;
  statuses: LimitStatus[];
  blocked: string[];
}

/** One full update cycle. Safe to call as often as you like. */
export function tick(reason: TickReason, now = Date.now()): Promise<TickResult> {
  return exclusive(async () => {
    const settings = await store.getSettings();
    const snap = await takeSnapshot();
    const next = activeDomain(snap, settings);
    const prev = await store.getSegment();
    // When the idle detector fires, the user actually stopped `idleSeconds` ago.
    const endAt =
      reason === 'idle' && snap.idle !== 'active' ? now - settings.idleSeconds * SECOND : undefined;
    const { segment, chunks } = advance(prev, next, now, {
      resetHour: settings.resetHour,
      endAt,
    });
    await store.recordChunks(chunks);
    await store.setSegment(segment);
    const result = await enforce(settings, now, snap.url, snap.tabId);
    return { activeDomain: next, ...result };
  });
}

async function enforce(
  settings: Settings,
  now: number,
  activeUrl: string | null,
  activeTabId: number | undefined,
): Promise<Omit<TickResult, 'activeDomain'>> {
  const today = dayKey(now, settings.resetHour);
  const [usage, limits, grace] = await Promise.all([
    store.getUsage(today),
    store.getLimits(),
    store.getGrace(),
  ]);
  const statuses = evaluateAll(limits, usage, weekdayOf(today), grace, now);

  // Blocking
  const blockedMap = new Map<string, string>();
  for (const s of statuses) {
    if (s.state !== 'blocked') continue;
    for (const d of s.limit.domains) if (!blockedMap.has(d)) blockedMap.set(d, s.limit.id);
  }
  await syncRules(blockedMap);
  await redirectOpenTabs(blockedMap);

  // Notifications
  const notified = await store.getNotified(today);
  let changed = false;
  for (const s of statuses) {
    const { show, fire } = dueWarning(s, notified[s.limit.id] ?? []);
    if (fire.length === 0) continue;
    notified[s.limit.id] = [...(notified[s.limit.id] ?? []), ...fire];
    changed = true;
    if (show && settings.notifications) await showWarning(show, s);
  }
  if (changed) await store.setNotified(today, notified);

  // Badge & precise timing for the active site
  const domain = domainFromUrl(activeUrl);
  const relevant = domain ? statusesForDomain(statuses, domain) : [];
  try {
    await updateBadge(mostRestrictive(relevant), activeTabId);
  } catch {
    // The tab can disappear between the query and the badge update.
  }
  schedulePrecise(msUntilChange(relevant, now));

  return { statuses, blocked: blockedDomains(statuses) };
}

/** Called when the idle detector reports a new state. */
export async function onIdleChange(state: IdleState): Promise<void> {
  await store.setIdleState(state);
  await tick('idle');
}

/** (Re)create the heartbeat and the daily reset alarm. */
export async function scheduleAlarms(settings?: Settings, now = Date.now()): Promise<void> {
  const s = settings ?? (await store.getSettings());
  await browser.alarms.create(ALARMS.heartbeat, { periodInMinutes: 0.5 });
  await browser.alarms.create(ALARMS.reset, { when: nextResetAt(now, s.resetHour) });
  browser.idle.setDetectionInterval(s.idleSeconds);
}

/** What the block page needs to render the challenge for a limit. */
export async function getChallenge(
  limitId: string,
  now = Date.now(),
): Promise<ChallengeInfo | null> {
  const settings = await store.getSettings();
  const limit = (await store.getLimits()).find((l) => l.id === limitId);
  if (!limit) return null;
  const today = dayKey(now, settings.resetHour);
  const [usage, unlocks, grace] = await Promise.all([
    store.getUsage(today),
    store.getUnlocks(today),
    store.getGrace(),
  ]);
  const status = evaluateAll([limit], usage, weekdayOf(today), grace, now)[0];
  const level = unlocks.filter((u) => u.limitId === limitId).length + 1;
  return {
    limitId,
    limitName: limit.name,
    domains: limit.domains,
    dailyMs: limit.dailyMs,
    usedMs: status?.usedMs ?? 0,
    level,
    text: settings.strictMode
      ? null
      : buildChallenge({
          level,
          siteName: limit.name,
          seed: `${today}:${limitId}`,
          customSentences: settings.customSentences,
        }),
    strict: settings.strictMode,
    graceMs: graceDurationMs(settings.graceMinutes),
    stillBlocked: status?.state === 'blocked',
    graceUntil: status?.state === 'grace' ? (status.graceUntil ?? null) : null,
  };
}

/** Verify a typed challenge and, if correct, start a grace period. */
export async function unlock(
  limitId: string,
  typed: string,
  now = Date.now(),
): Promise<UnlockResult> {
  const info = await getChallenge(limitId, now);
  if (!info) return { ok: false, reason: 'unknown-limit' };
  if (info.strict || info.text === null) return { ok: false, reason: 'strict' };
  if (!info.stillBlocked) return { ok: false, reason: 'not-blocked' };
  if (!checkTyping(info.text, typed).complete) return { ok: false, reason: 'mismatch' };
  const settings = await store.getSettings();
  const graceUntil = now + info.graceMs;
  await exclusive(async () => {
    await store.setGrace(limitId, graceUntil, now);
    await store.addUnlock(dayKey(now, settings.resetHour), {
      limitId,
      at: now,
      graceMs: info.graceMs,
      level: info.level,
    });
  });
  await browser.alarms.create(`${ALARMS.grace}:${limitId}`, { when: graceUntil + 500 });
  await tick('message', now);
  return { ok: true, graceUntil };
}

/** Daily maintenance: drop expired history and re-arm the reset alarm. */
export async function dailyMaintenance(now = Date.now()): Promise<void> {
  const settings = await store.getSettings();
  await store.pruneExpired(dayKey(now, settings.resetHour), settings.retentionDays);
  await scheduleAlarms(settings, now);
}
