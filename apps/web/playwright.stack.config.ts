import { defineConfig, devices } from '@playwright/test';

// The whole stack, for real: the web app, the API and Postgres in Docker Compose, with the model
// replaced by the deterministic fake (LLM_FAKE=1). Nothing is mocked here.
// Run it with `pnpm test:e2e` from the repository root, which starts and stops the stack.
export default defineConfig({
  testDir: 'e2e-stack',
  fullyParallel: false, // the tests share one database
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL: process.env.STACK_URL ?? 'http://localhost:3000', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 864 } },
    },
  ],
});
