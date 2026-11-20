/**
 * Generates the screenshots in docs/screenshots from deterministic demo data.
 * Not part of the normal suite: run with `npm run screenshots`.
 */
import path from 'node:path';
import { seed } from './demo-data';
import { expect, test } from './fixtures';

const OUT = path.resolve(import.meta.dirname, '../../docs/screenshots');

test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to regenerate screenshots');
test.use({ viewport: { width: 1280, height: 860 } } as never);

test('capture screenshots', async ({ context, worker, extensionId }) => {
  await seed(worker);
  const base = `chrome-extension://${extensionId}`;
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 1300 });

  // Light: today. Dark: the 30-day history.
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(`${base}/options.html#/${theme === 'light' ? 'today' : 'history'}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (theme === 'dark') await page.getByRole('button', { name: '30 days' }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/overview-${theme}.png`, fullPage: false });
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1280, height: 860 });

  await page.goto(`${base}/options.html#/limits`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/limits.png` });

  await page.goto(`${base}/blocked.html?limit=x&url=${encodeURIComponent('https://x.com/home')}`);
  await page.getByTestId('open-challenge').click();
  const text = (await page.getByTestId('challenge-text').textContent())!;
  await page.getByTestId('challenge-input').pressSequentially(`${text.slice(0, 48)}x`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/blocked.png` });

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 340, height: 520 });
  // Opened as a tab, the popup would see itself as the current tab; pretend it's over YouTube.
  await popup.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).chrome;
    c.tabs.query = async () => [{ id: 1, active: true, url: 'https://www.youtube.com/watch?v=1' }];
  });
  await popup.goto(`${base}/popup.html`);
  await expect(popup.getByRole('heading', { name: /on the web today/ })).toBeVisible();
  await popup.waitForTimeout(600);
  await popup.screenshot({ path: `${OUT}/popup.png` });
});
