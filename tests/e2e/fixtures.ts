import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXTENSION_PATH = path.resolve(import.meta.dirname, '../../.output/chrome-mv3-e2e');

/** Fake sites served by a local server. `.test` domains are never on HSTS lists. */
export const SITES = ['distract.test', 'work.test', 'other.test'] as const;

function startServer(): Promise<Server> {
  const server = createServer((req, res) => {
    const host = (req.headers.host ?? '').split(':')[0];
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><title>${host}</title><h1>${host}</h1><p>Path: ${req.url}</p>` +
        `<p>Some very engaging content you should not be reading right now.</p>`,
    );
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  worker: Worker;
  /** URL of a fake site, e.g. site('distract.test', '/feed'). */
  site: (host: (typeof SITES)[number], path?: string) => string;
  /** Run code in the extension's service worker. */
  sw: <T>(fn: () => T | Promise<T>) => Promise<T>;
}

export const test = base.extend<Fixtures, { server: Server }>({
  server: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const server = await startServer();
      await use(server);
      server.close();
    },
    { scope: 'worker' },
  ],

  context: async ({ server }, use) => {
    const port = (server.address() as AddressInfo).port;
    const userDataDir = mkdtempSync(path.join(tmpdir(), 'dwell-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        `--host-resolver-rules=${SITES.map((s) => `MAP ${s} 127.0.0.1`).join(', ')}`,
        '--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable',
      ],
    });
    // Remember the port for the `site` fixture.
    (context as BrowserContext & { port?: number }).port = port;
    await use(context);
    await context.close();
    rmSync(userDataDir, { recursive: true, force: true });
  },

  worker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    // chrome.idle measures OS-wide input. Nobody touches the keyboard during a
    // test run (locally or on CI), so use the longest threshold to stay "active".
    await worker.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = (globalThis as any).chrome;
      await c.storage.local.set({ settings: { idleSeconds: 3600 } });
      // Wait until the worker has re-queried the idle state.
      for (let i = 0; i < 50; i++) {
        const { idleState } = await c.storage.session.get('idleState');
        if (idleState === 'active') return;
        await new Promise((r) => setTimeout(r, 50));
      }
    });
    await use(worker);
  },

  extensionId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },

  site: async ({ context }, use) => {
    const port = (context as BrowserContext & { port?: number }).port!;
    await use((host, p = '/') => `http://${host}:${port}${p}`);
  },

  sw: async ({ worker }, use) => {
    await use((fn) => worker.evaluate(fn));
  },
});

export const expect = test.expect;
