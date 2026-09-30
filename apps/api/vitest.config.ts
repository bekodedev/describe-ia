import { defineConfig } from 'vitest/config';

// Integration tests read DATABASE_URL from the repo-level .env when present.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // No .env file: variables come from the environment (or database tests are skipped).
}

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
