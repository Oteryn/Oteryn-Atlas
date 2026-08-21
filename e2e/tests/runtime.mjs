import { expect } from '@playwright/test';

export const DESKTOP_ENTRY = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map';
export const MOBILE_ENTRY = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=0.25&mode=auto';

export function captureRuntimeFailures(page) {
  const state = { failures: [], partialResponses: 0 };
  page.on('pageerror', (error) => state.failures.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() === 206) state.partialResponses += 1;
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
      state.failures.push(`HTTP ${response.status()} ${response.url()}`);
    }
  });
  return state;
}

export async function gotoAtlas(page, entry) {
  const response = await page.goto(entry, { waitUntil: 'domcontentloaded' });
  expect(response, 'Atlas navigation did not produce an HTTP response').not.toBeNull();
  expect(response.ok(), `Atlas entry returned HTTP ${response.status()}`).toBeTruthy();
  const expectedRevision = process.env.ATLAS_EXPECTED_REVISION?.trim();
  if (expectedRevision) {
    expect(response.headers()['x-oteryn-atlas-revision']).toBe(expectedRevision);
  }
  return response;
}

export async function waitForAtlas(page) {
  const qualification = page.locator('#qualification-result');
  await expect(qualification).toHaveAttribute('data-status', 'PASS', { timeout: 90_000 });
  const raw = await qualification.textContent();
  const result = JSON.parse(raw || '{}');
  expect(result.status).toBe('PASS');
  expect(result.error).toBeNull();
  expect(result.capabilities?.blockedOrUnknownEnabled).toBe(false);
  await expect(page.locator('#runtime-badge')).toContainText('VERIFIED FULL-WORLD');
  await expect(page.locator('#diag-backend')).toContainText('WEBGL2');
  await page.waitForFunction(
    () => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.status === 'PASS',
    null,
    { timeout: 30_000 },
  );
  return result;
}

export function assertNoRuntimeFailures(state) {
  expect(state.failures, state.failures.join('\n') || 'no runtime failures').toEqual([]);
}
