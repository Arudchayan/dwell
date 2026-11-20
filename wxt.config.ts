import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  imports: false,
  vite: () => ({
    plugins: [preact()],
  }),
  manifest: ({ browser }) => ({
    name: 'Dwell — Website Time Tracker & Limits',
    short_name: 'Dwell',
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
    action: { default_title: 'Dwell' },
    web_accessible_resources: [{ resources: ['blocked.html'], matches: ['<all_urls>'] }],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'dwell@arudchayan.github.io',
              strict_min_version: '128.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
