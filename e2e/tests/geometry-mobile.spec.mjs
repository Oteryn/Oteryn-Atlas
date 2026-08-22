import { expect, test } from '@playwright/test';

import { analyzeGeometryEventLog, compareCreatureAnchors } from '../support/geometry-oracle.mjs';
import {
  installGeometryEventLog,
  readGeometryEventLog,
  waitForCreatureAlignedToBase,
  waitForCreatureCommit,
  waitForRendererCommit,
} from '../support/diagnostics.mjs';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas } from './runtime.mjs';

const ENTRY = '/web/fullworld.html?x=32361&y=32198&floor=-7&zoom=2&mode=map&animation=off&creatures=npc&npcRole=shop';
const TOLERANCE_PX = 0.25;

async function resizeAndAlign(page, width, height) {
  const before = await page.evaluate(() => globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__?.generation ?? 0);
  await page.setViewportSize({ width, height });
  await waitForRendererCommit(page, before);
  return waitForCreatureAlignedToBase(page, true);
}

test('mobile portrait/landscape resize preserves base/creature world geometry', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, ENTRY);
  await waitForRendererCommit(page);
  await waitForCreatureCommit(page, 0, true);
  let aligned = await waitForCreatureAlignedToBase(page, true);
  compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(TOLERANCE_PX);
  await installGeometryEventLog(page);

  aligned = await resizeAndAlign(page, 390, 844);
  compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(TOLERANCE_PX);
  aligned = await resizeAndAlign(page, 844, 390);
  compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(TOLERANCE_PX);
  aligned = await resizeAndAlign(page, 390, 844);
  compareCreatureAnchors(aligned.base, aligned.creature).assertWithin(TOLERANCE_PX);

  const log = await readGeometryEventLog(page);
  const analysis = analyzeGeometryEventLog(log, TOLERANCE_PX);
  expect(analysis.checked).toBeGreaterThan(0);
  expect(analysis.mismatches).toEqual([]);
  await testInfo.attach('mobile-geometry-event-log', {
    body: Buffer.from(JSON.stringify({ analysis, log }, null, 2)),
    contentType: 'application/json',
  });
  assertNoRuntimeFailures(runtime);
});