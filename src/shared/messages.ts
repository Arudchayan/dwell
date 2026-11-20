/** Messages exchanged between extension pages and the background worker. */
import { browser } from 'wxt/browser';

export interface ChallengeInfo {
  limitId: string;
  limitName: string;
  domains: string[];
  dailyMs: number;
  usedMs: number;
  /** 1 for today's first unlock of this limit, then 2, 3, … */
  level: number;
  /** Text to type, or null in strict mode. */
  text: string | null;
  strict: boolean;
  graceMs: number;
  /** Is the limit still exhausted? (false once it reset or was raised) */
  stillBlocked: boolean;
  /** Present while a grace period is running. */
  graceUntil: number | null;
}

export type Request =
  | { type: 'dwell:flush' }
  | { type: 'dwell:challenge'; limitId: string }
  | { type: 'dwell:unlock'; limitId: string; typed: string };

export type UnlockResult =
  | { ok: true; graceUntil: number }
  | { ok: false; reason: 'mismatch' | 'strict' | 'not-blocked' | 'unknown-limit' };

export type Response<R extends Request> = R extends { type: 'dwell:flush' }
  ? { ok: true }
  : R extends { type: 'dwell:challenge' }
    ? ChallengeInfo | null
    : R extends { type: 'dwell:unlock' }
      ? UnlockResult
      : never;

export function send<R extends Request>(req: R): Promise<Response<R>> {
  return browser.runtime.sendMessage(req) as Promise<Response<R>>;
}

export function isRequest(msg: unknown): msg is Request {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    typeof (msg as { type?: unknown }).type === 'string' &&
    (msg as { type: string }).type.startsWith('dwell:')
  );
}
