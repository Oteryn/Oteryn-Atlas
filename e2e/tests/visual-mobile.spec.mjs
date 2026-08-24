import { expect, test } from '@playwright/test';
import { MOBILE_ENTRY, assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

const MONSTER_PLAYBACK_ENTRY = '/web/fullworld.html?x=32724&y=31155&floor=-15&zoom=2&mode=minimap&perf=reference&animation=off&creatures=npc,monster';

test('mobile Atlas-owned chrome retains reviewed visual contracts', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, MOBILE_ENTRY);
  await waitForAtlas(page);
  await expect(page.locator('.topbar')).toHaveScreenshot('mobile-topbar.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });

  const controlsToggle = page.getByRole('button', { name: 'Open Atlas controls' });
  await controlsToggle.tap();
  await expect(controlsToggle).toHaveAttribute('aria-expanded', 'true');
  const modes = page.locator('#view-mode-control');
  await modes.scrollIntoViewIfNeeded();
  await expect(modes).toHaveScreenshot('mobile-view-mode.png', {
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });

  await gotoAtlas(page, MONSTER_PLAYBACK_ENTRY);
  await waitForAtlas(page);
  await page.locator('#mobile-controls-toggle').click();
  const npcToggle = page.locator('input[data-creature-kind="npc"]');
  const monsterToggle = page.locator('input[data-creature-kind="monster"]');
  await expect(npcToggle).toBeChecked();
  await expect(monsterToggle).toBeChecked();
  await npcToggle.uncheck();
  await page.waitForFunction(() => {
    const value = globalThis.__OTERYN_ATLAS_CREATURES__;
    return value?.status === 'PASS'
      && value.enabled?.npc === false
      && value.enabled?.monster === true
      && value.pixelDrawnRecords > 0;
  }, null, { timeout: 30_000 });
  const staticMonsterPixels = await page.locator('#creature-overlay').screenshot({ animations: 'disabled' });
  const playback = page.locator('#animation-toggle');
  const beforeFrames = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationRuntime?.frameUpdates ?? 0);
  await playback.check();
  await page.waitForFunction((before) => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === true
    && (globalThis.__OTERYN_ATLAS_CREATURES__?.animationRuntime?.frameUpdates ?? 0) > before, beforeFrames, { timeout: 30_000 });
  await expect.poll(async () => !(await page.locator('#creature-overlay').screenshot({ animations: 'disabled' })).equals(staticMonsterPixels),
    { timeout: 30_000 }).toBeTruthy();
  await playback.uncheck();
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false, null, { timeout: 30_000 });
  await expect.poll(async () => (await page.locator('#creature-overlay').screenshot({ animations: 'disabled' })).equals(staticMonsterPixels),
    { timeout: 30_000 }).toBeTruthy();
  assertNoRuntimeFailures(runtime);
});
