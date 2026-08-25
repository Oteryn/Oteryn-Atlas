import { expect } from '@playwright/test';
import { canvasPng, exactPngPixelsEqual } from './visual-oracle.mjs';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from '../tests/runtime.mjs';

function targetUrl(target) {
  const params = new URLSearchParams({
    x: String(target.position.x),
    y: String(target.position.y),
    floor: String(target.position.floor),
    zoom: '2',
    mode: 'map',
    creatures: target.layer,
    creature: target.recordId,
    animation: 'off',
  });
  return `/web/fullworld.html?${params}`;
}

async function creatureState(page) {
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__ ?? null);
}

async function waitForTarget(page, target) {
  await page.waitForFunction(({ recordId, layer }) => {
    const value = globalThis.__OTERYN_ATLAS_CREATURES__;
    return value?.status === 'PASS'
      && value.selectedRecordId === recordId
      && value.selectedVisible === true
      && value.pixelDrawnRecords > 0
      && value.selectedTargetRect != null
      && value.enabled?.[layer] === true
      && value.animationRuntime?.walkingPrograms === 1376
      && value.animationRuntime?.walkingFallbacks === 1;
  }, target, { timeout: 60_000 });
  const value = await creatureState(page);
  expect(value.status, value.error ?? 'creature runtime').toBe('PASS');
  return value;
}

function factualUrlState(page, target) {
  const params = new URL(page.url()).searchParams;
  return {
    x: params.get('x'),
    y: params.get('y'),
    floor: params.get('floor'),
    creature: params.get('creature'),
    creatures: params.get('creatures'),
  };
}

function expectedUrlState(target) {
  return {
    x: String(target.position.x),
    y: String(target.position.y),
    floor: String(target.position.floor),
    creature: target.recordId,
    creatures: target.layer,
  };
}

function targetAnchor(state, target) {
  return state.render?.anchors?.find((anchor) => anchor.id === target.recordId) ?? null;
}

export async function proveCreatureWalkingInPlace(page, testInfo, target) {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, targetUrl(target));
  await waitForAtlas(page);
  const staticState = await waitForTarget(page, target);
  expect(factualUrlState(page, target)).toEqual(expectedUrlState(target));
  expect(staticState.animationOn).toBe(false);
  expect(staticState.animationRuntime.creaturePrograms).toBe(1377);
  expect(staticState.animationRuntime.walkingPrograms).toBe(1376);
  expect(staticState.animationRuntime.walkingFallbacks).toBe(1);

  const staticRect = staticState.selectedTargetRect;
  const staticAnchor = targetAnchor(staticState, target);
  const staticPixels = await canvasPng(page, '#creature-overlay');
  await testInfo.attach(`${target.name}-static-off.png`, { body: staticPixels, contentType: 'image/png' });

  const toggle = page.locator('#animation-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeEnabled();
  await expect(toggle).not.toBeChecked();
  const beforeFrames = staticState.animationRuntime.frameUpdates;
  await toggle.check();
  await page.waitForFunction((before) => {
    const value = globalThis.__OTERYN_ATLAS_CREATURES__;
    return value?.status === 'PASS'
      && value.animationOn === true
      && (value.animationRuntime?.frameUpdates ?? 0) > before;
  }, beforeFrames, { timeout: 30_000 });

  let movingPixels = null;
  await expect.poll(async () => {
    movingPixels = await canvasPng(page, '#creature-overlay');
    return exactPngPixelsEqual(page, staticPixels, movingPixels);
  }, { timeout: 30_000, message: `${target.name} walking playback did not change creature-overlay pixels` }).toBe(false);
  await testInfo.attach(`${target.name}-walking-on.png`, { body: movingPixels, contentType: 'image/png' });

  const movingState = await waitForTarget(page, target);
  expect(movingState.animationOn).toBe(true);
  expect(movingState.selectedTargetRect).toEqual(staticRect);
  expect(factualUrlState(page, target)).toEqual(expectedUrlState(target));
  const movingAnchor = targetAnchor(movingState, target);
  if (staticAnchor && movingAnchor) {
    expect({ id: movingAnchor.id, floor: movingAnchor.floor, x: movingAnchor.x, y: movingAnchor.y, screenX: movingAnchor.screenX, screenY: movingAnchor.screenY })
      .toEqual({ id: staticAnchor.id, floor: staticAnchor.floor, x: staticAnchor.x, y: staticAnchor.y, screenX: staticAnchor.screenX, screenY: staticAnchor.screenY });
  }

  await toggle.uncheck();
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false, null, { timeout: 30_000 });
  await expect.poll(async () => {
    const restored = await canvasPng(page, '#creature-overlay');
    return exactPngPixelsEqual(page, staticPixels, restored);
  }, { timeout: 30_000, message: `${target.name} static creature-overlay pixels were not restored after Playback OFF` }).toBe(true);

  const restoredState = await waitForTarget(page, target);
  expect(restoredState.selectedTargetRect).toEqual(staticRect);
  expect(factualUrlState(page, target)).toEqual(expectedUrlState(target));
  const restoredAnchor = targetAnchor(restoredState, target);
  if (staticAnchor && restoredAnchor) {
    expect({ id: restoredAnchor.id, floor: restoredAnchor.floor, x: restoredAnchor.x, y: restoredAnchor.y, screenX: restoredAnchor.screenX, screenY: restoredAnchor.screenY })
      .toEqual({ id: staticAnchor.id, floor: staticAnchor.floor, x: staticAnchor.x, y: staticAnchor.y, screenX: staticAnchor.screenX, screenY: staticAnchor.screenY });
  }
  assertNoRuntimeFailures(runtime);
}
