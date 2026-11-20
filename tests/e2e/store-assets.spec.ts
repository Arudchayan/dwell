/**
 * Generates the Chrome Web Store assets in docs/store/chrome from demo data:
 * five 1280x800 screenshots (the store maximum), the 440x280 small promo tile, the 1400x560 marquee
 * tile and the 128x128 store icon.
 * Not part of the normal suite: run with `npm run store-assets`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { seed } from './demo-data';
import { expect, test } from './fixtures';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'docs/store/chrome');
const ICON_SVG = readFileSync(path.join(ROOT, 'assets/icon.svg'), 'utf8');

test.skip(!process.env.STORE_ASSETS, 'set STORE_ASSETS=1 to regenerate store assets');

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif`;

/** Icon SVG at a given pixel size. `pad` adds transparent padding in icon units. */
function icon(size: number, pad = 0) {
  return ICON_SVG.replace('<svg ', `<svg width="${size}" height="${size}" `).replace(
    'viewBox="0 0 128 128"',
    `viewBox="${-pad} ${-pad} ${128 + 2 * pad} ${128 + 2 * pad}"`,
  );
}

/** Render standalone HTML at an exact size and save it as an opaque PNG. */
async function renderCard(page: Page, file: string, width: number, height: number, body: string) {
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:${FONT}">${body}</body></html>`,
  );
  await page.screenshot({ path: path.join(OUT, file) });
}

const BRAND_BG = 'background:linear-gradient(135deg,#6366f1 0%,#4338ca 100%);color:#fff';

test('capture store assets', async ({ context, worker, extensionId }) => {
  await seed(worker);
  const base = `chrome-extension://${extensionId}`;
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // 1. Overview (light).
  await page.goto(`${base}/options.html#/overview`);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.getByRole('button', { name: '30 days' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'screenshot-1-overview.png') });

  // 2. Block page with the typing challenge.
  await page.goto(`${base}/blocked.html?limit=x&url=${encodeURIComponent('https://x.com/home')}`);
  await page.getByTestId('open-challenge').click();
  const text = (await page.getByTestId('challenge-text').textContent())!;
  await page.getByTestId('challenge-input').pressSequentially(`${text.slice(0, 48)}x`);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'screenshot-2-blocked.png') });

  // 3. Limits.
  await page.goto(`${base}/options.html#/limits`);
  await expect(page.getByRole('heading', { name: 'Limits' })).toBeVisible();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'screenshot-3-limits.png') });

  // 4. Overview (dark).
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${base}/options.html#/overview`);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.getByRole('button', { name: '30 days' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'screenshot-4-dark.png') });
  await page.emulateMedia({ colorScheme: 'light' });

  // 5. Toolbar popup, framed on a 1280x800 canvas.
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 340, height: 520 });
  await popup.goto(`${base}/popup.html`);
  await expect(popup.getByRole('heading', { name: 'Today' })).toBeVisible();
  await popup.waitForTimeout(300);
  // Crop to the popup's content so the frame has no empty space below it.
  const popupPng = (await popup.locator('.popup').screenshot()).toString('base64');
  await popup.close();

  const card = await context.newPage();
  await renderCard(
    card,
    'screenshot-5-popup.png',
    1280,
    800,
    `<div style="${BRAND_BG};height:100%;display:flex;align-items:center;justify-content:center;gap:96px">
      <div style="max-width:520px">
        <div style="font-size:56px;font-weight:800;letter-spacing:-1px;line-height:1.05">Today, at a glance.</div>
        <div style="font-size:26px;opacity:.85;margin-top:20px;line-height:1.4">Click the toolbar icon to see where your time went today, site by site.</div>
      </div>
      <img src="data:image/png;base64,${popupPng}" width="340"
        style="border-radius:14px;box-shadow:0 24px 64px rgba(10,10,40,.45)">
    </div>`,
  );

  // Small promo tile, 440x280.
  await renderCard(
    card,
    'promo-small-440x280.png',
    440,
    280,
    `<div style="${BRAND_BG};height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
      ${icon(104, 0).replace('fill="url(#bg)"', 'fill="#ffffff" fill-opacity="0.14"')}
      <div style="font-size:46px;font-weight:800;letter-spacing:-1px">Overstay</div>
      <div style="font-size:19px;opacity:.9">Know where your time goes.</div>
    </div>`,
  );

  // Marquee promo tile, 1400x560 (optional, used if the listing is featured).
  await renderCard(
    card,
    'promo-marquee-1400x560.png',
    1400,
    560,
    `<div style="${BRAND_BG};height:100%;display:flex;align-items:center;justify-content:center;gap:64px">
      ${icon(220, 0).replace('fill="url(#bg)"', 'fill="#ffffff" fill-opacity="0.14"')}
      <div>
        <div style="font-size:96px;font-weight:800;letter-spacing:-2px">Overstay</div>
        <div style="font-size:38px;opacity:.9;margin-top:8px">Know where your time goes,<br>and when you've overstayed.</div>
      </div>
    </div>`,
  );

  // Store icon: 128x128 with 96x96 artwork and 16px of transparent padding.
  await card.setViewportSize({ width: 128, height: 128 });
  await card.setContent(
    `<html><body style="margin:0;background:transparent">${icon(128, 16)}</body></html>`,
  );
  await card.locator('svg').screenshot({
    path: path.join(OUT, 'store-icon-128.png'),
    omitBackground: true,
  });
});
