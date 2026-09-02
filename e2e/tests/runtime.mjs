import { expect } from '@playwright/test';

import { resolveQualificationEntry } from './qualification-navigation.mjs';

export const DESKTOP_ENTRY = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map';
export const MOBILE_ENTRY = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=0.25&mode=auto';

const OPTIONAL_HTTP_ALLOWLIST = [
  {
    matches: ({ pathname, status }) => status === 404 && pathname === '/favicon.ico',
    reason: 'The Atlas portal does not require a favicon for runtime qualification.',
  },
  {
    matches: ({ pathname, status }) => status === 404 && pathname === '/data/creatures/index.json',
    reason: 'Creature publication is an optional fail-closed extension on revisions that do not publish it.',
  },
];

function allowlistedHttpFailure(response) {
  const url = new URL(response.url());
  return OPTIONAL_HTTP_ALLOWLIST.find(({ matches }) => matches({ pathname: url.pathname, status: response.status() })) ?? null;
}

function optionalConsoleFailure(message) {
  if (message.type() !== 'error') return null;
  const text = message.text();
  if (/^Creature overlay disabled: \/data\/creatures\/index\.json HTTP 404$/.test(text)) {
    return 'Creature index is an optional fail-closed extension on revisions that do not publish it.';
  }
  if (text === 'Failed to load resource: the server responded with a status of 404 (Not Found)') {
    return 'URL-specific HTTP response policy classifies the corresponding 404; this browser console line carries no URL.';
  }
  return null;
}

export function captureRuntimeFailures(page) {
  const state = {
    failures: [],
    partialResponses: 0,
    allowedHttpFailures: [],
    allowedConsoleFailures: [],
  };
  page.on('pageerror', (error) => state.failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const reason = optionalConsoleFailure(message);
    if (reason) {
      state.allowedConsoleFailures.push({ text: message.text(), reason });
      return;
    }
    state.failures.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    if (failure !== 'net::ERR_ABORTED') state.failures.push(`requestfailed: ${request.url()} ${failure}`);
  });
  page.on('response', (response) => {
    if (response.status() === 206) state.partialResponses += 1;
    if (response.status() < 400) return;
    const allowlisted = allowlistedHttpFailure(response);
    if (allowlisted) {
      state.allowedHttpFailures.push({ url: response.url(), status: response.status(), reason: allowlisted.reason });
      return;
    }
    state.failures.push(`HTTP ${response.status()} ${response.url()}`);
  });
  return state;
}

async function readQualificationSemanticIndex(page) {
  const response = await page.request.get('/web/semantic-search/index.json');
  expect(response.ok(), `Qualification semantic index returned HTTP ${response.status()}`).toBeTruthy();
  return response.json();
}

export function isQualificationFixtureExecution() {
  const raw = process.env.ATLAS_QUALIFICATION_TRUST_JSON;
  if (!raw) return false;
  try {
    const trust = JSON.parse(raw);
    return trust?.marker === 'oteryn-atlas-qualification-trust-v1'
      && trust?.fixtureId === 'atlas-qualification-world-v2'
      && trust?.dataCapability === 'qualification_fixture';
  } catch {
    return false;
  }
}

export async function qualificationAnchor(page) {
  if (!isQualificationFixtureExecution()) return null;
  const index = await readQualificationSemanticIndex(page);
  const records = (index.records ?? []).filter((record) => Array.isArray(record?.capabilities) && record.capabilities.includes('navigation'));
  expect(records, 'qualification fixture must expose exactly one navigable semantic record').toHaveLength(1);
  return records[0].position;
}

export async function fixtureAwarePosition(page, fallback, { dx = 0, dy = 0, floorDelta = 0 } = {}) {
  const anchor = await qualificationAnchor(page);
  if (!anchor) return Object.freeze({ ...fallback });
  return Object.freeze({ x: anchor.x + dx, y: anchor.y + dy, floor: anchor.floor + floorDelta });
}

export async function gotoAtlas(page, entry) {
  const resolvedEntry = await resolveQualificationEntry(entry, {
    qualificationTrustJson: process.env.ATLAS_QUALIFICATION_TRUST_JSON,
    readSemanticIndex: () => readQualificationSemanticIndex(page),
  });
  const response = await page.goto(resolvedEntry, { waitUntil: 'domcontentloaded' });
  expect(response, 'Atlas navigation did not produce an HTTP response').not.toBeNull();
  expect(response.ok(), `Atlas entry returned HTTP ${response.status()}`).toBeTruthy();
  const expectedRevision = process.env.ATLAS_EXPECTED_REVISION?.trim();
  if (expectedRevision) {
    const headers = response.headers();
    const observedRevision = headers['x-oteryn-atlas-code-revision'] || headers['x-oteryn-atlas-revision'];
    expect(observedRevision, 'Atlas entry revision header').toBe(expectedRevision);
  }
  return response;
}

export async function qualificationResult(page) {
  const qualification = page.locator('#qualification-result');
  await page.waitForFunction(() => {
    const status = document.querySelector('#qualification-result')?.dataset.status;
    return status === 'PASS' || status === 'FAIL';
  }, null, { timeout: 90_000 });
  const status = await qualification.getAttribute('data-status');
  const raw = await qualification.textContent();
  const result = raw ? JSON.parse(raw) : {};
  return { status, result };
}

export async function waitForAtlas(page) {
  const { status, result } = await qualificationResult(page);
  expect(status, result.error || `qualification=${status}`).toBe('PASS');
  expect(result.status).toBe('PASS');
  expect(result.error).toBeNull();
  expect(result.capabilities?.blockedOrUnknownEnabled).toBe(false);
  await expect(page.locator('#runtime-badge')).toContainText('VERIFIED FULL-WORLD');
  await expect(page.locator('#diag-backend')).toContainText(/webgl2/i);
  return result;
}

export async function semanticSearchResult(page) {
  await page.waitForFunction(() => {
    const status = globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.status;
    return status === 'PASS' || status === 'FAIL';
  }, null, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__ ?? null);
}

export async function waitForSemanticSearch(page) {
  const semantic = await semanticSearchResult(page);
  expect(semantic?.status, semantic?.error || `semantic-search=${semantic?.status ?? 'UNKNOWN'}`).toBe('PASS');
  return semantic;
}

export async function expectQualificationFailure(page, messagePattern) {
  const { status, result } = await qualificationResult(page);
  expect(status).toBe('FAIL');
  expect(result.status).toBe('FAIL');
  expect(result.error).toMatch(messagePattern);
  return result;
}

export function assertNoRuntimeFailures(state) {
  expect(state.failures, state.failures.join('\n') || 'no runtime failures').toEqual([]);
}
