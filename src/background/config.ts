import { MINUTE, SECOND } from '../core/time';

/**
 * Built with `wxt build --mode e2e` for the Playwright suite: grace periods
 * are counted in seconds instead of minutes and the worker ticks every second,
 * so end-to-end tests finish quickly. Never shipped to users.
 */
export const IS_E2E = import.meta.env.MODE === 'e2e';

/** Periodic flush interval (Chrome's minimum alarm period is 30s). */
export const HEARTBEAT_MINUTES = 0.5;

export const ALARMS = {
  heartbeat: 'overstay:heartbeat',
  reset: 'overstay:reset',
  grace: 'overstay:grace',
} as const;

export function graceDurationMs(graceMinutes: number): number {
  return graceMinutes * (IS_E2E ? SECOND : MINUTE);
}
