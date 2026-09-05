const __atlasQualification = process.env.ATLAS_E2E_DATA_CAPABILITY === 'qualification_fixture';
import { expect, test } from '@playwright/test';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { canvasAlphaCount, comparePngOutsideRects } from '../support/visual-oracle.mjs';
import { assertUserVisibleSurface, captureUserVisualEvidence } from '../support/user-acceptance.mjs';
const ENTRY = (__atlasQualification ? "/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2&mode=map&creatures=npc,monster&animation=off" : '/web/fullworld.html?x=32361&y=32198&floor=-7&zoom=2&mode=map&creatures=npc,monster&animation=off');
const VISUAL_ENTRY = (__atlasQualification ? "/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2&mode=map&animation=off" : '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map&animation=off');
const CREATURE_ONLY_PLAYBACK_ENTRY = (__atlasQualification ? "/web/fullworld.html?x=32280&y=32158&floor=-7&zoom=2&mode=map&animation=off&creatures=monster" : '/web/fullworld.html?x=32831&y=32596&floor=-12&zoom=2&mode=map&animation=off&creatures=monster');
const NPC_ONLY_PLAYBACK_ENTRY = (__atlasQualification ? "/web/fullworld.html?x=32282&y=32155&floor=-7&zoom=2&mode=map&animation=off&creatures=npc" : '/web/fullworld.html?x=32209&y=31924&floor=-12&zoom=2&mode=map&animation=off&creatures=npc');

async function overlayOpaquePixels(page) {
  return page.locator('#creature-overlay').evaluate((canvas) => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) opaque += 1;
    return opaque;
  });
}

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

async function worldOnlyScreenshot(page) {
  const frame = page.locator('#map-frame');
  await frame.evaluate((element) => element.classList.add('visual-world-only'));
  try { return await frame.screenshot({ animations: 'disabled' }); }
  finally { await frame.evaluate((element) => element.classList.remove('visual-world-only')); }
}

async function animationRectangles(page) {
  return page.evaluate(() => {
    const seen = new Set();
    return (globalThis.__OTERYN_ATLAS_WORLD_ANIMATION_RECTS__ ?? []).filter((rect) => {
      const key = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });
}

async function assertCreatureFamilyPlaybackChangesPixels(page, entry, kind) {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, entry);
  await waitForAtlas(page);
  await page.waitForFunction((expectedKind) => {
    const value = globalThis.__OTERYN_ATLAS_CREATURES__;
    return value?.status === 'PASS' && value.pixelDrawnRecords > 0
      && value.render?.anchors?.some((anchor) => anchor.kind === expectedKind);
  }, kind, { timeout: 30_000 });
  const staticState = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
  const staticEvidence = stableCreatureEvidence(staticState);
  const staticPixels = await page.locator('#creature-overlay').screenshot({ animations: 'disabled' });
  const playback = page.getByRole('checkbox', { name: /Playback/ });
  const beforeUpdates = staticState.animationRuntime?.frameUpdates ?? 0;
  await playback.check();
  await page.waitForFunction((before) => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === true
    && (globalThis.__OTERYN_ATLAS_CREATURES__?.animationRuntime?.frameUpdates ?? 0) > before, beforeUpdates, { timeout: 30_000 });
  await expect.poll(async () => !(await page.locator('#creature-overlay').screenshot({ animations: 'disabled' })).equals(staticPixels),
    { timeout: 30_000 }).toBeTruthy();
  expect(stableCreatureEvidence(await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__))).toEqual(staticEvidence);
  await playback.uncheck();
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false);
  await expect.poll(async () => (await page.locator('#creature-overlay').screenshot({ animations: 'disabled' })).equals(staticPixels),
    { timeout: 30_000 }).toBeTruthy();
  assertNoRuntimeFailures(runtime);
}

