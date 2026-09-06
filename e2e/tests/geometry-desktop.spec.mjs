const __atlasQualification = process.env.ATLAS_E2E_DATA_CAPABILITY === 'qualification_fixture';
import { expect, test } from '@playwright/test';

import { analyzeGeometryEventLog, compareCreatureAnchors } from '../support/geometry-oracle.mjs';
import {
  installGeometryEventLog,
  readGeometryEventLog,
  waitForCreatureAlignedToBase,
  waitForCreatureCommit,
  waitForRendererCommit,
} from '../support/diagnostics.mjs';
import {
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
} from './runtime.mjs';

const NPC_ENTRY = (__atlasQualification ? "/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2&mode=map&animation=on&creatures=npc&npcRole=shop" : '/web/fullworld.html?x=32361&y=32198&floor=-7&zoom=2&mode=map&animation=on&creatures=npc&npcRole=shop');
const DRIFT_TOLERANCE_PX = 0.25;

async function waitForFinalAlignment(page) {
  await page.waitForFunction(() => {
    const base = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__;
    const creature = globalThis.__OTERYN_ATLAS_CREATURES__?.render;
    if (!base || !creature || !creature.anchors?.length) return false;
    return creature.baseGenerationAtCommit === base.generation
      && creature.baseGenerationAtStart === base.generation
      && creature.view.floor === base.transform.floor
      && Math.abs(creature.view.x - base.transform.centerTileX) < 1e-9
      && Math.abs(creature.view.y - base.transform.centerTileY) < 1e-9
      && Math.abs(creature.view.zoom - base.transform.zoom) < 1e-9;
  }, null, { timeout: 15_000 });
}

test('NPC overlay never commits independently from the base renderer during continuous pan', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, NPC_ENTRY);
  const base = await waitForRendererCommit(page);
  const creature = await waitForCreatureCommit(page, 0, true);
  expect(base.generation).toBeGreaterThan(0);
  expect(creature.anchors.length).toBeGreaterThan(0);

  await installGeometryEventLog(page);
  const canvas = page.locator('#atlas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const origin = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  const deltas = [
    [24, 0], [48, 0], [72, 12], [88, 28], [72, 44], [48, 56],
    [16, 64], [-16, 54], [-40, 36], [-54, 12], [-32, -8], [0, 0],
  ];
  for (const [dx, dy] of deltas) {
    await page.mouse.move(origin.x + dx, origin.y + dy);
    await page.evaluate(() => Promise.resolve());
  }
  await page.mouse.up();
  await waitForFinalAlignment(page);

  const log = await readGeometryEventLog(page);
  const analysis = analyzeGeometryEventLog(log, DRIFT_TOLERANCE_PX);
  await testInfo.attach('geometry-event-log', {
    body: Buffer.from(JSON.stringify({ tolerancePx: DRIFT_TOLERANCE_PX, analysis, log }, null, 2)),
    contentType: 'application/json',
  });
  expect(analysis.checked, 'no factual creature render commits were checked').toBeGreaterThan(0);
  expect(analysis.mismatches, JSON.stringify(analysis.mismatches, null, 2)).toEqual([]);
  assertNoRuntimeFailures(runtime);
});


const MONSTER_ENTRY = (__atlasQualification ? "/web/fullworld.html?x=32283&y=32158&floor=-7&zoom=2&mode=map&animation=off&creatures=npc,monster" : '/web/fullworld.html?x=33018&y=32009&floor=-7&zoom=2&mode=map&animation=off&creatures=npc,monster');

test('creature geometry remains floor-isolated and restores through moved deep-link reload', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MONSTER_ENTRY);
  await waitForRendererCommit(page);
  await waitForCreatureCommit(page, 0, true);
  let aligned = await waitForCreatureAlignedToBase(page, true);
  let comparison = compareCreatureAnchors(aligned.base, aligned.creature);
  comparison.assertWithin(DRIFT_TOLERANCE_PX);

  const floorDown = page.locator('#floor-down');
  if (await floorDown.isEnabled()) {
    const before = aligned.base.generation;
    await floorDown.click();
    await waitForRendererCommit(page, before);
    aligned = await waitForCreatureAlignedToBase(page, false);
    expect(aligned.creature.view.floor).toBe(aligned.base.transform.floor);
    expect(aligned.creature.anchors.every((anchor) => anchor.floor === aligned.base.transform.floor)).toBeTruthy();

    const floorUp = page.locator('#floor-up');
    expect(await floorUp.isEnabled()).toBeTruthy();
    const changed = aligned.base.generation;
    await floorUp.click();
    await waitForRendererCommit(page, changed);
    aligned = await waitForCreatureAlignedToBase(page, true);
    comparison = compareCreatureAnchors(aligned.base, aligned.creature);
    comparison.assertWithin(DRIFT_TOLERANCE_PX);
  }

  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const beforeMove = aligned.base.generation;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 48, y - 32);
  await page.mouse.up();
  await waitForRendererCommit(page, beforeMove);
  aligned = await waitForCreatureAlignedToBase(page, false);
  const movedUrl = page.url();
  const movedState = new URL(movedUrl).searchParams;

  const response = await page.reload({ waitUntil: 'domcontentloaded' });
  expect(response?.ok()).toBeTruthy();
  await waitForRendererCommit(page);
  await waitForCreatureCommit(page, 0, false);
  aligned = await waitForCreatureAlignedToBase(page, false);
  const restored = new URL(page.url()).searchParams;
  expect(restored.get('x')).toBe(movedState.get('x'));
  expect(restored.get('y')).toBe(movedState.get('y'));
  expect(restored.get('floor')).toBe(movedState.get('floor'));
  expect(aligned.creature.view.floor).toBe(aligned.base.transform.floor);
  if (aligned.creature.anchors.length) compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(DRIFT_TOLERANCE_PX);
  await testInfo.attach('reload-geometry', { body: Buffer.from(JSON.stringify({ movedUrl, base: aligned.base, creature: aligned.creature }, null, 2)), contentType: 'application/json' });
  assertNoRuntimeFailures(runtime);
});
