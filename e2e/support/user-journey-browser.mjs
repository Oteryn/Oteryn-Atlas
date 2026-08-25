import { expect } from '@playwright/test';
import { waitForCreatureAlignedToBase } from './diagnostics.mjs';
import { assertNoRuntimeFailures } from '../tests/runtime.mjs';

export async function discoverSemanticTarget(page) {
  const response = await page.request.get('/web/semantic-search/index.json');
  expect(response.ok(), `semantic index HTTP ${response.status()}`).toBeTruthy();
  const index = await response.json();
  const counts = new Map();
  for (const record of index.records) counts.set(record.label, (counts.get(record.label) ?? 0) + 1);
  const record = index.records.find((item) => item.capabilities?.includes('navigation') && counts.get(item.label) === 1);
  expect(record, 'published semantic index needs a unique navigable record').toBeTruthy();
  return record;
}

export async function discoverCreatureTarget(page, kind) {
  const response = await page.request.get('/data/creatures/search.json');
  expect(response.ok(), `creature search HTTP ${response.status()}`).toBeTruthy();
  const product = await response.json();
  const record = product.records.find((item) => item.kind === kind) ?? null;
  expect(record, `published creature search needs a ${kind} record`).not.toBeNull();
  return record;
}

export function creatureEntry(record, zoom = 2) {
  const params = new URLSearchParams({
    x: String(record.position.x),
    y: String(record.position.y),
    floor: String(record.position.floor),
    zoom: String(zoom),
    mode: 'map',
    creatures: 'npc,monster',
    creature: record.record_id,
    animation: 'off',
  });
  return `/web/fullworld.html?${params.toString()}`;
}

export async function creatureState(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_CREATURES__?.status), null,
    { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
}

export async function activateCommittedCreature(page, record, surface) {
  const state = await creatureState(page);
  expect(state.status).toBe('PASS');
  expect(state.cardRecordId).toBe(record.record_id);
  expect(state.cardTargetRect).not.toBeNull();
  const rect = state.cardTargetRect;
  const atlasBox = await page.locator('#atlas').boundingBox();
  expect(atlasBox).not.toBeNull();
  const x = atlasBox.x + rect.x + rect.width / 2;
  const y = atlasBox.y + rect.y + rect.height / 2;

  await page.locator('#creature-card-close').click();
  await expect(page.locator('#creature-quick-card')).toBeHidden();
  if (surface === 'mobile') await page.touchscreen.tap(x, y);
  else {
    await page.mouse.move(x, y);
    await page.mouse.click(x, y);
  }
  if ((await creatureState(page)).cardState === 'chooser') {
    const choice = page.locator('#creature-card-choices button').filter({ hasText: record.label }).first();
    if (surface === 'mobile') await choice.tap();
    else await choice.click();
  }
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  expect((await creatureState(page)).cardRecordId).toBe(record.record_id);
}

export async function ensureMobileControls(page) {
  const toggle = page.locator('#mobile-controls-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-controls-panel')).toHaveClass(/mobile-open/);
}

export async function closeMobileControls(page) {
  const toggle = page.locator('#mobile-controls-toggle');
  if ((await toggle.getAttribute('aria-expanded')) === 'true') {
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  }
}

export async function cyclePlayback(page, surface) {
  if (surface === 'mobile') await ensureMobileControls(page);
  const toggle = page.locator('#animation-toggle');
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toBeEnabled();
  await toggle.check();
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === true, null,
    { timeout: 30_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('on');
  await toggle.uncheck();
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false, null,
    { timeout: 30_000 });
  await expect.poll(() => new URL(page.url()).searchParams.get('animation')).toBe('off');
  if (surface === 'mobile') await closeMobileControls(page);
}

export async function assertJourneyHealthy(page, runtime) {
  assertNoRuntimeFailures(runtime);
  await expect(page.locator('#runtime-badge')).toContainText('VERIFIED FULL-WORLD');
  const frame = page.locator('#map-frame');
  await expect(frame).toBeVisible();
  const box = await frame.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(180);

  const snapshot = await page.evaluate(() => ({
    view: globalThis.__OTERYN_ATLAS_VIEW__ ?? null,
    renderer: globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__ ?? null,
    creatures: globalThis.__OTERYN_ATLAS_CREATURES__ ?? null,
  }));
  expect(snapshot.view).not.toBeNull();
  expect(snapshot.renderer?.generation ?? 0).toBeGreaterThan(0);
  expect(snapshot.renderer?.transform?.framebufferWidth ?? 0).toBeGreaterThan(0);
  expect(snapshot.renderer?.transform?.framebufferHeight ?? 0).toBeGreaterThan(0);
  const floor = new URL(page.url()).searchParams.get('floor');
  if (floor !== null) expect(String(snapshot.view.floor)).toBe(floor);
  if (snapshot.creatures?.status === 'PASS' && snapshot.creatures?.render) {
    await waitForCreatureAlignedToBase(page, false);
  }
}

export async function attachJourneyEvidence(testInfo, seed, actions, page, firstFailingActionIndex = null) {
  const runtime = await page.evaluate(() => ({
    url: location.href,
    view: globalThis.__OTERYN_ATLAS_VIEW__ ?? null,
    renderer: globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__ ?? null,
    creatures: globalThis.__OTERYN_ATLAS_CREATURES__ ?? null,
  }));
  await testInfo.attach('user-journey-log', {
    body: Buffer.from(JSON.stringify({ seed, firstFailingActionIndex, actions, runtime }, null, 2)),
    contentType: 'application/json',
  });
}
