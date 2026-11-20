/**
 * Typed access to everything Overstay persists. All data lives in
 * `browser.storage.local` on this device; nothing is ever sent anywhere.
 *
 * Layout:
 *   settings            Settings
 *   limits              Limit[]
 *   schemaVersion       number
 *   grace               Record<limitId, graceUntil timestamp>
 *   usage:YYYY-MM-DD    DayUsage (ms per domain per hour)
 *   unlocks:YYYY-MM-DD  Unlock[]
 *   notified:YYYY-MM-DD Record<limitId, WarningKind[]>
 * Session storage (cleared on browser restart):
 *   segment             Segment | null (what is being timed right now)
 *   idleState           IdleState
 */
import { browser } from 'wxt/browser';
import {
  SCHEMA_VERSION,
  buildExport,
  expiredDays,
  sanitizeDayUsage,
  sanitizeLimits,
  sanitizeSettings,
  sanitizeUnlocks,
} from '../core/schema';
import { applyChunks, type Chunk, type IdleState, type Segment } from '../core/tracker';
import { isDayKey, type DayKey } from '../core/time';
import type { DayUsage, ExportBundle, Limit, Settings, Unlock } from '../core/types';
import type { WarningKind } from '../core/limits';

export const KEYS = {
  settings: 'settings',
  limits: 'limits',
  schemaVersion: 'schemaVersion',
  grace: 'grace',
  firstDay: 'firstDay',
  usage: (day: DayKey) => `usage:${day}`,
  unlocks: (day: DayKey) => `unlocks:${day}`,
  notified: (day: DayKey) => `notified:${day}`,
} as const;

const SESSION_KEYS = { segment: 'segment', idle: 'idleState' } as const;

const DAY_PREFIXES = ['usage:', 'unlocks:', 'notified:'] as const;

async function getOne<T>(key: string): Promise<T | undefined> {
  const res = await browser.storage.local.get(key);
  return res[key] as T | undefined;
}

// ---------- settings & limits ----------

export async function getSettings(): Promise<Settings> {
  return sanitizeSettings(await getOne(KEYS.settings));
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = sanitizeSettings({ ...(await getSettings()), ...patch });
  await browser.storage.local.set({ [KEYS.settings]: next });
  return next;
}

export async function getLimits(): Promise<Limit[]> {
  return sanitizeLimits(await getOne(KEYS.limits));
}

export async function saveLimits(limits: Limit[]): Promise<Limit[]> {
  const clean = sanitizeLimits(limits);
  await browser.storage.local.set({ [KEYS.limits]: clean });
  return clean;
}

export async function upsertLimit(limit: Limit): Promise<Limit[]> {
  const limits = await getLimits();
  const i = limits.findIndex((l) => l.id === limit.id);
  if (i >= 0) limits[i] = limit;
  else limits.push(limit);
  return saveLimits(limits);
}

export async function deleteLimit(id: string): Promise<Limit[]> {
  return saveLimits((await getLimits()).filter((l) => l.id !== id));
}

// ---------- usage ----------

export async function getUsage(day: DayKey): Promise<DayUsage> {
  return sanitizeDayUsage(await getOne(KEYS.usage(day)));
}

export async function getUsageRange(days: readonly DayKey[]): Promise<Record<DayKey, DayUsage>> {
  if (days.length === 0) return {};
  const res = await browser.storage.local.get(days.map(KEYS.usage));
  const out: Record<DayKey, DayUsage> = {};
  for (const day of days) {
    const raw = res[KEYS.usage(day)];
    if (raw) out[day] = sanitizeDayUsage(raw);
  }
  return out;
}

/** Add tracked time chunks to storage. */
export async function recordChunks(chunks: Chunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const days = [...new Set(chunks.map((c) => c.day))];
  const usage = await getUsageRange(days);
  const touched = applyChunks(usage, chunks);
  const update: Record<string, unknown> = {};
  for (const day of touched) update[KEYS.usage(day)] = usage[day];
  const firstDay = await getOne<string>(KEYS.firstDay);
  const earliest = days.slice().sort()[0]!;
  if (!firstDay || earliest < firstDay) update[KEYS.firstDay] = earliest;
  await browser.storage.local.set(update);
}

export async function getFirstDay(): Promise<DayKey | null> {
  const v = await getOne<string>(KEYS.firstDay);
  return v && isDayKey(v) ? v : null;
}

/** Every day key that has stored data of any kind. */
export async function listDataDays(): Promise<DayKey[]> {
  const all = await browser.storage.local.get(null);
  const days = new Set<DayKey>();
  for (const key of Object.keys(all)) {
    for (const prefix of DAY_PREFIXES) {
      if (key.startsWith(prefix)) {
        const day = key.slice(prefix.length);
        if (isDayKey(day)) days.add(day);
      }
    }
  }
  return [...days].sort();
}

/** Delete data older than the retention window. Returns the number of days removed. */
export async function pruneExpired(today: DayKey, retentionDays: number): Promise<number> {
  const expired = expiredDays(await listDataDays(), today, retentionDays);
  if (expired.length) {
    await browser.storage.local.remove(expired.flatMap((d) => DAY_PREFIXES.map((p) => p + d)));
  }
  return expired.length;
}

