import { expect, test } from '@playwright/test';
import { generateUserJourney, parseUserJourney } from '../support/user-journey-actions.mjs';
import {
  activateCommittedCreature,
  assertJourneyHealthy,
  attachJourneyEvidence,
  creatureEntry,
  cyclePlayback,
  discoverCreatureTarget,
  discoverSemanticTarget,
} from '../support/user-journey-browser.mjs';
import {
  DESKTOP_ENTRY,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

const DEFAULT_SEED = 0x158;
const DEFAULT_LENGTH = 12;

async function searchPublishedPlace(page, record) {
  const input = page.locator('#search-input');
  const results = page.locator('#semantic-search-results-desktop');
  await input.fill(record.label);
  const option = results.getByRole('option').filter({ hasText: record.label }).first();
  await expect(option).toBeVisible();
  await Promise.all([
    page.waitForURL((url) => url.searchParams.get('semantic') === record.id),
    option.click(),
  ]);
  await waitForAtlas(page);
  await expect(page.locator('#inspector-content')).toContainText(record.label);
}

async function zoom(page, direction) {
  let selector = direction === 'in' ? '#zoom-in' : '#zoom-out';
  if (!(await page.locator(selector).isEnabled())) selector = selector === '#zoom-in' ? '#zoom-out' : '#zoom-in';
  const before = Number(new URL(page.url()).searchParams.get('zoom'));
  await page.locator(selector).click();
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('zoom'))).not.toBe(before);
}

async function pan(page, action) {
  const before = new URL(page.url());
  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + action.dx, y + action.dy, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => {
    const current = new URL(page.url());
    return current.searchParams.get('x') !== before.searchParams.get('x')
      || current.searchParams.get('y') !== before.searchParams.get('y');
  }).toBeTruthy();
}

async function setMode(page, value) {
  await page.locator(`#view-mode-control [data-mode="${value}"]`).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe(value);
}

async function changeFloor(page, direction) {
  let selector = direction === 'up' ? '#floor-up' : '#floor-down';
  if (!(await page.locator(selector).isEnabled())) selector = selector === '#floor-up' ? '#floor-down' : '#floor-up';
  expect(await page.locator(selector).isEnabled(), 'journey needs an adjacent exported floor').toBeTruthy();
  const before = new URL(page.url()).searchParams.get('floor');
  await page.locator(selector).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('floor')).not.toBe(before);
}

async function inspectCreature(page, record) {
  await gotoAtlas(page, creatureEntry(record));
  await waitForAtlas(page);
  await activateCommittedCreature(page, record, 'desktop');
  await expect(page.locator('#creature-card-title')).toContainText(record.label);
  await page.locator('#creature-card-details').click();
  await expect(page.locator('#creature-inspector')).toContainText(record.label);
}

async function executeAction(page, action, context) {
  if (action.type === 'search') await searchPublishedPlace(page, context.semantic);
  else if (action.type === 'zoom') await zoom(page, action.direction);
  else if (action.type === 'pan') await pan(page, action);
  else if (action.type === 'mode') await setMode(page, action.value);
  else if (action.type === 'floor') await changeFloor(page, action.direction);
  else if (action.type === 'creature') await inspectCreature(page, context.creatures[action.kind]);
  else if (action.type === 'playback') await cyclePlayback(page, 'desktop');
  else if (action.type === 'history') {
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await waitForAtlas(page);
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await waitForAtlas(page);
  } else if (action.type === 'reload') {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAtlas(page);
  } else throw new Error(`unsupported desktop journey action ${action.type}`);
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
      throw new Error(`desktop user journey action ${index} (${actions[index].type}) failed: ${error.message}`);
    }
  }
  await attachJourneyEvidence(testInfo, seed, actions, page);
}

test('desktop user completes a realistic cross-feature Atlas session', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster&animation=off`);
  await waitForAtlas(page);
  const actions = [
    { type: 'zoom', direction: 'in' },
    { type: 'pan', dx: 72, dy: 36 },
    { type: 'mode', value: 'minimap' },
    { type: 'mode', value: 'map' },
    { type: 'floor', direction: 'down' },
    { type: 'search' },
    { type: 'creature', kind: 'npc' },
    { type: 'creature', kind: 'monster' },
    { type: 'playback' },
    { type: 'history' },
    { type: 'reload' },
  ];
  await runJourney(page, testInfo, runtime, null, actions);
});

test('desktop seeded exploratory user session is replayable and checks invariants after every action', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const replay = process.env.ATLAS_USER_JOURNEY_REPLAY?.trim();
  const seed = replay ? null : Number(process.env.ATLAS_USER_JOURNEY_SEED ?? DEFAULT_SEED);
  const length = Number(process.env.ATLAS_USER_JOURNEY_LENGTH ?? DEFAULT_LENGTH);
  const actions = replay ? parseUserJourney(replay) : generateUserJourney(seed, { surface: 'desktop', length });
  if (seed !== null) testInfo.annotations.push({ type: 'seed', description: String(seed) });
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster&animation=off`);
  await waitForAtlas(page);
  await runJourney(page, testInfo, runtime, seed, actions);
});
