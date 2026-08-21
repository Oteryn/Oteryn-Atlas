import path from 'node:path';
import { defineConfig } from '@playwright/test';

const artifactsDir = process.env.ATLAS_ARTIFACTS_DIR || '/artifacts';
const parsedWorkers = Number.parseInt(process.env.ATLAS_E2E_WORKERS || '2', 10);
const workers = Number.isSafeInteger(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : 2;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: path.join(artifactsDir, 'test-results'),
  reporter: [
    ['line'],
    ['json', { outputFile: path.join(artifactsDir, 'results.json') }],
    ['html', { outputFolder: path.join(artifactsDir, 'html-report'), open: 'never' }],
  ],
  use: {
    baseURL: process.env.ATLAS_BASE_URL || 'http://atlas-web:8080',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /desktop\.spec\.mjs/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      testMatch: /mobile\.spec\.mjs/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
