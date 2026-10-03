import { defineConfig } from 'vitest/config';

// Integration tests read DATABASE_URL from the repo-level .env when present.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env file: variables come from the environment (or database tests are skipped).
}

// Coverage is measured where the product logic lives. The scripts you run by hand (try, compare,
// ping) have no logic of their own and need a real model, so they are left out.
const scripts = ['src/generation/try.ts', 'src/generation/compare.ts', 'src/llm/ping.ts'];
const enough = { lines: 80, statements: 80, functions: 80, branches: 80 };

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/generation/**', 'src/llm/**'],
      exclude: ['src/**/*.test.ts', 'src/generation/experiment-products.ts', ...scripts],
      reporter: ['text'],
      thresholds: { 'src/generation/**': enough, 'src/llm/**': enough },
    },
  },
});
