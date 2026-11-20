/**
 * Generates the screenshots in docs/screenshots from deterministic demo data.
 * Not part of the normal suite: run with `npm run screenshots`.
 */
import path from 'node:path';
import { expect, test } from './fixtures';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

const OUT = path.resolve(import.meta.dirname, '../../docs/screenshots');

test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to regenerate screenshots');
test.use({ viewport: { width: 1280, height: 860 } } as never);

async function seed(worker: import('@playwright/test').Worker) {
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

test('capture screenshots', async ({ context, worker, extensionId }) => {
  await seed(worker);
  const base = `chrome-extension://${extensionId}`;
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1300 });

  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(`${base}/options.html#/overview`);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await page.getByRole('button', { name: '30 days' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/overview-${theme}.png`, fullPage: false });
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 860 });

  await page.goto(`${base}/options.html#/limits`);
  await expect(page.getByRole('heading', { name: 'Limits' })).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/limits.png` });

  await page.goto(`${base}/options.html#/sites`);
  await page.getByRole('button', { name: '7 days' }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/sites.png` });

  await page.goto(`${base}/blocked.html?limit=x&url=${encodeURIComponent('https://x.com/home')}`);
  await page.getByTestId('open-challenge').click();
  const text = (await page.getByTestId('challenge-text').textContent())!;
  await page.getByTestId('challenge-input').pressSequentially(`${text.slice(0, 48)}x`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/blocked.png` });

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 340, height: 520 });
  await popup.goto(`${base}/popup.html`);
  await expect(popup.getByRole('heading', { name: 'Today' })).toBeVisible();
  await popup.waitForTimeout(300);
  await popup.screenshot({ path: `${OUT}/popup.png` });
});
