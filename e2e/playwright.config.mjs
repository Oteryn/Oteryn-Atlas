import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const artifactsDir = process.env.ATLAS_ARTIFACTS_DIR || '/artifacts';
const parsedWorkers = Number.parseInt(process.env.ATLAS_E2E_WORKERS || '2', 10);
const workers = Number.isSafeInteger(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : 2;
const baseURL = process.env.ATLAS_BASE_URL || 'http://atlas-web:8080';
const expectedRevision = process.env.ATLAS_EXPECTED_REVISION?.trim() || null;
const publicationOrigin = process.env.ATLAS_PUBLICATION_ORIGIN?.trim() || null;
const depth = process.env.ATLAS_E2E_DEPTH?.trim() || 'required';
const browserMatrix = JSON.parse(readFileSync(new URL('./browser-matrix.json', import.meta.url), 'utf8'));
if (browserMatrix.version !== 1 || browserMatrix.primaryBrowser !== 'chromium') {
  throw new Error('unsupported Atlas browser matrix');
}
const browserContainer = browserMatrix.browserContainer;

const projects = [
  {
    name: 'desktop-chromium',
    testMatch: /desktop\.spec\.mjs$/,
    testIgnore: /cross-browser-/,
    use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'mobile-chromium',
    testMatch: /mobile\.spec\.mjs$/,
    testIgnore: /cross-browser-/,
    use: {
      browserName: 'chromium',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    },
  },
];

if (depth === 'nightly') {
  projects.push(
    {
      name: 'nightly-desktop-dpr2',
      testMatch: [
        /geometry-desktop\.spec\.mjs$/,
        /render-probes-desktop\.spec\.mjs$/,
      ],
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
      },
    },
    {
      name: 'nightly-tablet',
      testMatch: [
        /geometry-mobile\.spec\.mjs$/,
        /responsive-mobile\.spec\.mjs$/,
      ],
      use: {
        browserName: 'chromium',
        viewport: { width: 820, height: 1180 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1.5,
      },
    },
  );
}

if (depth === browserMatrix.depthMode) {
  for (const profile of browserMatrix.profiles) {
    projects.push({
      name: profile.name,
      testMatch: profile.surface === 'desktop'
        ? /cross-browser-desktop\.spec\.mjs$/
        : /cross-browser-mobile\.spec\.mjs$/,
      use: {
        browserName: profile.browserName,
        headless: profile.headless,
        viewport: profile.viewport,
        hasTouch: profile.hasTouch,
      },
    });
  }
}

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
    workers,
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
  projects,
});
