import path from 'node:path';
import { defineConfig } from '@playwright/test';

const artifactsDir = process.env.ATLAS_ARTIFACTS_DIR || '/artifacts';
const parsedWorkers = Number.parseInt(process.env.ATLAS_E2E_WORKERS || '2', 10);
const workers = Number.isSafeInteger(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : 2;
const baseURL = process.env.ATLAS_BASE_URL || 'http://atlas-web:8080';
const expectedRevision = process.env.ATLAS_EXPECTED_REVISION?.trim() || null;
const publicationOrigin = process.env.ATLAS_PUBLICATION_ORIGIN?.trim() || null;
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: path.join(artifactsDir, 'test-results'),
  metadata: {
    targetMode: publicationOrigin ? 'checkout-overlay' : 'direct-preview',
    targetURL: baseURL,
    publicationOrigin,
    expectedRevision,
    browserContainer,
  },
  reporter: [
    ['line'],
    ['json', { outputFile: path.join(artifactsDir, 'results.json') }],
    ['./summary-reporter.mjs'],
    ['html', { outputFolder: path.join(artifactsDir, 'html-report'), open: 'never' }],
  ],
  use: {
    baseURL,
    headless: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /desktop\.spec\.mjs$/,
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      testMatch: /mobile\.spec\.mjs$/,
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
