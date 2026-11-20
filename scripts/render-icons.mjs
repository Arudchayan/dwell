// Rasterise assets/icon.svg into the PNG sizes browsers need.
// Usage: node scripts/render-icons.mjs  (requires `npx playwright install chromium`)
import { chromium } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

const svg = await readFile(new URL('../assets/icon.svg', import.meta.url), 'utf8');
const outDir = new URL('../public/icon/', import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 96, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.locator('svg').screenshot({
    path: new URL(`${size}.png`, outDir).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    omitBackground: true,
  });
  console.log(`icon/${size}.png`);
}
await browser.close();
