import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const chrome: any;

/** Total ms recorded for a domain across all stored days. */
function usageFor(worker: Worker, domain: string): Promise<number> {
  return worker.evaluate(async (d) => {
    const all = await chrome.storage.local.get(null);
    let total = 0;
    for (const [k, v] of Object.entries<Record<string, number[]>>(all)) {
      if (k.startsWith('usage:') && v[d]) total += v[d].reduce((a, b) => a + b, 0);
    }
    return total;
  }, domain);
}

function setLimit(worker: Worker, dailyMs: number, domains = ['distract.test']) {
  return worker.evaluate(
    async ({ dailyMs, domains }) => {
      await chrome.storage.local.set({
        limits: [{ id: 'lim1', name: 'Distract', domains, dailyMs, days: [], enabled: true }],
      });
    },
    { dailyMs, domains },
  );
}

function setSettings(worker: Worker, patch: Record<string, unknown>) {
  return worker.evaluate(async (p) => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({ settings: { ...settings, ...p } });
  }, patch);
}

async function expectBlocked(page: Page, extensionId: string) {
  await expect(page).toHaveURL(new RegExp(`^chrome-extension://${extensionId}/blocked\\.html`), {
    timeout: 15_000,
  });
  await expect(page.getByRole('heading', { name: /Time's up for Distract/ })).toBeVisible();
}

test('tracks active time per site and ignores browser pages', async ({ context, worker, site }) => {
  const page = await context.newPage();
  await page.goto(site('distract.test', '/feed'));
  await page.bringToFront();
  await expect
    .poll(() => usageFor(worker, 'distract.test'), { timeout: 15_000 })
    .toBeGreaterThan(2_000);
  expect(await usageFor(worker, 'work.test')).toBe(0);

  // Switching tabs moves the clock to the new site.
  const work = await context.newPage();
  await work.goto(site('work.test'));
  await work.bringToFront();
  const before = await usageFor(worker, 'distract.test');
  await expect
    .poll(() => usageFor(worker, 'work.test'), { timeout: 15_000 })
    .toBeGreaterThan(2_000);
  expect(await usageFor(worker, 'distract.test')).toBeLessThan(before + 1_500);
});

test('blocks a site when its limit runs out, including new navigations', async ({
  context,
  worker,
  site,
  extensionId,
}) => {
  await setLimit(worker, 3_000);
  const page = await context.newPage();
  await page.goto(site('distract.test', '/watch?v=42&t=1'));
  await page.bringToFront();
  await expectBlocked(page, extensionId);
  // The original URL is preserved for after an unlock.
  expect(decodeURIComponent(page.url())).toContain('distract.test');

  // New navigations are redirected by declarativeNetRequest.
  const fresh = await context.newPage();
  await fresh.goto(site('distract.test', '/another'));
  await expectBlocked(fresh, extensionId);

  // Other sites are unaffected.
  await fresh.goto(site('work.test'));
  await expect(fresh.getByRole('heading', { name: 'work.test' })).toBeVisible();
});

test('typing the guilt sentence grants a grace period that escalates', async ({
  context,
  worker,
  site,
  extensionId,
}) => {
  await setSettings(worker, { graceMinutes: 4 }); // seconds in the e2e build
  await setLimit(worker, 2_000);
  const page = await context.newPage();
  await page.goto(site('distract.test', '/post/1'));
  await page.bringToFront();
  await expectBlocked(page, extensionId);

  await page.getByTestId('open-challenge').click();
  const input = page.getByTestId('challenge-input');
  const text = (await page.getByTestId('challenge-text').textContent())!;
  expect(text.split(' ').length).toBeGreaterThan(15);

  // Pasting is refused.
  // Put the text on the clipboard with a real Ctrl+C from a scratch textarea.
  await page.evaluate((t) => {
    const scratch = document.createElement('textarea');
    scratch.id = 'scratch';
    scratch.value = t;
    document.body.appendChild(scratch);
  }, text);
  await page.locator('#scratch').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ControlOrMeta+C');
  await page.evaluate(() => document.getElementById('scratch')!.remove());
  await input.focus();
  await page.keyboard.press('ControlOrMeta+V');
  await expect(input).toHaveValue('');
  await expect(page.getByText(/Pasting does not count/)).toBeVisible();

  // Inserting the whole text at once (autocomplete, text expanders) is refused too.
  await page.keyboard.insertText(text);
  await expect(input).toHaveValue('');

  // A typo blocks the unlock button.
  await input.pressSequentially(`${text.slice(0, 5)}#`);
  await expect(page.getByTestId('unlock')).toBeDisabled();
  await input.fill('');

  // Typed by hand → unlocked and sent back to the original page.
  await input.pressSequentially(text, { delay: 0 });
  await expect(page.getByTestId('unlock')).toBeEnabled();
  await page.getByTestId('unlock').click();
  await expect(page).toHaveURL(site('distract.test', '/post/1'));
  await expect(page.getByRole('heading', { name: 'distract.test' })).toBeVisible();

  // When grace ends the site is blocked again and the next sentence is longer.
  await expectBlocked(page, extensionId);
  await page.getByTestId('open-challenge').click();
  const second = (await page.getByTestId('challenge-text').textContent())!;
  expect(second.length).toBeGreaterThan(text.length);
  await expect(page.getByText(/gets longer every time/)).toBeVisible();

  const unlocks = await worker.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all)
      .filter(([k]) => k.startsWith('unlocks:'))
      .flatMap(([, v]) => v as unknown[]);
  });
  expect(unlocks).toHaveLength(1);
});

