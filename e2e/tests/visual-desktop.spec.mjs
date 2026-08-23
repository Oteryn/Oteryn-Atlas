import { expect, test } from '@playwright/test';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';
import { canvasAlphaCount, comparePngOutsideRects } from '../support/visual-oracle.mjs';

const ENTRY = '/web/fullworld.html?x=32361&y=32198&floor=-7&zoom=2&mode=map&creatures=npc,monster&animation=off';
const VISUAL_ENTRY = '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map&animation=off';
const CREATURE_ONLY_PLAYBACK_ENTRY = '/web/fullworld.html?x=32831&y=32596&floor=-12&zoom=2&mode=map&animation=off&creatures=monster';

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

test('desktop Atlas-owned chrome retains reviewed visual contracts', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, VISUAL_ENTRY);
  await waitForAtlas(page);
  await expect(page.locator('.topbar')).toHaveScreenshot('desktop-topbar.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
  await expect(page.locator('#view-mode-control')).toHaveScreenshot('desktop-view-mode.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
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
  await page.addStyleTag({ content: '#map-frame.visual-world-only #creature-overlay, #map-frame.visual-world-only #minimap-layer, #map-frame.visual-world-only #overview-overlay, #map-frame.visual-world-only #selection-box, #map-frame.visual-world-only #cursor-coordinate, #map-frame.visual-world-only #runtime-badge, #map-frame.visual-world-only #detail-badge { visibility: hidden !important; }' });
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