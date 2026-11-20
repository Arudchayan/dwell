// Regenerate docs/screenshots from the production build with demo data.
// Usage: npm run screenshots
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['playwright', 'test', 'screenshots'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, SCREENSHOTS: '1', DWELL_EXT_DIR: 'chrome-mv3' },
});
process.exit(result.status ?? 1);
