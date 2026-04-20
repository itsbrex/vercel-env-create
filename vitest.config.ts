import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx,js,jsx}'],
    testTimeout: 10000,
    passWithNoTests: true,
  },
});
