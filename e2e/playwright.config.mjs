import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

const artifactsDir = process.env.ATLAS_ARTIFACTS_DIR || '/artifacts';
const parsedWorkers = Number.parseInt(process.env.ATLAS_E2E_WORKERS || '2', 10);
const workers = Number.isSafeInteger(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : 2;
const baseURL = process.env.ATLAS_BASE_URL || 'http://atlas-web:8080';
const expectedRevision = process.env.ATLAS_EXPECTED_REVISION?.trim() || null;
const verificationPlanSha256 = process.env.ATLAS_VERIFICATION_PLAN_SHA256?.trim() || null;
const publicationOrigin = process.env.ATLAS_PUBLICATION_ORIGIN?.trim() || null;
const depth = process.env.ATLAS_E2E_DEPTH?.trim() || 'required';
const benchmarkWorkload = process.env.ATLAS_E2E_BENCHMARK_WORKLOAD?.trim() || null;
const browserContainer = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function benchmarkMatchers(kind) {
  if (!kind) return null;
  const raw = fs.readFileSync(new URL('./benchmark-workloads.json', import.meta.url), 'utf8');
  const manifest = JSON.parse(raw);
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported benchmark workload schema.');
  const workload = manifest.workloads?.[kind];
  if (!workload || !['full', 'targeted', 'broad'].includes(kind)) throw new Error(`Unknown benchmark workload: ${kind}`);
  if (workload.fullSuite) return null;
  if (!Array.isArray(workload.specs) || workload.specs.length === 0) throw new Error(`Benchmark workload ${kind} has no specs.`);
  const patterns = { desktop: [], mobile: [] };
  for (const spec of workload.specs) {
    if (typeof spec !== 'string' || !/^tests\/[a-z0-9-]+\.spec\.mjs$/.test(spec)) throw new Error(`Unsafe benchmark spec: ${spec}`);
    const name = path.posix.basename(spec);
    const matcher = new RegExp(`${escapeRegExp(name)}$`);
    if (name.endsWith('-desktop.spec.mjs') || name === 'desktop.spec.mjs') patterns.desktop.push(matcher);
    else if (name.endsWith('-mobile.spec.mjs') || name === 'mobile.spec.mjs') patterns.mobile.push(matcher);
    else throw new Error(`Benchmark spec has no project identity: ${spec}`);
  }
  if (patterns.desktop.length === 0 || patterns.mobile.length === 0) throw new Error(`Benchmark workload ${kind} must cover desktop and mobile.`);
  return patterns;
}

const benchmark = benchmarkMatchers(benchmarkWorkload);
const projects = [
  {
    name: 'desktop-chromium',
    testMatch: benchmark?.desktop ?? /desktop\.spec\.mjs$/,
    use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
  },
  {
    name: 'mobile-chromium',
    testMatch: benchmark?.mobile ?? /mobile\.spec\.mjs$/,
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
      testMatch: [/geometry-desktop\.spec\.mjs$/, /render-probes-desktop\.spec\.mjs$/],
      use: { browserName: 'chromium', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 },
    },
    {
      name: 'nightly-tablet',
      testMatch: [/geometry-mobile\.spec\.mjs$/, /responsive-mobile\.spec\.mjs$/],
      use: { browserName: 'chromium', viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1.5 },
    },
  );
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
    verificationPlanSha256,
    browserContainer,
    workers,
    benchmarkWorkload,
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
