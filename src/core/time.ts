/** Time helpers. All functions use the browser's local time zone. */

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** A calendar day key in the form `YYYY-MM-DD`. */
export type DayKey = string;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function keyOf(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The "tracking day" a timestamp belongs to. With `resetHour = 4`, 02:00 on the 5th
 * still counts towards the 4th, so night owls are not reset at midnight.
 */
export function dayKey(ts: number, resetHour = 0): DayKey {
  const d = new Date(ts);
  if (d.getHours() < resetHour) d.setDate(d.getDate() - 1);
  return keyOf(d);
}

/** Local hour of day (0-23) of a timestamp. */
export function hourOf(ts: number): number {
  return new Date(ts).getHours();
}

/** Parse a day key into a local Date at 00:00. */
export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function isDayKey(key: string): key is DayKey {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return keyOf(parseDayKey(key)) === key;
}

/** Shift a day key by `n` calendar days (DST-safe). */
export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}

/** Day of week (0 = Sunday … 6 = Saturday) of a day key. */
export function weekdayOf(key: DayKey): number {
  return parseDayKey(key).getDay();
}

/** The `n` day keys ending at (and including) `end`, oldest first. */
export function lastNDays(end: DayKey, n: number): DayKey[] {
  const out: DayKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

/** Timestamp of the next local `resetHour:00` strictly after `ts`. */
export function nextResetAt(ts: number, resetHour = 0): number {
  const d = new Date(ts);
  d.setHours(resetHour, 0, 0, 0);
  if (d.getTime() <= ts) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Timestamp of the start of the next local hour strictly after `ts`. */
export function nextHourAt(ts: number): number {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

/** Human friendly duration: `1h 05m`, `12m`, `45s`. */
export function formatDuration(ms: number, opts: { seconds?: boolean } = {}): string {
  const total = Math.max(0, Math.floor(ms / SECOND));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m ? `${h}h ${pad(m)}m` : `${h}h`;
  if (m > 0) return opts.seconds ? `${m}m ${pad(s)}s` : `${m}m`;
  return `${s}s`;
}

/** Compact badge text: `2h`, `45m`, `30s`. Max 4 chars. */
export function formatBadge(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND));
  if (total >= 3600) return `${Math.floor(total / 3600)}h`;
  if (total >= 60) return `${Math.ceil(total / 60)}m`;
  return `${total}s`;
}
