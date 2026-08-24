import { expect, test } from '@playwright/test';

import { assertUserVisibleSurface } from '../support/user-acceptance.mjs';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

const ANIMATION_ENTRY = '/web/fullworld.html?x=32831&y=32596&floor=-12&zoom=2&mode=map&animation=off&creatures=monster';

function requireSecondaryEngine(browserName) {
  expect(['firefox', 'webkit']).toContain(browserName);
}

function beginMainFrameNavigationRuntime(page, currentRuntime) {
  assertNoRuntimeFailures(currentRuntime);
  return new Promise((resolve) => {
    const listener = (frame) => {
      if (frame !== page.mainFrame()) return;
      page.off('framenavigated', listener);
      resolve(captureRuntimeFailures(page));
    };
    page.on('framenavigated', listener);
  });
}

async function attachEngineEvidence(page, testInfo, browserName, extra = {}) {
  const renderer = await page.evaluate(() => globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__ ?? null);
  await testInfo.attach('cross-browser-engine-evidence', {
    body: Buffer.from(JSON.stringify({
      version: 1,
      atlasRevision: process.env.ATLAS_EXPECTED_REVISION ?? null,
      project: testInfo.project.name,
      browserName,
      viewport: page.viewportSize(),
      rendererBackend: renderer?.backend ?? null,
      rendererGeneration: renderer?.generation ?? null,
      ...extra,
    }, null, 2)),
    contentType: 'application/json',
  });
}

