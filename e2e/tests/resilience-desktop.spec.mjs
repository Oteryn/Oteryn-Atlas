import { expect, test } from '@playwright/test';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  expectQualificationFailure,
  gotoAtlas,
  qualificationResult,
  waitForAtlas,
} from './runtime.mjs';

test('required FullWorld publication failure is deterministic and fail-closed', async ({ page }) => {
  await page.route('**/fullworld/publication/**', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"injected":"required-publication-failure"}' });
  });
  await gotoAtlas(page, DESKTOP_ENTRY);
  const result = await expectQualificationFailure(page, /503|publication|fetch failed/i);
  expect(result.capabilities?.blockedOrUnknownEnabled ?? false).toBeFalsy();
  await expect(page.locator('#runtime-badge')).not.toContainText('VERIFIED FULL-WORLD');
});

test('malformed semantic search product fails closed without corrupting map qualification', async ({ page }) => {
  await page.route('**/web/semantic-search/index.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{ malformed-json' });
  });
  await gotoAtlas(page, DESKTOP_ENTRY);
  const { status, result } = await qualificationResult(page);
  expect(status, result.error || 'FullWorld qualification').toBe('PASS');
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__?.status === 'FAIL', null, { timeout: 30_000 });
  const search = await page.evaluate(() => globalThis.__OTERYN_ATLAS_SEMANTIC_SEARCH__);
  expect(search.error).toMatch(/JSON|parse|unexpected/i);
  await expect(page.locator('#runtime-badge')).toContainText('VERIFIED FULL-WORLD');
});

test('unavailable creature index remains an isolated fail-closed optional surface', async ({ page }) => {
  await page.route('**/data/creatures/index.json', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"injected":"creature-index-failure"}' });
  });
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'FAIL', null, { timeout: 30_000 });
  const creatures = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
  expect(creatures.error).toMatch(/index\.json HTTP 503/i);
  expect(creatures.drawnRecords).toBe(0);
  await expect(page.locator('#creature-status')).toContainText('Unavailable:');
});

test('optional favicon 404 is classified without weakening URL-specific HTTP failures', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await page.route('**/favicon.ico*', async (route) => {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' });
  });
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);

  await page.evaluate(() => new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('error', resolve, { once: true });
    image.src = `/favicon.ico?e2e=${Date.now()}`;
  }));
  await expect.poll(() => runtime.allowedHttpFailures.some(({ url, status }) => {
    const value = new URL(url);
    return status === 404 && value.pathname === '/favicon.ico';
  })).toBeTruthy();
  assertNoRuntimeFailures(runtime);
});

test('version-mismatched required runtime index fails closed before stale rendering can qualify', async ({ page }) => {
  await page.route('**/fullworld/runtime-index/world.json', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const expected = '"profile":"oteryn-atlas-fullworld-runtime-index-v0"';
    expect(body).toContain(expected);
    const stale = body.replace(expected, '"profile":"oteryn-atlas-fullworld-runtime-index-stale-e2e"');
    await route.fulfill({ response, contentType: 'application/json', body: stale });
  });
  await gotoAtlas(page, DESKTOP_ENTRY);
  const result = await expectQualificationFailure(page, /unsupported runtime index profile/i);
  expect(result.capabilities?.blockedOrUnknownEnabled ?? false).toBeFalsy();
  await expect(page.locator('#runtime-badge')).not.toContainText('VERIFIED FULL-WORLD');
  const renderer = await page.evaluate(() => globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__ ?? null);
  expect(renderer).toBeNull();
});

test('corrupted authenticated semantic range fails closed without committing stale detail', async ({ page }) => {
  let corrupted = false;
  await page.route('**/*', async (route, request) => {
    if (corrupted || !request.headers()['range']) return route.continue();
    corrupted = true;
    const response = await route.fetch();
    const body = Buffer.from(await response.body());
    expect(body.length).toBeGreaterThan(0);
    body[0] ^= 0x01;
    await route.fulfill({ response, body });
  });
  await gotoAtlas(page, DESKTOP_ENTRY);
  const result = await expectQualificationFailure(page, /semantic authenticated range identity mismatch/i);
  expect(corrupted).toBe(true);
  expect(result.measured?.retainedPrimitives ?? 0).toBe(0);
  expect(result.measured?.retainedTiles ?? 0).toBe(0);
  await expect(page.locator('#runtime-badge')).toContainText('FAIL-CLOSED');
});
