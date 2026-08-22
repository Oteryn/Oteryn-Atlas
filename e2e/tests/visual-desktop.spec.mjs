import { expect, test } from '@playwright/test';
import {
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

const MONSTER_ENTRY = '/web/fullworld.html?x=33018&y=32009&floor=-7&zoom=2&mode=map&animation=off&creatures=npc,monster';

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