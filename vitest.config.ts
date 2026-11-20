import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    environment: 'node',
    env: { TZ: 'UTC' },
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/background/**', 'src/storage/**'],
      thresholds: {
        'src/core/**': { lines: 90, functions: 90, branches: 85, statements: 90 },
      },
    },
  },
});