test('secondary desktop engine qualifies WebGL2 and preserves navigation/layout invariants', async ({ page, browserName }, testInfo) => {
  requireSecondaryEngine(browserName);
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&capture=1&sync-evidence=1&creatures=npc,monster&animation=off`);
  await waitForAtlas(page);
  const metrics = await assertUserVisibleSurface(page, {
    label: `${browserName} desktop qualified surface`,
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'world map' },
      { selector: '#search-input', label: 'search input', interactive: true, minHeight: 30 },
      { selector: '#zoom-in', label: 'zoom in', interactive: true },
      { selector: '#zoom-out', label: 'zoom out', interactive: true },
      { selector: '#mobile-controls-panel', label: 'controls rail' },
      { selector: '#mobile-inspector-panel', label: 'inspector rail' },
    ],
  });
  const renderer = await page.evaluate(() => globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__);
  expect(renderer?.generation).toBeGreaterThan(0);
  expect(renderer?.visiblePrimitives).toBeGreaterThan(0);
  expect(renderer?.framebufferProbe?.blank).toBe(false);
  const zoom0 = new URL(page.url()).searchParams.get('zoom');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('zoom')).not.toBe(zoom0);

  await page.locator('[data-mode="minimap"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('minimap');
  await page.locator('[data-mode="map"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('map');

  const floor0 = new URL(page.url()).searchParams.get('floor');
  if (await page.locator('#floor-down').isEnabled()) await page.locator('#floor-down').click();
  else if (await page.locator('#floor-up').isEnabled()) await page.locator('#floor-up').click();
  else throw new Error('cross-browser fixture exposes no adjacent floor');
  await expect.poll(() => new URL(page.url()).searchParams.get('floor')).not.toBe(floor0);

  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const x0 = new URL(page.url()).searchParams.get('x');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => new URL(page.url()).searchParams.get('x')).not.toBe(x0);
  await attachEngineEvidence(page, testInfo, browserName, { surfaceMetrics: metrics });
  assertNoRuntimeFailures(runtime);
});

test('secondary desktop engine preserves semantic inspector through reload and history', async ({ page, browserName }, testInfo) => {
  requireSecondaryEngine(browserName);
  let runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  await page.locator('#search-input').fill('Thais');
  const results = page.locator('#semantic-search-results-desktop');
  await expect(results).toBeVisible();
  const thais = results.getByRole('option').filter({ hasText: 'Thais' }).first();
  await expect(thais).toBeVisible();
  const semanticRuntime = beginMainFrameNavigationRuntime(page, runtime);
  await Promise.all([
    page.waitForURL((url) => Boolean(url.searchParams.get('semantic'))),
    thais.click(),
  ]);
  runtime = await semanticRuntime;
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText('Thais');
  const selectedUrl = page.url();

  const reloadRuntime = beginMainFrameNavigationRuntime(page, runtime);
  await page.reload({ waitUntil: 'domcontentloaded' });
  runtime = await reloadRuntime;
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText('Thais');
  const backRuntime = beginMainFrameNavigationRuntime(page, runtime);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  runtime = await backRuntime;
  await waitForAtlas(page);
  expect(page.url()).not.toBe(selectedUrl);
  const forwardRuntime = beginMainFrameNavigationRuntime(page, runtime);
  await page.goForward({ waitUntil: 'domcontentloaded' });
  runtime = await forwardRuntime;
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText('Thais');
  await assertUserVisibleSurface(page, {
    label: `${browserName} semantic inspector`,
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'world map' },
      { selector: '#mobile-inspector-panel', label: 'inspector' },
      { selector: '#inspector-content', label: 'inspector content' },
      { selector: '#search-input', label: 'search', interactive: true, minHeight: 30 },
    ],
  });
  await attachEngineEvidence(page, testInfo, browserName, { selectedUrl });
  assertNoRuntimeFailures(runtime);
});

function stableCreatureEvidence(value) {
  return {
    enabled: value.enabled,
    visibleRecords: value.visibleRecords,
    drawnRecords: value.drawnRecords,
    pixelDrawnRecords: value.pixelDrawnRecords,
    markerDrawnRecords: value.markerDrawnRecords,
    anchors: (value.render?.anchors ?? []).map(({ id, kind, floor, x, y, screenX, screenY }) => ({ id, kind, floor, x, y, screenX, screenY })),
  };
}

async function creaturePixelDigest(page) {
  return page.locator('#creature-overlay').evaluate((canvas) => {
    const bytes = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let fnv = 2166136261;
    let weighted = 0;
    for (let index = 0; index < bytes.length; index += 1) {
      fnv = Math.imul(fnv ^ bytes[index], 16777619) >>> 0;
      weighted = (weighted + Math.imul(bytes[index], (index & 0xffff) + 1)) >>> 0;
    }
    return `${bytes.length}:${fnv}:${weighted}`;
  });
}

test('secondary desktop engine changes and restores verified creature playback pixels', async ({ page, browserName }, testInfo) => {
  requireSecondaryEngine(browserName);
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, ANIMATION_ENTRY);
  await waitForAtlas(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS'
    && globalThis.__OTERYN_ATLAS_CREATURES__?.pixelDrawnRecords > 0
    && globalThis.__OTERYN_ATLAS_CREATURES__?.render?.anchors?.length > 0, null, { timeout: 30_000 });
  const staticDigest = await creaturePixelDigest(page);
  const state = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
  const staticEvidence = stableCreatureEvidence(state);
  const beforeUpdates = state.animationRuntime?.frameUpdates ?? 0;
  const playback = page.getByRole('checkbox', { name: /Playback/ });
  await playback.check();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('on');
  await page.waitForFunction((before) => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === true
    && (globalThis.__OTERYN_ATLAS_CREATURES__?.animationRuntime?.frameUpdates ?? 0) > before,
  beforeUpdates, { timeout: 30_000 });
  let animatedDigest = staticDigest;
  await expect.poll(async () => {
    animatedDigest = await creaturePixelDigest(page);
    return animatedDigest !== staticDigest;
  }, { timeout: 30_000 }).toBeTruthy();
  expect(stableCreatureEvidence(await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__))).toEqual(staticEvidence);
  await assertUserVisibleSurface(page, {
    label: `${browserName} playback surface`,
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'animated world' },
      { selector: 'label.layer:has(#animation-toggle)', label: 'playback control', interactive: true },
    ],
  });
  await playback.uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('off');
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false);
  await expect.poll(() => creaturePixelDigest(page), { timeout: 30_000 }).toBe(staticDigest);
  expect(stableCreatureEvidence(await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__))).toEqual(staticEvidence);
  await attachEngineEvidence(page, testInfo, browserName, { staticDigest, animatedDigest, staticEvidence });
  assertNoRuntimeFailures(runtime);
});
