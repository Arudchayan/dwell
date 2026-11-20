import { domainFromUrl } from './domain';
import { dayKey, hourOf, nextHourAt, MINUTE, type DayKey } from './time';
import type { DayUsage, Settings } from './types';

/** The domain currently being timed and since when. Persisted between service worker wakes. */
export interface Segment {
  domain: string;
  since: number;
}

/** A slice of active time that falls inside a single local hour. */
export interface Chunk {
  day: DayKey;
  hour: number;
  domain: string;
  ms: number;
}

export type IdleState = 'active' | 'idle' | 'locked';

/** A snapshot of what the browser is doing right now. */
export interface ActivitySnapshot {
  /** URL of the active tab in the last focused window, if any. */
  url: string | null;
  /** Whether a browser window currently has OS focus. */
  windowFocused: boolean;
  idle: IdleState;
  /** Whether the active tab is playing sound. */
  audible: boolean;
}

/**
 * Longest stretch credited in one go. Heartbeats arrive every ~30s, so a much
 * larger gap means the browser or computer was suspended; we don't count that.
 */
export const MAX_GAP_MS = 2 * MINUTE;

/** Which domain (if any) should be accumulating time right now. */
export function activeDomain(
  snap: ActivitySnapshot,
  settings: Pick<Settings, 'countAudibleWhenIdle' | 'ignoredDomains'>,
): string | null {
  if (!snap.windowFocused) return null;
  if (snap.idle === 'locked') return null;
  if (snap.idle === 'idle' && !(settings.countAudibleWhenIdle && snap.audible)) return null;
  const domain = domainFromUrl(snap.url);
  if (!domain || settings.ignoredDomains.includes(domain)) return null;
  return domain;
}

/** Split `[start, end)` into per-hour chunks, assigning each to its Dwell day. */
export function splitInterval(
  domain: string,
  start: number,
  end: number,
  resetHour: number,
): Chunk[] {
  const chunks: Chunk[] = [];
  let t = start;
  while (t < end) {
    const boundary = Math.min(end, nextHourAt(t));
    chunks.push({ day: dayKey(t, resetHour), hour: hourOf(t), domain, ms: boundary - t });
    t = boundary;
  }
  return chunks;
}

export interface AdvanceOptions {
  resetHour: number;
  /** Credit time only up to this moment (e.g. when the user went idle earlier than `now`). */
  endAt?: number;
  maxGapMs?: number;
}

/**
 * Close the running segment at `now` (crediting its time) and open a new one
 * for `nextDomain`. Calling this on every browser event and heartbeat keeps the
 * stored totals at most one heartbeat behind reality.
 */
export function advance(
  segment: Segment | null,
  nextDomain: string | null,
  now: number,
  opts: AdvanceOptions,
): { segment: Segment | null; chunks: Chunk[] } {
  let chunks: Chunk[] = [];
  if (segment) {
    const cap = segment.since + (opts.maxGapMs ?? MAX_GAP_MS);
    const end = Math.min(now, opts.endAt ?? now, cap);
    if (end > segment.since)
      chunks = splitInterval(segment.domain, segment.since, end, opts.resetHour);
  }
  return { segment: nextDomain ? { domain: nextDomain, since: now } : null, chunks };
}

/** Add chunks into per-day usage maps (mutates and returns the touched days). */
export function applyChunks(usage: Record<DayKey, DayUsage>, chunks: Chunk[]): DayKey[] {
  const touched = new Set<DayKey>();
  for (const c of chunks) {
    const day = (usage[c.day] ??= {});
    const hours = (day[c.domain] ??= new Array<number>(24).fill(0));
    hours[c.hour] = (hours[c.hour] ?? 0) + c.ms;
    touched.add(c.day);
  }
  return [...touched];
}
