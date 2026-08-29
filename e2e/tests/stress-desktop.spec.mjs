import { expect, test } from '@playwright/test';

import { analyzeGeometryEventLog } from '../support/geometry-oracle.mjs';
import {
  installGeometryEventLog,
  readGeometryEventLog,
  waitForCreatureAlignedToBase,
  waitForCreatureCommit,
  waitForRendererCommit,
} from '../support/diagnostics.mjs';
import {
  generateActionLog,
  parseReplayActionLog,
  serializeActionLog,
} from '../support/seeded-actions.mjs';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas } from './runtime.mjs';

const ENTRY = `${DESKTOP_ENTRY}&animation=off&creatures=npc,monster`;
const DEFAULT_SEED = 0x85;
const DEFAULT_LENGTH = 18;
const TOLERANCE_PX = 0.25;

function configuredActions() {
  const replay = process.env.ATLAS_REPLAY_ACTION_LOG?.trim();
  if (replay) return { seed: null, actions: parseReplayActionLog(replay) };
  const seed = Number(process.env.ATLAS_STRESS_SEED ?? DEFAULT_SEED);
  const length = Number(process.env.ATLAS_STRESS_LENGTH ?? DEFAULT_LENGTH);
  return { seed, actions: generateActionLog(seed, length) };
}

async function ensureControlReachable(page, locator) {
  const inViewport = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0
      && rect.bottom <= innerHeight && rect.right <= innerWidth;
  }).catch(() => false);
  if (inViewport) return false;
  const toggle = page.locator('#mobile-controls-toggle');
  const mobileDrawer = await toggle.isVisible();
  if (mobileDrawer) {
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  return mobileDrawer;
}

async function closeControlsDrawer(page, opened) {
  if (!opened) return;
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-controls-toggle')).toHaveAttribute('aria-expanded', 'false');
}

async function currentGenerations(page) {
  return page.evaluate(() => ({
    base: globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__?.generation ?? 0,
    creature: globalThis.__OTERYN_ATLAS_CREATURES__?.render?.generation ?? 0,
  }));
}

async function pan(page, action) {
  const before = await currentGenerations(page);
  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + action.dx, y + action.dy);
  await page.mouse.up();
  await waitForRendererCommit(page, before.base);
}

async function zoom(page, action, kind) {
  const before = await currentGenerations(page);
  if (kind === 'wheelZoom') {
    const box = await page.locator('#atlas').boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, action.direction === 'in' ? -240 : 240);
  } else {
    const control = page.locator(action.direction === 'in' ? '#zoom-in' : '#zoom-out');
    const opened = await ensureControlReachable(page, control);
    await control.click();
    await closeControlsDrawer(page, opened);
  }
  await waitForRendererCommit(page, before.base);
}

async function setCreatureMode(page, value) {
  const before = await currentGenerations(page);
  const npc = page.locator('input[data-creature-kind="npc"]');
  const monster = page.locator('input[data-creature-kind="monster"]');
  const opened = await ensureControlReachable(page, npc);
  const wantedNpc = value === 'npc' || value === 'both';
  const wantedMonster = value === 'monster' || value === 'both';
  const npcChanged = (await npc.isChecked()) !== wantedNpc;
  const monsterChanged = (await monster.isChecked()) !== wantedMonster;
  if (npcChanged) await npc.setChecked(wantedNpc);
  if (monsterChanged) await monster.setChecked(wantedMonster);
  await page.waitForFunction(({ npcEnabled, monsterEnabled }) => {
    const enabled = globalThis.__OTERYN_ATLAS_CREATURES__?.enabled;
    return enabled?.npc === npcEnabled && enabled?.monster === monsterEnabled;
  }, { npcEnabled: wantedNpc, monsterEnabled: wantedMonster }, { timeout: 15_000 });
  if (npcChanged || monsterChanged) await waitForCreatureCommit(page, before.creature);
  await closeControlsDrawer(page, opened);
}

async function applyAction(page, action) {
  if (action.type === 'pan') await pan(page, action);
  else if (action.type === 'wheelZoom' || action.type === 'buttonZoom') await zoom(page, action, action.type);
  else if (action.type === 'resize') {
    const before = await currentGenerations(page);
    await page.setViewportSize({ width: action.width, height: action.height });
    await waitForRendererCommit(page, before.base);
  } else if (action.type === 'mode') {
    const before = await currentGenerations(page);
    const control = page.locator(`#view-mode-control [data-mode="${action.value}"]`);
    const opened = await ensureControlReachable(page, control);
    await control.click();
    await waitForRendererCommit(page, before.base);
    await closeControlsDrawer(page, opened);
  } else if (action.type === 'creatures') {
    await setCreatureMode(page, action.value);
  } else throw new Error(`unsupported stress action ${action.type}`);
  await waitForCreatureAlignedToBase(page, false);
}

async function attachReplayEvidence(testInfo, seed, actions, log, analysis, firstFailingActionIndex = null) {
  await testInfo.attach('action-log', {
    body: Buffer.from(JSON.stringify({ seed, firstFailingActionIndex, actions }, null, 2)),
    contentType: 'application/json',
  });
  await testInfo.attach('geometry-event-log', {
    body: Buffer.from(JSON.stringify({ analysis, log }, null, 2)),
    contentType: 'application/json',
  });
}

test('seeded interaction sequence preserves committed renderer/creature geometry', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const { seed, actions } = configuredActions();
  if (seed != null) testInfo.annotations.push({ type: 'seed', description: String(seed) });
  await gotoAtlas(page, ENTRY);
  await waitForRendererCommit(page);
  await waitForCreatureCommit(page, 0, true);
  await waitForCreatureAlignedToBase(page, true);
  await installGeometryEventLog(page);

  for (let index = 0; index < actions.length; index += 1) {
    try {
      await applyAction(page, actions[index]);
      const log = await readGeometryEventLog(page);
      const analysis = analyzeGeometryEventLog(log, TOLERANCE_PX);
      if (analysis.mismatches.length) throw new Error(JSON.stringify(analysis.mismatches[0]));
      assertNoRuntimeFailures(runtime);
    } catch (error) {
      testInfo.annotations.push({ type: 'first-failing-action', description: String(index) });
      const log = await readGeometryEventLog(page);
      await attachReplayEvidence(testInfo, seed, actions, log, analyzeGeometryEventLog(log, TOLERANCE_PX), index);
      throw new Error(`seeded action ${index} ${serializeActionLog([actions[index]])} failed: ${error.message}`);
    }
  }

  const log = await readGeometryEventLog(page);
  const analysis = analyzeGeometryEventLog(log, TOLERANCE_PX);
  expect(analysis.checked).toBeGreaterThan(0);
  expect(analysis.mismatches).toEqual([]);
  assertNoRuntimeFailures(runtime);
  await attachReplayEvidence(testInfo, seed, actions, log, analysis);
});
