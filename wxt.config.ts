import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  imports: false,
  zip: {
    // The sources zip is what Firefox Add-ons reviewers rebuild from.
    excludeSources: [
      'coverage/**',
      'docs/screenshots/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: ({ browser }) => ({
    name: 'Overstay — Website Time Tracker & Limits',
    short_name: 'Overstay',
    description:
      'Know where your time goes. Track time per website, see charts, and set daily limits. 100% local, no tracking.',
    permissions: [
      'storage',
      'tabs',
      'idle',
      'alarms',
      'notifications',
      'declarativeNetRequestWithHostAccess',
    ],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Overstay' },
    web_accessible_resources: [{ resources: ['blocked.html'], matches: ['<all_urls>'] }],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'overstay@arudchayan.github.io',
              // 140 (ESR) is the first version supporting data_collection_permissions.
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : {}),
  }),
});
