import { expect, test } from '@playwright/test';
import { generateUserJourney, parseUserJourney } from '../support/user-journey-actions.mjs';
import {
  activateCommittedCreature,
  assertJourneyHealthy,
  attachJourneyEvidence,
  closeMobileControls,
  creatureEntry,
  cyclePlayback,
  discoverCreatureTarget,
  discoverSemanticTarget,
  ensureMobileControls,
} from '../support/user-journey-browser.mjs';
import {
  MOBILE_ENTRY,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
  waitForSemanticSearch,
} from './runtime.mjs';

const DEFAULT_SEED = 0x9158;
const DEFAULT_LENGTH = 12;

async function exerciseDrawer(page) {
  await ensureMobileControls(page);
  await expect(page.locator('#mobile-search-input')).toBeVisible();
  await expect(page.locator('#view-mode-control')).toBeVisible();
  await closeMobileControls(page);
}

async function searchPublishedPlace(page, record) {
  await waitForSemanticSearch(page);
  await ensureMobileControls(page);
  const input = page.locator('#mobile-search-input');
  const results = page.locator('#semantic-search-results-mobile');
  await input.fill(record.label);
  const option = results.getByRole('option').filter({ hasText: record.label }).first();
  await expect(option).toBeVisible();
  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('semantic') === record.id),
    option.tap(),
  ]);
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText(record.label);
  const inspectorToggle = page.locator('#mobile-inspector-toggle');
  await inspectorToggle.tap();
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-inspector-panel')).not.toHaveClass(/mobile-open/);
}

async function setMode(page, value) {
  await ensureMobileControls(page);
  const control = page.locator(`#view-mode-control [data-mode="${value}"]`);
  await control.scrollIntoViewIfNeeded();
  await control.tap();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe(value);
  await closeMobileControls(page);
}

async function changeFloor(page, direction) {
  await ensureMobileControls(page);
  let selector = direction === 'up' ? '#floor-up' : '#floor-down';
  if (!(await page.locator(selector).isEnabled())) selector = selector === '#floor-up' ? '#floor-down' : '#floor-up';
  expect(await page.locator(selector).isEnabled(), 'mobile journey needs an adjacent exported floor').toBeTruthy();
  const before = new URL(page.url()).searchParams.get('floor');
  await page.locator(selector).tap();
  await expect.poll(() => new URL(page.url()).searchParams.get('floor')).not.toBe(before);
  await closeMobileControls(page);
}

async function inspectCreature(page, record) {
  await gotoAtlas(page, creatureEntry(record));
  await waitForAtlas(page);
  await activateCommittedCreature(page, record, 'mobile');
  await expect(page.locator('#creature-card-title')).toContainText(record.label);
  const details = page.locator('#creature-card-details');
  await details.tap();
  await expect(page.locator('#mobile-inspector-panel')).toHaveClass(/mobile-open/);
  await expect(page.locator('#creature-inspector')).toContainText(record.label);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-inspector-panel')).not.toHaveClass(/mobile-open/);
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#creature-quick-card')).toBeHidden();
}

async function resize(page, action) {
  await page.setViewportSize({ width: action.width, height: action.height });
  await expect(page.locator('#map-frame')).toBeVisible();
  await expect(page.locator('#mobile-controls-toggle')).toBeVisible();
}

async function executeAction(page, action, context) {
  if (action.type === 'drawer') await exerciseDrawer(page);
  else if (action.type === 'search') await searchPublishedPlace(page, context.semantic);
  else if (action.type === 'mode') await setMode(page, action.value);
  else if (action.type === 'floor') await changeFloor(page, action.direction);
  else if (action.type === 'creature') await inspectCreature(page, context.creatures[action.kind]);
  else if (action.type === 'playback') await cyclePlayback(page, 'mobile');
  else if (action.type === 'resize') await resize(page, action);
  else if (action.type === 'history') {
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await waitForAtlas(page);
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await waitForAtlas(page);
  } else if (action.type === 'reload') {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAtlas(page);
  } else throw new Error(`unsupported mobile journey action ${action.type}`);
}

async function runJourney(page, testInfo, runtime, seed, actions) {
  const context = {
    semantic: await discoverSemanticTarget(page),
    creatures: {
      npc: await discoverCreatureTarget(page, 'npc'),
      monster: await discoverCreatureTarget(page, 'monster'),
    },
  };
  for (let index = 0; index < actions.length; index += 1) {
    try {
      await executeAction(page, actions[index], context);
      await assertJourneyHealthy(page, runtime);
    } catch (error) {
      testInfo.annotations.push({ type: 'first-failing-action', description: String(index) });
      await attachJourneyEvidence(testInfo, seed, actions, page, index);
      throw new Error(`mobile user journey action ${index} (${actions[index].type}) failed: ${error.message}`);
    }
  }
  await attachJourneyEvidence(testInfo, seed, actions, page);
}

test('mobile user completes a realistic touch-first cross-feature Atlas session', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${MOBILE_ENTRY}&creatures=npc,monster&animation=off`);
  await waitForAtlas(page);
  const actions = [
    { type: 'drawer' },
    { type: 'search' },
    { type: 'mode', value: 'map' },
    { type: 'floor', direction: 'down' },
    { type: 'creature', kind: 'npc' },
    { type: 'creature', kind: 'monster' },
    { type: 'playback' },
    { type: 'resize', width: 844, height: 390 },
    { type: 'resize', width: 390, height: 844 },
    { type: 'history' },
    { type: 'reload' },
  ];
  await runJourney(page, testInfo, runtime, null, actions);
});

test('mobile seeded exploratory user session is replayable and checks invariants after every action', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const replay = process.env.ATLAS_USER_JOURNEY_REPLAY?.trim();
  const seed = replay ? null : Number(process.env.ATLAS_USER_JOURNEY_SEED ?? DEFAULT_SEED);
  const length = Number(process.env.ATLAS_USER_JOURNEY_LENGTH ?? DEFAULT_LENGTH);
  const actions = replay ? parseUserJourney(replay) : generateUserJourney(seed, { surface: 'mobile', length });
  if (seed !== null) testInfo.annotations.push({ type: 'seed', description: String(seed) });
  await gotoAtlas(page, `${MOBILE_ENTRY}&creatures=npc,monster&animation=off`);
  await waitForAtlas(page);
  await runJourney(page, testInfo, runtime, seed, actions);
});