// ---------- unlocks, grace & notifications ----------

export async function getUnlocks(day: DayKey): Promise<Unlock[]> {
  return sanitizeUnlocks(await getOne(KEYS.unlocks(day)));
}

export async function getUnlocksRange(days: readonly DayKey[]): Promise<Record<DayKey, Unlock[]>> {
  if (days.length === 0) return {};
  const res = await browser.storage.local.get(days.map(KEYS.unlocks));
  const out: Record<DayKey, Unlock[]> = {};
  for (const day of days) {
    const raw = res[KEYS.unlocks(day)];
    if (raw) out[day] = sanitizeUnlocks(raw);
  }
  return out;
}

export async function addUnlock(day: DayKey, unlock: Unlock): Promise<void> {
  const list = await getUnlocks(day);
  list.push(unlock);
  await browser.storage.local.set({ [KEYS.unlocks(day)]: list });
}

export async function getGrace(): Promise<Record<string, number>> {
  const raw = await getOne<Record<string, unknown>>(KEYS.grace);
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object') {
    for (const [id, until] of Object.entries(raw)) {
      if (typeof until === 'number' && Number.isFinite(until)) out[id] = until;
    }
  }
  return out;
}

export async function setGrace(limitId: string, until: number, now = Date.now()): Promise<void> {
  const grace = await getGrace();
  // Drop expired entries while we're here.
  for (const [id, t] of Object.entries(grace)) if (t <= now) delete grace[id];
  grace[limitId] = until;
  await browser.storage.local.set({ [KEYS.grace]: grace });
}

export async function getNotified(day: DayKey): Promise<Record<string, WarningKind[]>> {
  return (await getOne<Record<string, WarningKind[]>>(KEYS.notified(day))) ?? {};
}

export async function setNotified(
  day: DayKey,
  value: Record<string, WarningKind[]>,
): Promise<void> {
  await browser.storage.local.set({ [KEYS.notified(day)]: value });
}

// ---------- session state ----------

export async function getSegment(): Promise<Segment | null> {
  const res = await browser.storage.session.get(SESSION_KEYS.segment);
  const seg = res[SESSION_KEYS.segment] as Segment | null | undefined;
  return seg && typeof seg.domain === 'string' && typeof seg.since === 'number' ? seg : null;
}

export async function setSegment(segment: Segment | null): Promise<void> {
  await browser.storage.session.set({ [SESSION_KEYS.segment]: segment });
}

export async function getIdleState(): Promise<IdleState> {
  const res = await browser.storage.session.get(SESSION_KEYS.idle);
  const v = res[SESSION_KEYS.idle];
  return v === 'idle' || v === 'locked' ? v : 'active';
}

export async function setIdleState(state: IdleState): Promise<void> {
  await browser.storage.session.set({ [SESSION_KEYS.idle]: state });
}

// ---------- backup ----------

export async function exportAll(now = Date.now()): Promise<ExportBundle> {
  const all = await browser.storage.local.get(null);
  const usage: Record<DayKey, DayUsage> = {};
  const unlocks: Record<DayKey, Unlock[]> = {};
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('usage:') && isDayKey(key.slice(6)))
      usage[key.slice(6)] = sanitizeDayUsage(value);
    if (key.startsWith('unlocks:') && isDayKey(key.slice(8)))
      unlocks[key.slice(8)] = sanitizeUnlocks(value);
  }
  return buildExport(
    sanitizeSettings(all[KEYS.settings]),
    sanitizeLimits(all[KEYS.limits]),
    usage,
    unlocks,
    now,
  );
}

/** Replace all stored data with a validated backup. */
export async function importAll(bundle: ExportBundle): Promise<void> {
  await clearAll();
  const data: Record<string, unknown> = {
    [KEYS.schemaVersion]: SCHEMA_VERSION,
    [KEYS.settings]: bundle.settings,
    [KEYS.limits]: bundle.limits,
  };
  const days = Object.keys(bundle.usage).sort();
  if (days[0]) data[KEYS.firstDay] = days[0];
  for (const [day, u] of Object.entries(bundle.usage)) data[KEYS.usage(day)] = u;
  for (const [day, u] of Object.entries(bundle.unlocks)) data[KEYS.unlocks(day)] = u;
  await browser.storage.local.set(data);
}

/** Wipe all local data (settings, limits and history). */
export async function clearAll(): Promise<void> {
  await browser.storage.local.clear();
  await browser.storage.local.set({ [KEYS.schemaVersion]: SCHEMA_VERSION });
  await browser.storage.session.set({ [SESSION_KEYS.segment]: null });
}

/** Run once on startup/install: stamp or upgrade the schema version. */
export async function ensureSchema(): Promise<void> {
  const v = await getOne<number>(KEYS.schemaVersion);
  if (v !== SCHEMA_VERSION) {
    // Future migrations of stored data go here (see core/schema.ts `migrate`).
    await browser.storage.local.set({ [KEYS.schemaVersion]: SCHEMA_VERSION });
  }
}
