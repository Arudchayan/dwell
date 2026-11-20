/**
 * Deterministic demo data shared by the screenshot and store-asset generators.
 */
import type { Worker } from '@playwright/test';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

/** Seed 30 days of demo usage and three limits into the extension's storage. */
export async function seed(worker: Worker) {
  await worker.evaluate(async () => {
    const sites: [string, number, number[]][] = [
      // domain, minutes per weekday, active hours
      ['youtube.com', 70, [12, 13, 20, 21, 22]],
      ['github.com', 85, [9, 10, 11, 14, 15, 16]],
      ['x.com', 40, [8, 12, 18, 22, 23]],
      ['reddit.com', 35, [13, 19, 22]],
      ['google.com', 45, [10, 11, 15]],
      ['stackoverflow.com', 25, [10, 14, 16]],
      ['ycombinator.com', 20, [9, 18]],
      ['wikipedia.org', 12, [17, 21]],
    ];
    let s = 7;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const pad = (n: number) => String(n).padStart(2, '0');
    const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const data: Record<string, unknown> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      const usage: Record<string, number[]> = {};
      for (const [domain, minutes, hours] of sites) {
        const arr = new Array(24).fill(0);
        let total = minutes * (0.6 + rand() * 0.8) * (weekend && domain === 'github.com' ? 0.2 : 1);
        if (i === 0) total *= 0.75;
        for (const h of hours)
          arr[h] = Math.round(((total / hours.length) * 60_000 * (0.5 + rand())) / 1);
        usage[domain] = arr.map((v) => Math.min(v, 3_600_000));
      }
      if (i === 0) {
        // Today: X is over its limit (blocked), YouTube is close to its limit.
        usage['x.com'] = new Array(24)
          .fill(0)
          .map((_, h) => (h === 8 ? 21 : h === 12 ? 16 : 0) * 60_000);
        usage['youtube.com'] = new Array(24)
          .fill(0)
          .map((_, h) => (h === 12 ? 27 : h === 13 ? 25 : 0) * 60_000);
      }
      data[`usage:${key(d)}`] = usage;
      if (i === 3 || i === 9)
        data[`unlocks:${key(d)}`] = [{ limitId: 'x', at: d.getTime(), graceMs: 300000, level: 1 }];
    }
    data.firstDay = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
    data.limits = [
      {
        id: 'x',
        name: 'X / Twitter',
        domains: ['x.com', 'twitter.com'],
        dailyMs: 30 * 60_000,
        days: [],
        enabled: true,
      },
      {
        id: 'yt',
        name: 'YouTube',
        domains: ['youtube.com'],
        dailyMs: 60 * 60_000,
        days: [],
        enabled: true,
      },
      {
        id: 'rd',
        name: 'Reddit',
        domains: ['reddit.com'],
        dailyMs: 45 * 60_000,
        days: [1, 2, 3, 4, 5],
        enabled: true,
      },
    ];
    await chrome.storage.local.set(data);
  });
}
