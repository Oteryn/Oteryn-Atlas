import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  gotoAtlas,
  qualificationResult,
} from './runtime.mjs';
import { assertUserVisibleSurface, captureUserVisualEvidence } from '../support/user-acceptance.mjs';

async function expectMapQualifiedSearchFailed(page, pattern) {
  const { status, result } = await qualificationResult(page);
  expect(status, result.error || 'FullWorld qualification').toBe('PASS');
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.status === 'FAIL', null, { timeout: 30_000 });
  const search = await page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__);
  expect(search.error).toMatch(pattern);
  await expect(page.locator('#runtime-badge')).toContainText('VERIFIED FULL-WORLD');
  return search;
}

test('semantic search HTTP outage degrades search without invalidating map qualification', async ({ page }, testInfo) => {
  await page.route('**/web/semantic-search/index.json', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"injected":"semantic-index-outage"}' });
  });
  await gotoAtlas(page, DESKTOP_ENTRY);
  const search = await expectMapQualifiedSearchFailed(page, /index\.json HTTP 503/i);
  expect(search.records).toBe(0);
  expect(search.lastResults).toBe(0);
  const degradedMetrics = await assertUserVisibleSurface(page, {
    label: 'desktop degraded search',
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'still-qualified world map' },
      { selector: '#runtime-badge', label: 'runtime qualification badge' },
      { selector: '#search-input', label: 'degraded search control' },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.search-degraded', {
    surfaceMetrics: degradedMetrics,
    note: 'Search service outage while the world remains qualified and usable.',
  });
});

test('creature search catalog outage fails the combined search surface closed only', async ({ page }) => {
  await page.route('**/web/semantic-search/creatures.json', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"injected":"creature-search-outage"}' });
  });
  await gotoAtlas(page, DESKTOP_ENTRY);
  const search = await expectMapQualifiedSearchFailed(page, /creatures\.json HTTP 503/i);
  expect(search.records).toBeGreaterThan(0);
  expect(search.creatureSearchRecords).toBe(0);
});

test('unsupported semantic API schema is rejected without stale browser search state', async ({ page }) => {
  await page.route('**/web/semantic-search/index.json', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.schema_version = 999;
    await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await gotoAtlas(page, DESKTOP_ENTRY);
  const search = await expectMapQualifiedSearchFailed(page, /schema unsupported/i);
  expect(search.records).toBe(0);
  expect(search.activeId).toBeNull();
});