test('desktop Atlas-owned chrome and user journey retain reviewed visual contracts', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${VISUAL_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);

  const initialMetrics = await assertUserVisibleSurface(page, {
    label: 'desktop initial Atlas',
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '.topbar', label: 'topbar' },
      { selector: '#search-input', label: 'global search', interactive: true, minHeight: 30 },
      { selector: '#zoom-out', label: 'zoom out', interactive: true },
      { selector: '#zoom-in', label: 'zoom in', interactive: true },
      { selector: '#mobile-controls-panel', label: 'desktop controls rail' },
      { selector: '#map-frame', label: 'world map' },
      { selector: '#mobile-inspector-panel', label: 'desktop inspector' },
    ],
  });
  await expect(page.locator('.topbar')).toHaveScreenshot('desktop-topbar.png', {
    animations: 'disabled', caret: 'hide', scale: 'css',
  });
  await expect(page.locator('#view-mode-control')).toHaveScreenshot('desktop-view-mode.png', {
    animations: 'disabled', caret: 'hide', scale: 'css',
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.initial', {
    surfaceMetrics: initialMetrics,
    note: 'Initial desktop map, controls, inspector and chrome as seen by the user.',
  });

  const search = page.locator('#search-input');
  await search.fill((__atlasQualification ? "Fixture Harbor" : 'Thais'));
  const results = page.locator('#semantic-search-results-desktop');
  await expect(results).toBeVisible();
  const thais = results.getByRole('option').filter({ hasText: (__atlasQualification ? "Fixture Harbor" : 'Thais') }).first();
  await expect(thais).toBeVisible();
  await Promise.all([
    page.waitForURL((url) => Boolean(url.searchParams.get('semantic'))),
    thais.click(),
  ]);
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText((__atlasQualification ? "Fixture Harbor" : 'Thais'));
  const inspectorMetrics = await assertUserVisibleSurface(page, {
    label: 'desktop search and inspector',
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'world map' },
      { selector: '#mobile-inspector-panel', label: 'inspector' },
      { selector: '#inspector-content', label: 'inspector facts' },
      { selector: '#search-input', label: 'global search', interactive: true, minHeight: 30 },
    ],
  });
  await expect(page.locator('#mobile-inspector-panel')).toHaveScreenshot('desktop-inspector.png', {
    animations: 'disabled', caret: 'hide', scale: 'css',
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.search-inspector', {
    surfaceMetrics: inspectorMetrics,
    note: 'Semantic search selection with the resulting user-visible inspector and map state.',
  });

  await page.locator('#overview-toggle').check();
  await expect(page.locator('#status-layer')).toContainText('Overview PROVEN');
  await captureUserVisualEvidence(page, testInfo, 'desktop.layers', {
    note: 'Desktop technical overview layer enabled over the same qualified world view.',
  });
  await page.locator('#overview-toggle').uncheck();
  assertNoRuntimeFailures(runtime);
});

test('creature overlay never paints previous-floor records during a view event', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, ENTRY);
  await waitForAtlas(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS'
    && globalThis.__OTERYN_ATLAS_CREATURES__?.render?.anchors?.length > 0, null, { timeout: 30_000 });
  expect(await overlayOpaquePixels(page)).toBeGreaterThan(0);

  const transition = await page.evaluate(() => {
    const current = globalThis.__OTERYN_ATLAS_VIEW__;
    const next = Object.freeze({ ...current, floor: current.floor + 1 });
    window.dispatchEvent(new CustomEvent('oteryn-atlas-view', { detail: { view: next } }));
    const canvas = document.querySelector('#creature-overlay');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let opaque = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) opaque += 1;
    return { opaque, fromFloor: current.floor, toFloor: next.floor };
  });

  expect(transition.toFloor).not.toBe(transition.fromFloor);
  expect(transition.opaque, 'previous-floor creature pixels must be absent immediately after the view event').toBe(0);
  assertNoRuntimeFailures(runtime);
});

test('NPC playback changes real outfit pixels and restores the deterministic static phase', async ({ page }) => {
  await assertCreatureFamilyPlaybackChangesPixels(page, NPC_ONLY_PLAYBACK_ENTRY, 'npc');
});

