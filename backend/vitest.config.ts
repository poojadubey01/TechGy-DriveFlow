import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Each test file starts its own in-memory Postgres (PGlite); give it time on slow machines.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
