import { isDayKey, type DayKey, addDays } from './time';
import { domainFromHostname, normalizeDomainInput } from './domain';
import type { DayUsage, ExportBundle, Limit, Settings, Unlock } from './types';

export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  idleSeconds: 60,
  countAudibleWhenIdle: true,
  resetHour: 0,
  graceMinutes: 5,
  strictMode: false,
  notifications: true,
  ignoredDomains: [],
  retentionDays: 365,
  customSentences: [],
  theme: 'system',
});

const MAX_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_HOUR_MS = 60 * 60 * 1000;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitizeDomains(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const d = normalizeDomainInput(x);
    if (d) out.add(d);
  }
  return [...out];
}

/** Coerce anything into valid settings, falling back to defaults field by field. */
export function sanitizeSettings(raw: unknown): Settings {
  const s = isObject(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const sentences = Array.isArray(s.customSentences)
    ? s.customSentences
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().replace(/\s+/g, ' '))
        .filter((x) => x.length >= 10 && x.length <= 1000)
        .slice(0, 100)
    : [];
  return {
    idleSeconds: clampInt(s.idleSeconds, 15, 3600, d.idleSeconds),
    countAudibleWhenIdle: bool(s.countAudibleWhenIdle, d.countAudibleWhenIdle),
    resetHour: clampInt(s.resetHour, 0, 23, d.resetHour),
    graceMinutes: clampInt(s.graceMinutes, 1, 60, d.graceMinutes),
    strictMode: bool(s.strictMode, d.strictMode),
    notifications: bool(s.notifications, d.notifications),
    ignoredDomains: sanitizeDomains(s.ignoredDomains),
    retentionDays: clampInt(s.retentionDays, 7, 3650, d.retentionDays),
    customSentences: sentences,
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
  };
}

/** Validate a stored/imported limit. Returns `null` if it is unusable. */
export function sanitizeLimit(raw: unknown): Limit | null {
  if (!isObject(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : null;
  if (!id) return null;
  const domains = sanitizeDomains(raw.domains);
  if (domains.length === 0) return null;
  const rawMs = typeof raw.dailyMs === 'number' ? raw.dailyMs : Number.NaN;
  if (!Number.isFinite(rawMs) || rawMs < 0) return null;
  const dailyMs = clampInt(rawMs, 0, MAX_DAY_MS, 0);
  const days = Array.isArray(raw.days)
    ? [
        ...new Set(raw.days.filter((x): x is number => Number.isInteger(x) && x >= 0 && x <= 6)),
      ].sort((a, b) => a - b)
    : [];
  const name =
    typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 60) : domains[0]!;
  return { id, name, domains, dailyMs, days, enabled: raw.enabled !== false };
}

export function sanitizeLimits(raw: unknown): Limit[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Limit[] = [];
  for (const item of raw) {
    const l = sanitizeLimit(item);
    if (l && !seen.has(l.id)) {
      seen.add(l.id);
      out.push(l);
    }
  }
  return out;
}

/** Validate a day's usage map, dropping malformed entries. */
export function sanitizeDayUsage(raw: unknown): DayUsage {
  const out: DayUsage = {};
  if (!isObject(raw)) return out;
  for (const [domain, hours] of Object.entries(raw)) {
    if (!Array.isArray(hours) || hours.length !== 24) continue;
    if (domainFromHostname(domain) !== domain) continue;
    out[domain] = hours.map((h) =>
      typeof h === 'number' && Number.isFinite(h) && h > 0
        ? Math.min(Math.round(h), MAX_HOUR_MS)
        : 0,
    );
  }
  return out;
}

export function sanitizeUnlocks(raw: unknown): Unlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((u): Unlock[] => {
    if (!isObject(u) || typeof u.limitId !== 'string') return [];
    const at = Number(u.at);
    const graceMs = Number(u.graceMs);
    const level = Number(u.level);
    if (![at, graceMs, level].every(Number.isFinite)) return [];
    return [{ limitId: u.limitId, at, graceMs, level }];
  });
}

export class ImportError extends Error {
  override name = 'ImportError';
}

/**
 * Upgrade data from an older schema version to {@link SCHEMA_VERSION}.
 * When the storage format changes, bump SCHEMA_VERSION and add a step here.
 */
export function migrate(
  data: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  const current = { ...data };
  // Version 1 is the first release, so there is nothing to upgrade yet.
  void fromVersion;
  current.schemaVersion = SCHEMA_VERSION;
  return current;
}

/** Parse and validate a JSON backup created by {@link buildExport}. */
export function parseImport(json: string): ExportBundle {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ImportError('The file is not valid JSON.');
  }
  if (!isObject(data) || data.app !== 'dwell') {
    throw new ImportError('This does not look like a Dwell backup.');
  }
  const version = Number(data.schemaVersion);
  if (!Number.isInteger(version) || version < 1) throw new ImportError('Unknown backup version.');
  if (version > SCHEMA_VERSION) {
    throw new ImportError('This backup was made by a newer version of Dwell. Please update first.');
  }
  const migrated = migrate(data, version);
  const usage: Record<DayKey, DayUsage> = {};
  if (isObject(migrated.usage)) {
    for (const [day, u] of Object.entries(migrated.usage)) {
      if (isDayKey(day)) usage[day] = sanitizeDayUsage(u);
    }
  }
  const unlocks: Record<DayKey, Unlock[]> = {};
  if (isObject(migrated.unlocks)) {
    for (const [day, u] of Object.entries(migrated.unlocks)) {
      if (isDayKey(day)) unlocks[day] = sanitizeUnlocks(u);
    }
  }
  return {
    app: 'dwell',
    schemaVersion: SCHEMA_VERSION,
    exportedAt:
      typeof migrated.exportedAt === 'string' ? migrated.exportedAt : new Date().toISOString(),
    settings: sanitizeSettings(migrated.settings),
    limits: sanitizeLimits(migrated.limits),
    usage,
    unlocks,
  };
}

export function buildExport(
  settings: Settings,
  limits: Limit[],
  usage: Record<DayKey, DayUsage>,
  unlocks: Record<DayKey, Unlock[]>,
  now = Date.now(),
): ExportBundle {
  return {
    app: 'dwell',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    settings,
    limits,
    usage,
    unlocks,
  };
}

/** Escape a CSV cell, also defusing spreadsheet formula injection. */
function csvCell(v: string): string {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r']/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with one row per day, domain and hour: `date,domain,hour,seconds`. */
export function toCsv(usage: Record<DayKey, DayUsage>): string {
  const rows = ['date,domain,hour,seconds'];
  for (const day of Object.keys(usage).sort()) {
    const dayUsage = usage[day]!;
    for (const domain of Object.keys(dayUsage).sort()) {
      dayUsage[domain]!.forEach((ms, hour) => {
        if (ms > 0) rows.push([day, csvCell(domain), hour, Math.round(ms / 1000)].join(','));
      });
    }
  }
  return rows.join('\n') + '\n';
}

/** Day keys older than the retention window (today counts as day 1). */
export function expiredDays(days: DayKey[], today: DayKey, retentionDays: number): DayKey[] {
  const cutoff = addDays(today, -(retentionDays - 1));
  return days.filter((d) => d < cutoff);
}
