/**
 * Vitest configuration.
 *
 * `setupFiles` runs before each test module is imported. That ordering matters
 * here: `src/config/env.js` validates required environment variables at import
 * time and throws if any are missing, so the test environment has to exist
 * before any application module is loaded.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/index.js', 'src/db/**'],
    },
  },
});
