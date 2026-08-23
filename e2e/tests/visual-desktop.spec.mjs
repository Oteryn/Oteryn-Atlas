import { expect, test } from '@playwright/test';
import {
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

const MONSTER_ENTRY = '/web/fullworld.html?x=33018&y=32009&floor=-7&zoom=2&mode=map&animation=off&creatures=npc,monster';
const CREATURE_ONLY_PLAYBACK_ENTRY = '/web/fullworld.html?x=32831&y=32596&floor=-12&zoom=2&mode=map&animation=off&creatures=monster';

test('floor transition never paints prepared creature pixels from the previous floor', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await page.addInitScript(() => {
    const probe = { active: false, lastFloor: null, transitions: [] };
    globalThis.__OTERYN_ATLAS_VISUAL_FLOOR_PROBE__ = probe;
    let currentTransition = null;

    window.addEventListener('oteryn-atlas-view', (event) => {
      const nextFloor = event.detail?.view?.floor;
      const previousFloor = probe.lastFloor;
      probe.lastFloor = nextFloor;
      if (!probe.active || previousFloor == null || nextFloor === previousFloor) return;
      const transition = { from: previousFloor, to: nextFloor, paintOperations: 0, turnComplete: false };
      probe.transitions.push(transition);
      currentTransition = transition;
      queueMicrotask(() => {
        transition.turnComplete = true;
        if (currentTransition === transition) currentTransition = null;
      });
    });

    for (const method of ['drawImage', 'arc', 'fillText', 'fillRect', 'strokeRect']) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function (...args) {
        if (currentTransition && this.canvas?.id === 'creature-overlay') currentTransition.paintOperations += 1;
        return original.apply(this, args);
      };
    }
  });

  await gotoAtlas(page, MONSTER_ENTRY);
  await waitForAtlas(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS'
    && globalThis.__OTERYN_ATLAS_CREATURES__?.drawnRecords > 0, null, { timeout: 30_000 });

  const floorDown = page.locator('#floor-down');
  expect(await floorDown.isEnabled(), 'fixture floor must permit a downward transition').toBeTruthy();
  await page.evaluate(() => { globalThis.__OTERYN_ATLAS_VISUAL_FLOOR_PROBE__.active = true; });
  await floorDown.click();
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_VISUAL_FLOOR_PROBE__.transitions.length)).toBe(1);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_VISUAL_FLOOR_PROBE__.transitions[0]?.turnComplete === true);
  const transition = await page.evaluate(() => globalThis.__OTERYN_ATLAS_VISUAL_FLOOR_PROBE__.transitions[0]);
  await testInfo.attach('stale-floor-turn', {
    body: Buffer.from(JSON.stringify(transition, null, 2)),
    contentType: 'application/json',
  });

  expect(transition.to).not.toBe(transition.from);
  expect(transition.paintOperations, `old creature pixels painted synchronously during floor ${transition.from} -> ${transition.to}`).toBe(0);
  assertNoRuntimeFailures(runtime);
});
test('desktop Atlas-owned chrome matches reviewed visual baseline', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map&animation=off');
  await waitForAtlas(page);
  await expect(page.locator('.topbar')).toHaveScreenshot('desktop-topbar.png', { animations: 'disabled', caret: 'hide' });
  await expect(page.locator('#view-mode-control')).toHaveScreenshot('desktop-view-mode.png', { animations: 'disabled', caret: 'hide' });
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

async function nonTransparentPixelCount(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index] !== 0) count += 1;
    return count;
  });
}

test('playback changes creature pixels without changing the static base world', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, CREATURE_ONLY_PLAYBACK_ENTRY);
  await waitForAtlas(page);
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.status === 'PASS'
    && globalThis.__OTERYN_ATLAS_CREATURES__?.pixelDrawnRecords > 0
    && globalThis.__OTERYN_ATLAS_CREATURES__?.render?.anchors?.length > 0, null, { timeout: 30_000 });

  const staticState = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
  const staticEvidence = stableCreatureEvidence(staticState);
  const staticBase = await page.locator('#atlas').screenshot({ animations: 'disabled' });
  const staticCreature = await page.locator('#creature-overlay').screenshot({ animations: 'disabled' });
  expect(await nonTransparentPixelCount(page, '#animation-overlay'), 'fixture must isolate creature playback from world-object playback').toBe(0);

  const playback = page.getByRole('checkbox', { name: /Playback/ });
  const beforeUpdates = staticState.animationRuntime?.frameUpdates ?? 0;
  await playback.check();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('on');
  await page.waitForFunction((before) => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === true
    && (globalThis.__OTERYN_ATLAS_CREATURES__?.animationRuntime?.frameUpdates ?? 0) > before, beforeUpdates, { timeout: 30_000 });

  let animatedCreature = null;
  await expect.poll(async () => {
    animatedCreature = await page.locator('#creature-overlay').screenshot({ animations: 'disabled' });
    return !animatedCreature.equals(staticCreature);
  }, { timeout: 30_000 }).toBeTruthy();
  const animatedBase = await page.locator('#atlas').screenshot({ animations: 'disabled' });
  const animatedState = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
  expect(stableCreatureEvidence(animatedState)).toEqual(staticEvidence);
  if (!animatedBase.equals(staticBase)) {
    await testInfo.attach('base-static.png', { body: staticBase, contentType: 'image/png' });
    await testInfo.attach('base-playback.png', { body: animatedBase, contentType: 'image/png' });
  }
  expect(animatedBase.equals(staticBase), 'base WebGL pixels changed while playback was enabled in a creature-only animation fixture').toBeTruthy();
  expect(await nonTransparentPixelCount(page, '#animation-overlay'), 'fixture gained unexpected world-object playback pixels').toBe(0);

  await playback.uncheck();
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('off');
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false);
  let restoredCreature = null;
  await expect.poll(async () => {
    restoredCreature = await page.locator('#creature-overlay').screenshot({ animations: 'disabled' });
    return restoredCreature.equals(staticCreature);
  }, { timeout: 30_000 }).toBeTruthy();
  const restoredBase = await page.locator('#atlas').screenshot({ animations: 'disabled' });
  expect(restoredBase.equals(staticBase), 'base WebGL pixels did not return to the deterministic static rendering').toBeTruthy();
  expect(stableCreatureEvidence(await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__))).toEqual(staticEvidence);
  assertNoRuntimeFailures(runtime);
});