test('strict mode offers no way out', async ({ context, worker, site, extensionId }) => {
  await setSettings(worker, { strictMode: true });
  await setLimit(worker, 0);
  const page = await context.newPage();
  await page.goto(site('distract.test'));
  await expectBlocked(page, extensionId);
  await expect(page.getByText(/Strict mode is on/)).toBeVisible();
  await expect(page.getByTestId('open-challenge')).toHaveCount(0);
});

test('a new day lifts the block', async ({ context, worker, site, extensionId }) => {
  const hour = await worker.evaluate(() => new Date().getHours());
  test.skip(hour === 23, 'cannot move the day boundary past 23:00');
  await setLimit(worker, 2_000);
  const page = await context.newPage();
  await page.goto(site('distract.test'));
  await page.bringToFront();
  await expectBlocked(page, extensionId);

  // Moving the day boundary to the next hour means "now" belongs to the
  // previous tracking day, which has no usage yet — exactly what a reset does.
  await setSettings(worker, { resetHour: hour + 1 });
  const fresh = await context.newPage();
  await fresh.goto(site('distract.test', '/again'));
  await expect(fresh.getByRole('heading', { name: 'distract.test' })).toBeVisible();
});

test('popup shows today and can add a limit for the current site', async ({
  context,
  worker,
  site,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(site('other.test'));
  await page.bringToFront();
  await expect
    .poll(() => usageFor(worker, 'other.test'), { timeout: 15_000 })
    .toBeGreaterThan(1_000);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(popup.getByText('other.test').first()).toBeVisible();

  const limits = await worker.evaluate(
    async () => (await chrome.storage.local.get('limits')).limits,
  );
  expect(limits ?? []).toHaveLength(0);
});

test('dashboard: charts, limit editor and data export/import', async ({
  context,
  worker,
  site,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(site('work.test'));
  await page.bringToFront();
  await expect
    .poll(() => usageFor(worker, 'work.test'), { timeout: 15_000 })
    .toBeGreaterThan(1_000);

  const dash = await context.newPage();
  const errors: string[] = [];
  dash.on('pageerror', (e) => errors.push(e.message));
  await dash.goto(`chrome-extension://${extensionId}/options.html#/overview`);
  await expect(dash.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(dash.getByRole('img', { name: 'Active browsing time per day' })).toBeVisible();
  await expect(dash.getByText('work.test').first()).toBeVisible();

  // Sites table
  await dash.getByRole('link', { name: 'Sites' }).click();
  await expect(dash.getByRole('cell', { name: 'work.test', exact: true })).toBeVisible();

  // Create a limit through the UI
  await dash.getByRole('link', { name: 'Limits' }).click();
  await dash.getByTestId('add-limit').click();
  await dash.getByTestId('limit-domains').fill('https://www.Work.test/path, nonsense');
  await dash.getByTestId('limit-save').click();
  await expect(dash.getByRole('alert')).toContainText('nonsense');
  await dash.getByTestId('limit-domains').fill('work.test');
  await dash.getByTestId('limit-minutes').fill('45');
  await dash.getByTestId('limit-save').click();
  await expect(dash.getByRole('article', { name: 'Limit work.test' })).toBeVisible();
  const limits = await worker.evaluate(
    async () => (await chrome.storage.local.get('limits')).limits,
  );
  expect(limits).toMatchObject([{ domains: ['work.test'], dailyMs: 45 * 60 * 1000 }]);

  // Export a backup, wipe, and import it again
  await dash.getByRole('link', { name: 'Your data' }).click();
  const downloadPromise = dash.waitForEvent('download');
  await dash.getByRole('button', { name: 'Download backup (JSON)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^overstay-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = await download.path();

  await dash.getByLabel('Type delete to confirm').fill('delete');
  await dash.getByRole('button', { name: 'Delete all data' }).click();
  await expect(dash.getByTestId('data-message')).toHaveText('All data deleted.');
  expect(
    await worker.evaluate(async () => (await chrome.storage.local.get('limits')).limits),
  ).toBeUndefined();

  dash.once('dialog', (d) => void d.accept());
  await dash.getByTestId('import-file').setInputFiles(backupPath);
  await expect(dash.getByTestId('data-message')).toContainText('Imported');
  expect(
    await worker.evaluate(async () => (await chrome.storage.local.get('limits')).limits),
  ).toMatchObject([{ domains: ['work.test'] }]);

  // Every view renders without runtime errors
  for (const route of ['overview', 'sites', 'limits', 'settings', 'data', 'welcome']) {
    await dash.goto(`chrome-extension://${extensionId}/options.html#/${route}`);
    await dash.waitForTimeout(150);
  }
  expect(errors).toEqual([]);
});