test('playback changes only verified animated presentation regions and restores static pixels', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await page.addInitScript(() => {
    globalThis.__OTERYN_ATLAS_WORLD_ANIMATION_RECTS__ = [];
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (this.canvas?.id === 'animation-overlay') {
        const source = args[0];
        const x = Number(args[1]);
        const y = Number(args[2]);
        const width = Number(args.length >= 5 ? args[3] : source?.width);
        const height = Number(args.length >= 5 ? args[4] : source?.height);
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)
          && x + width > 0 && y + height > 0 && x < this.canvas.width && y < this.canvas.height) {
          globalThis.__OTERYN_ATLAS_WORLD_ANIMATION_RECTS__.push({ x, y, width, height });
        }
      }
      return original.apply(this, args);
    };
  });
  await gotoAtlas(page, CREATURE_ONLY_PLAYBACK_ENTRY);
  await waitForAtlas(page);
  await page.addStyleTag({ content: '#map-frame.visual-world-only #creature-overlay, #map-frame.visual-world-only #creature-presentation-overlay, #map-frame.visual-world-only #minimap-layer, #map-frame.visual-world-only #overview-overlay, #map-frame.visual-world-only #selection-box, #map-frame.visual-world-only #cursor-coordinate, #map-frame.visual-world-only #runtime-badge, #map-frame.visual-world-only #detail-badge { visibility: hidden !important; }' });
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS'
    && globalThis.__OTERYN_ATLAS_CREATURES__?.pixelDrawnRecords > 0
    && globalThis.__OTERYN_ATLAS_CREATURES__?.render?.anchors?.length > 0, null, { timeout: 30_000 });

  const staticState = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
  const staticEvidence = stableCreatureEvidence(staticState);
  const staticWorld = await worldOnlyScreenshot(page);
  const staticCreature = await page.locator('#creature-overlay').screenshot({ animations: 'disabled' });
  expect(await canvasAlphaCount(page, '#animation-overlay')).toBe(0);

  const playback = page.getByRole('checkbox', { name: /Playback/ });
  const beforeUpdates = staticState.animationRuntime?.frameUpdates ?? 0;
  await playback.check();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('on');
  await page.waitForFunction((before) => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === true
    && (globalThis.__OTERYN_ATLAS_CREATURES__?.animationRuntime?.frameUpdates ?? 0) > before, beforeUpdates, { timeout: 30_000 });
  await page.waitForFunction(() => (globalThis.__OTERYN_ATLAS_WORLD_ANIMATION_RECTS__?.length ?? 0) > 0, null, { timeout: 30_000 });

  const alphaSamples = [];
  for (let sample = 0; sample < 6; sample += 1) {
    await page.evaluate(() => new Promise(requestAnimationFrame));
    alphaSamples.push(await canvasAlphaCount(page, '#animation-overlay'));
  }
  expect(alphaSamples.every((count) => count > 0), `world animation overlay blanked during playback: ${alphaSamples.join(',')}`).toBeTruthy();

  let animatedCreature = null;
  await expect.poll(async () => {
    animatedCreature = await page.locator('#creature-overlay').screenshot({ animations: 'disabled' });
    return !animatedCreature.equals(staticCreature);
  }, { timeout: 30_000 }).toBeTruthy();
  expect(stableCreatureEvidence(await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__))).toEqual(staticEvidence);

  const animatedWorld = await worldOnlyScreenshot(page);
  const rectangles = await animationRectangles(page);
  expect(rectangles.length, 'playback fixture must expose verified animated world regions').toBeGreaterThan(0);
  const comparison = await comparePngOutsideRects(page, staticWorld, animatedWorld, rectangles);
  await testInfo.attach('playback-pixel-metrics', {
    body: Buffer.from(JSON.stringify({ ...comparison, maskPng: undefined, diffPng: undefined, rectangles, alphaSamples }, null, 2)),
    contentType: 'application/json',
  });
  if (comparison.changedOutside > 0) {
    await testInfo.attach('world-static.png', { body: staticWorld, contentType: 'image/png' });
    await testInfo.attach('world-playback.png', { body: animatedWorld, contentType: 'image/png' });
    await testInfo.attach('world-animation-mask.png', { body: Buffer.from(comparison.maskPng, 'base64'), contentType: 'image/png' });
    await testInfo.attach('world-outside-mask-diff.png', { body: Buffer.from(comparison.diffPng, 'base64'), contentType: 'image/png' });
  }
  expect(comparison.changedOutside, 'static world pixels changed outside verified animated presentation regions').toBe(0);
  const playbackMetrics = await assertUserVisibleSurface(page, {
    label: 'desktop animated world',
    minimumMapAreaRatio: 0.28,
    elements: [
      { selector: '#map-frame', label: 'animated world map' },
      { selector: 'label.layer:has(#animation-toggle)', label: 'playback toggle row', interactive: true },
      { selector: '#mobile-controls-panel', label: 'desktop controls rail' },
      { selector: '#mobile-inspector-panel', label: 'desktop inspector' },
    ],
  });
  await captureUserVisualEvidence(page, testInfo, 'desktop.playback', {
    surfaceMetrics: playbackMetrics,
    note: 'Verified world and creature playback while the surrounding user-facing layout remains usable.',
    animations: 'allow',
  });

  await playback.uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('off');
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false);
  await expect.poll(() => canvasAlphaCount(page, '#animation-overlay')).toBe(0);
  let restoredCreature = null;
  await expect.poll(async () => {
    restoredCreature = await page.locator('#creature-overlay').screenshot({ animations: 'disabled' });
    return restoredCreature.equals(staticCreature);
  }, { timeout: 30_000 }).toBeTruthy();
  const restoredWorld = await worldOnlyScreenshot(page);
  expect(restoredWorld.equals(staticWorld), 'world pixels did not return to the deterministic static rendering').toBeTruthy();
  expect(stableCreatureEvidence(await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__))).toEqual(staticEvidence);
  assertNoRuntimeFailures(runtime);
});