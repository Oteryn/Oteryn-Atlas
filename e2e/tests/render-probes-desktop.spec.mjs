const __atlasQualification = process.env.ATLAS_E2E_DATA_CAPABILITY === 'qualification_fixture';
import { expect, test } from '@playwright/test';

import { waitForRendererCommit } from '../support/diagnostics.mjs';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas } from './runtime.mjs';

const ENTRY = (__atlasQualification ? "/web/fullworld.html?x=32280&y=32155&floor=-7&zoom=2&mode=map&capture=1&sync-evidence=1&animation=off" : '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=2&mode=map&capture=1&sync-evidence=1&animation=off');

async function waitForNonBlankProbe(page, afterGeneration = 0) {
  await page.waitForFunction((after) => {
    const snapshot = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__;
    return snapshot?.generation > after
      && snapshot.visiblePrimitives > 0
      && snapshot.framebufferProbe?.sampleCount > 0
      && snapshot.framebufferProbe?.blank === false
      && snapshot.framebufferProbe?.nonClearSamples > 0;
  }, afterGeneration, { timeout: 60_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__);
}

test('capture-mode WebGL probe proves non-blank detail and replaces the committed frame after pan', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, ENTRY);
  const before = await waitForNonBlankProbe(page);
  expect(before.framebufferProbe.blank).toBe(false);
  expect(before.framebufferProbe.nonClearSamples).toBeGreaterThan(0);
  expect(before.framebufferProbe.recordIds.length).toBeGreaterThan(0);

  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 160, y + 96);
  await page.mouse.up();
  await waitForRendererCommit(page, before.generation);
  const after = await waitForNonBlankProbe(page, before.generation);

  expect(after.generation).toBeGreaterThan(before.generation);
  expect(after.transform.centerTileX).not.toBe(before.transform.centerTileX);
  expect(after.transform.centerTileY).not.toBe(before.transform.centerTileY);
  expect(after.framebufferProbe.blank).toBe(false);
  expect(after.framebufferProbe.signature, 'framebuffer probe must represent the moved committed frame').not.toBe(before.framebufferProbe.signature);
  await testInfo.attach('renderer-probe-before-after', {
    body: Buffer.from(JSON.stringify({ before, after }, null, 2)),
    contentType: 'application/json',
  });
  assertNoRuntimeFailures(runtime);
});