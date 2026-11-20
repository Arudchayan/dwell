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
  | { type: 'overstay:flush' }
  | { type: 'overstay:challenge'; limitId: string }
  | { type: 'overstay:unlock'; limitId: string; typed: string };

export type UnlockResult =
  | { ok: true; graceUntil: number }
  | { ok: false; reason: 'mismatch' | 'strict' | 'not-blocked' | 'unknown-limit' };

export type Response<R extends Request> = R extends { type: 'overstay:flush' }
  ? { ok: true }
  : R extends { type: 'overstay:challenge' }
    ? ChallengeInfo | null
    : R extends { type: 'overstay:unlock' }
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
    (msg as { type: string }).type.startsWith('overstay:')
  );
}
