import { expect, test } from '@playwright/test';
import { waitForCreatureAlignedToBase } from '../support/diagnostics.mjs';
import {
  committedRenderer,
  installHeldRangeRequests,
  viewFromUrl,
  waitForCommittedView,
  waitForQualifiedView,
} from '../support/fault-network.mjs';
import {
  DESKTOP_ENTRY,
  assertNoRuntimeFailures,
  captureRuntimeFailures,
  gotoAtlas,
  waitForAtlas,
} from './runtime.mjs';

async function navigateCoordinates(page, x, y, floor = -7) {
  await page.locator('#search-input').fill(`${x} ${y} ${floor}`);
  await page.locator('#search-form button[type="submit"]').click();
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('x'))).toBe(x);
  await expect.poll(() => Number(new URL(page.url()).searchParams.get('y'))).toBe(y);
}

async function waitCreatureRuntime(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_CREATURES__?.status), null, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
}

test('reordered authenticated range completion cannot commit a stale pan target', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  const before = await committedRenderer(page);
  const faults = await installHeldRangeRequests(page, { limit: 2 });
  try {
    await navigateCoordinates(page, 32469, 32341);
    const held = await faults.waitForHeld(2);
    expect(held).toHaveLength(2);
    expect(held[0].range).toMatch(/^bytes=\d+-\d+$/);
    expect(held[1].range).toMatch(/^bytes=\d+-\d+$/);

    faults.release(1);
    faults.release(0);
    const expected = viewFromUrl(page.url());
    const committed = await waitForCommittedView(page, expected, before.generation);
    expect(committed.transform.centerTileX).toBe(32469);
    expect(committed.transform.centerTileY).toBe(32341);
    expect(faults.evidence().released).toEqual([1, 0]);
    assertNoRuntimeFailures(runtime);
  } finally {
    await faults.dispose();
  }
});

test('superseded delayed range abort stays expected and newest view is the only committed target', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  const before = await committedRenderer(page);
  const faults = await installHeldRangeRequests(page, { limit: 8 });
  try {
    await navigateCoordinates(page, 32469, 32341);
    await faults.waitForHeld(1);
    await navigateCoordinates(page, 32569, 32441);
    faults.releaseAll();

    const expected = viewFromUrl(page.url());
    const committed = await waitForCommittedView(page, expected, before.generation);
    expect(committed.transform.centerTileX).toBe(32569);
    expect(committed.transform.centerTileY).toBe(32441);
    const qualified = await waitForQualifiedView(page, expected);
    expect(qualified.status).toBe('PASS');
    assertNoRuntimeFailures(runtime);
  } finally {
    await faults.dispose();
  }
});

test('resize and rapid creature toggles during pending ranges converge on latest committed geometry', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, `${DESKTOP_ENTRY}&creatures=npc,monster`);
  await waitForAtlas(page);
  const creatures = await waitCreatureRuntime(page);
  test.skip(creatures.status === 'FAIL' && /HTTP 404/.test(creatures.error ?? ''), 'Current target has no optional creature publication.');
  expect(creatures.status, creatures.error ?? 'creature runtime').toBe('PASS');

  const faults = await installHeldRangeRequests(page, { limit: 8 });
  try {
    const before = await committedRenderer(page);
    await navigateCoordinates(page, 32469, 32341);
    await faults.waitForHeld(1);

    await page.setViewportSize({ width: 1180, height: 760 });
    const npc = page.locator('input[data-creature-kind="npc"]');
    const monster = page.locator('input[data-creature-kind="monster"]');
    await monster.uncheck();
    await npc.uncheck();
    await npc.check();
    await monster.check();
    faults.releaseAll();

    const expected = viewFromUrl(page.url());
    const committed = await waitForCommittedView(page, expected, before.generation);
    const aligned = await waitForCreatureAlignedToBase(page, false);
    expect(aligned.creature.baseGenerationAtCommit).toBe(aligned.base.generation);
    expect(committed.transform.cssViewportWidth).toBeGreaterThan(0);
    expect(committed.transform.cssViewportHeight).toBeGreaterThan(0);
    const currentCreatures = await waitCreatureRuntime(page);
    expect(currentCreatures.enabled).toEqual({ npc: true, monster: true });
    assertNoRuntimeFailures(runtime);
  } finally {
    await faults.dispose();
  }
});

test('reload during an in-flight range discards the old operation and requalifies the current URL', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  const faults = await installHeldRangeRequests(page, { limit: 1 });
  try {
    await navigateCoordinates(page, 32469, 32341);
    await faults.waitForHeld(1);
    const expected = viewFromUrl(page.url());
    await page.reload({ waitUntil: 'domcontentloaded' });
    faults.releaseAll();
    await waitForAtlas(page);
    const committed = await waitForCommittedView(page, expected, 0);
    expect(committed.transform.centerTileX).toBe(expected.x);
    expect(committed.transform.centerTileY).toBe(expected.y);
    assertNoRuntimeFailures(runtime);
  } finally {
    await faults.dispose();
  }
});
test('browser back supersedes an in-flight historical view without stale commit', async ({ page }) => {
  const runtime = captureRuntimeFailures(page);
  await gotoAtlas(page, DESKTOP_ENTRY);
  await waitForAtlas(page);
  const original = viewFromUrl(page.url());
  const faults = await installHeldRangeRequests(page, { limit: 1 });
  try {
    const moved = new URL(page.url());
    moved.searchParams.set('x', '32469');
    moved.searchParams.set('y', '32341');
    await page.goto(moved.href, { waitUntil: 'domcontentloaded' });
    await faults.waitForHeld(1);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    faults.releaseAll();
    await waitForAtlas(page);
    const committed = await waitForCommittedView(page, original, 0);
    expect(committed.transform.centerTileX).toBe(original.x);
    expect(committed.transform.centerTileY).toBe(original.y);
    expect(viewFromUrl(page.url())).toEqual(original);
    assertNoRuntimeFailures(runtime);
  } finally {
    await faults.dispose();
  }
});
