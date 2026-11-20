import { MINUTE } from './time';
import type { DayUsage, Limit } from './types';

export type LimitState = 'ok' | 'warning' | 'grace' | 'blocked';

export interface LimitStatus {
  limit: Limit;
  usedMs: number;
  /** Time left today; never negative. */
  remainingMs: number;
  state: LimitState;
  /** Set while a guilt-trip grace period is running. */
  graceUntil?: number;
}

/** Share of the limit after which we warn the user. */
export const WARN_FRACTION = 0.8;
/** Remaining time at which we send the "almost out" warning. */
export const FINAL_WARNING_MS = 5 * MINUTE;

export type WarningKind = 'eighty' | 'five' | 'reached';

/** Total time spent today on all domains of a limit. */
export function usedMsFor(limit: Limit, usage: DayUsage): number {
  let total = 0;
  for (const domain of limit.domains) {
    for (const ms of usage[domain] ?? []) total += ms;
  }
  return total;
}

export function appliesOn(limit: Limit, weekday: number): boolean {
  return limit.enabled && (limit.days.length === 0 || limit.days.includes(weekday));
}

/** Status of one limit, or `null` if it does not apply today. */
export function evaluateLimit(
  limit: Limit,
  usage: DayUsage,
  weekday: number,
  graceUntil: number | undefined,
  now: number,
): LimitStatus | null {
  if (!appliesOn(limit, weekday)) return null;
  const usedMs = usedMsFor(limit, usage);
  const remainingMs = Math.max(0, limit.dailyMs - usedMs);
  let state: LimitState;
  if (remainingMs <= 0) {
    state = graceUntil !== undefined && graceUntil > now ? 'grace' : 'blocked';
  } else {
    state = usedMs >= limit.dailyMs * WARN_FRACTION ? 'warning' : 'ok';
  }
  const status: LimitStatus = { limit, usedMs, remainingMs, state };
  if (state === 'grace') status.graceUntil = graceUntil;
  return status;
}

export function evaluateAll(
  limits: Limit[],
  usage: DayUsage,
  weekday: number,
  grace: Record<string, number>,
  now: number,
): LimitStatus[] {
  return limits
    .map((l) => evaluateLimit(l, usage, weekday, grace[l.id], now))
    .filter((s): s is LimitStatus => s !== null);
}

/** Domains that must be blocked right now. */
export function blockedDomains(statuses: LimitStatus[]): string[] {
  const out = new Set<string>();
  for (const s of statuses) if (s.state === 'blocked') s.limit.domains.forEach((d) => out.add(d));
  return [...out].sort();
}

export function statusesForDomain(statuses: LimitStatus[], domain: string): LimitStatus[] {
  return statuses.filter((s) => s.limit.domains.includes(domain));
}

const SEVERITY: Record<LimitState, number> = { blocked: 3, grace: 2, warning: 1, ok: 0 };

/** The status that matters most for a domain: blocked first, then least time left. */
export function mostRestrictive(statuses: LimitStatus[]): LimitStatus | null {
  let best: LimitStatus | null = null;
  for (const s of statuses) {
    if (
      !best ||
      SEVERITY[s.state] > SEVERITY[best.state] ||
      (SEVERITY[s.state] === SEVERITY[best.state] && s.remainingMs < best.remainingMs)
    ) {
      best = s;
    }
  }
  return best;
}

/**
 * Which notification (if any) to show for a limit, given those already shown
 * today. Returns the warning to show plus every kind that should now count as
 * fired, so a user who jumps straight past 80% doesn't get a stale warning later.
 */
export function dueWarning(
  status: LimitStatus,
  fired: readonly WarningKind[],
): { show: WarningKind | null; fire: WarningKind[] } {
  const { usedMs, remainingMs, limit } = status;
  let reached: WarningKind[] = [];
  if (remainingMs <= 0) reached = ['eighty', 'five', 'reached'];
  else if (remainingMs <= FINAL_WARNING_MS) reached = ['eighty', 'five'];
  else if (usedMs >= limit.dailyMs * WARN_FRACTION) reached = ['eighty'];
  const fire = reached.filter((k) => !fired.includes(k));
  const top = reached[reached.length - 1];
  const show = top && fire.includes(top) && limit.dailyMs > 0 ? top : null;
  return { show, fire };
}

/**
 * Milliseconds until the state of `domain` next changes on its own
 * (its limit runs out, or a grace period ends). `null` when nothing is pending.
 */
export function msUntilChange(statuses: LimitStatus[], now: number): number | null {
  let next: number | null = null;
  for (const s of statuses) {
    let ms: number | null = null;
    if (s.state === 'grace' && s.graceUntil !== undefined) ms = s.graceUntil - now;
    else if (s.state === 'ok' || s.state === 'warning') ms = s.remainingMs;
    if (ms !== null && ms >= 0 && (next === null || ms < next)) next = ms;
  }
  return next;
}
