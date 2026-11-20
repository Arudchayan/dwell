import { weekdayOf, type DayKey } from './time';
import type { DayUsage, Unlock } from './types';

export interface DomainTotal {
  domain: string;
  ms: number;
}

function sum(values: readonly number[]): number {
  let t = 0;
  for (const v of values) t += v;
  return t;
}

/** Total active time on a day. */
export function dayTotal(usage: DayUsage | undefined): number {
  if (!usage) return 0;
  let t = 0;
  for (const hours of Object.values(usage)) t += sum(hours);
  return t;
}

/** Per-domain totals across several days, largest first. */
export function domainTotals(days: readonly (DayUsage | undefined)[]): DomainTotal[] {
  const totals = new Map<string, number>();
  for (const usage of days) {
    if (!usage) continue;
    for (const [domain, hours] of Object.entries(usage)) {
      totals.set(domain, (totals.get(domain) ?? 0) + sum(hours));
    }
  }
  return [...totals.entries()]
    .filter(([, ms]) => ms > 0)
    .map(([domain, ms]) => ({ domain, ms }))
    .sort((a, b) => b.ms - a.ms || a.domain.localeCompare(b.domain));
}

/** Top `n` domains plus an aggregated "Other" bucket for the rest. */
export function topWithOther(totals: DomainTotal[], n: number): DomainTotal[] {
  if (totals.length <= n) return totals;
  const top = totals.slice(0, n);
  const other = sum(totals.slice(n).map((t) => t.ms));
  return [...top, { domain: 'Other', ms: other }];
}

/** Total per local hour of day across several days. */
export function hourlyTotals(days: readonly (DayUsage | undefined)[]): number[] {
  const out = new Array<number>(24).fill(0);
  for (const usage of days) {
    if (!usage) continue;
    for (const hours of Object.values(usage)) hours.forEach((ms, h) => (out[h]! += ms));
  }
  return out;
}

/** One total per requested day (missing days count as zero). */
export function dailySeries(byDay: Record<DayKey, DayUsage>, days: readonly DayKey[]): number[] {
  return days.map((d) => dayTotal(byDay[d]));
}

/** 7×24 matrix (weekday × hour, Sunday first) of total time. */
export function weekdayHourHeatmap(
  byDay: Record<DayKey, DayUsage>,
  days: readonly DayKey[],
): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const day of days) {
    const usage = byDay[day];
    if (!usage) continue;
    const row = grid[weekdayOf(day)]!;
    for (const hours of Object.values(usage)) hours.forEach((ms, h) => (row[h]! += ms));
  }
  return grid;
}

/** Average over days that have any recorded activity. */
export function averageActiveDay(series: readonly number[]): number {
  const active = series.filter((v) => v > 0);
  return active.length ? sum(active) / active.length : 0;
}

/** Percentage change from `previous` to `current`, or `null` if there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Number of unlocks ("times you gave in") per requested day. */
export function unlockSeries(unlocks: Record<DayKey, Unlock[]>, days: readonly DayKey[]): number[] {
  return days.map((d) => unlocks[d]?.length ?? 0);
}

/**
 * Consecutive days, ending yesterday or today, on which no limit was overridden.
 * Only days on or after `firstDay` (when tracking started) count.
 */
export function cleanStreak(
  unlocks: Record<DayKey, Unlock[]>,
  daysNewestFirst: readonly DayKey[],
  firstDay: DayKey | null,
): number {
  let streak = 0;
  for (const day of daysNewestFirst) {
    if (firstDay && day < firstDay) break;
    if ((unlocks[day]?.length ?? 0) > 0) break;
    streak++;
  }
  return streak;
}
