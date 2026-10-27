import { defineConfig, devices } from '@playwright/test';

const API_ENV = {
  DATABASE_URL: 'file:./e2e.db',
  JWT_SECRET: 'e2e-secret-at-least-32-characters-long!!!',
  NODE_ENV: 'e2e',
  ENABLE_SCHEDULER: 'false',
  LOGIN_RATE_MAX: '100',
  LOGIN_RATE_WINDOW_MINUTES: '15',
  CORS_ORIGIN: 'http://localhost:5173',
  UPLOAD_DIR: 'uploads/e2e',
  PORT: '5000',
};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  globalSetup: './tests/e2e/global-setup.ts',
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'workflow',
      testMatch: /workflow\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'accessibility',
      testMatch: /accessibility\.spec\.ts/,
      dependencies: ['workflow'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npx tsx src/backend/server.ts',
      url: 'http://localhost:5000/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: API_ENV,
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
