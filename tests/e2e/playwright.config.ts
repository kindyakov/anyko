import { defineConfig, devices } from '@playwright/test';

const webOrigin = 'http://127.0.0.1:3030';
const apiOrigin = 'http://127.0.0.1:3031';

export default defineConfig({
  testDir: './web',
  timeout: 45000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: webOrigin,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'bun tests/e2e/backend/start.ts',
      cwd: process.cwd(),
      url: `${apiOrigin}/health/ready`,
      timeout: 60000,
      reuseExistingServer: false,
      env: {
        API_PORT: '3031',
        APP_ORIGIN: webOrigin,
        AUTH_BASE_URL: apiOrigin,
        E2E_PROCESSING_DELAY_MS: '1500',
      },
    },
    {
      command:
        'bun --cwd apps/web --bun next start --hostname 127.0.0.1 --port 3030',
      cwd: process.cwd(),
      url: `${webOrigin}/sign-in`,
      timeout: 60000,
      reuseExistingServer: false,
      env: { API_ORIGIN: apiOrigin },
    },
  ],
});
