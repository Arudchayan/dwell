// Regenerate screenshots from the production build with demo data.
// Usage: npm run screenshots    -> docs/screenshots (README)
//        npm run store-assets   -> docs/store/chrome (Chrome Web Store)
import { spawnSync } from 'node:child_process';

const store = process.argv[2] === 'store';
const result = spawnSync('npx', ['playwright', 'test', store ? 'store-assets' : 'screenshots'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    ...(store ? { STORE_ASSETS: '1' } : { SCREENSHOTS: '1' }),
    OVERSTAY_EXT_DIR: 'chrome-mv3',
  },
});
process.exit(result.status ?? 1);
