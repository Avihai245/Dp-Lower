import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { 'server-only': path.resolve(__dirname, 'tools/vitest/server-only.ts') } },
  test: {
    include: ['packages/*/src/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tools/vitest/setup.ts'],
    testTimeout: 30_000,
  },
});
