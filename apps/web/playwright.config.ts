import { defineConfig, devices } from '@playwright/test';

// The tests mock every /api request, so no API or database is needed: only the Next.js server.
// First time on a machine: `pnpm --filter web exec playwright install chromium`.
const port = 3100;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'chromium',
      // 1536 x 864 is what a 1080p screen shows at 125% zoom.
      use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 864 } },
    },
  ],
  webServer: {
    command: `pnpm exec next dev -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
