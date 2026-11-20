/** Data loaders shared by the popup and the dashboard. */
import { evaluateAll, type LimitStatus } from '../core/limits';
import { dayKey, lastNDays, weekdayOf, type DayKey } from '../core/time';
import type { DayUsage, Limit, Settings, Unlock } from '../core/types';
import * as store from '../storage';

export interface TodayData {
  today: DayKey;
  settings: Settings;
  limits: Limit[];
  usage: DayUsage;
  statuses: LimitStatus[];
  unlocks: Unlock[];
}

export async function loadToday(now = Date.now()): Promise<TodayData> {
  const settings = await store.getSettings();
  const today = dayKey(now, settings.resetHour);
  const [limits, usage, grace, unlocks] = await Promise.all([
    store.getLimits(),
    store.getUsage(today),
    store.getGrace(),
    store.getUnlocks(today),
  ]);
  return {
    today,
    settings,
    limits,
    usage,
    statuses: evaluateAll(limits, usage, weekdayOf(today), grace, now),
    unlocks,
  };
}

export interface RangeData extends TodayData {
  /** Day keys in the range, oldest first (ends today). */
  days: DayKey[];
  byDay: Record<DayKey, DayUsage>;
  /** The same number of days immediately before `days`, for comparisons. */
  prevDays: DayKey[];
  prevByDay: Record<DayKey, DayUsage>;
  unlocksByDay: Record<DayKey, Unlock[]>;
  firstDay: DayKey | null;
}

export async function loadRange(n: number, now = Date.now()): Promise<RangeData> {
  const base = await loadToday(now);
  const days = lastNDays(base.today, n);
  const prevDays = lastNDays(days[0]!, n + 1).slice(0, n);
  const streakDays = lastNDays(base.today, 365);
  const [byDay, prevByDay, unlocksByDay, firstDay] = await Promise.all([
    store.getUsageRange(days),
    store.getUsageRange(prevDays),
    store.getUnlocksRange(streakDays),
    store.getFirstDay(),
  ]);
  return { ...base, days, byDay, prevDays, prevByDay, unlocksByDay, firstDay };
}

export function newLimitId(): string {
  return `lim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
