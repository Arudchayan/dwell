import type { DayKey } from './time';

/** Milliseconds of active time per domain, split into the 24 local hours of the day. */
export type DayUsage = Record<string, number[]>;

export interface Limit {
  id: string;
  /** Display name, e.g. "Twitter". */
  name: string;
  /** Base domains covered by this limit, e.g. `["twitter.com", "x.com"]`. */
  domains: string[];
  /** Allowed active time per day, in ms. */
  dailyMs: number;
  /** Weekdays the limit applies on (0 = Sunday). Empty = every day. */
  days: number[];
  enabled: boolean;
}

export interface Unlock {
  limitId: string;
  /** When the user typed the sentence. */
  at: number;
  graceMs: number;
  level: number;
}

export interface Settings {
  /** Seconds without input before the user counts as idle (15-3600). */
  idleSeconds: number;
  /** Keep counting while an audible tab is active even if the user is idle (videos, calls). */
  countAudibleWhenIdle: boolean;
  /** Local hour (0-23) at which a new tracking day begins. */
  resetHour: number;
  /** Grace period granted by typing the guilt sentence, in minutes (1-60). */
  graceMinutes: number;
  /** When true there is no way to override a block until the day resets. */
  strictMode: boolean;
  /** Show notifications when a limit is close or reached. */
  notifications: boolean;
  /** Domains that are never tracked. */
  ignoredDomains: string[];
  /** Days of usage history to keep (7-3650). */
  retentionDays: number;
  /** Extra user-provided guilt sentences. `{site}` is replaced by the limit name. */
  customSentences: string[];
  theme: 'system' | 'light' | 'dark';
}

/** Everything Overstay stores, as exported to / imported from a JSON backup. */
export interface ExportBundle {
  app: 'overstay';
  schemaVersion: number;
  exportedAt: string;
  settings: Settings;
  limits: Limit[];
  usage: Record<DayKey, DayUsage>;
  unlocks: Record<DayKey, Unlock[]>;
}
