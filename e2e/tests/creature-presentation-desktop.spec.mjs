import { expect, test } from '@playwright/test';
import {
  DENSE_MONSTER_SCENE,
  LONG_NAME_NPC,
  MIXED_SCENE,
  NEARBY_NPC_SCENE,
  OVERFLOW_NPC,
  TWO_ROLE_NPC,
  sceneEntry,
} from '../support/creature-presentation-fixtures.mjs';
import {
  assertCssRect,
  assertPresentationContract,
  assertRecordIdsPublished,
  badgeLayoutFor,
  labelLayoutFor,
  revalidatePublicationRecord,
  viewportSize,
  waitForPresentationCommit,
} from '../support/creature-presentation-verification.mjs';
import { captureUserVisualEvidence } from '../support/user-acceptance.mjs';
import { waitForCreatureAlignedToBase } from '../support/diagnostics.mjs';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

async function openScenario(page, entry) {
  await gotoAtlas(page, entry);
  await waitForAtlas(page);
  return waitForPresentationCommit(page);
}
function slotSummary(layout) {
  return layout?.slots?.map((slot) => slot.kind === 'role'
    ? { kind: 'role', role: slot.role }
    : { kind: 'overflow', hiddenCount: slot.hiddenCount }) ?? [];
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function assertLayoutAvoids(page, rect, selector, label) {
  const atlas = await page.locator('#atlas').boundingBox();
  const reserved = await page.locator(selector).boundingBox();
  expect(atlas, 'atlas bounds').not.toBeNull();
  if (!reserved) return;
  const screenRect = {
    x: atlas.x + rect.x,
    y: atlas.y + rect.y,
    width: rect.width,
    height: rect.height,
  };
  expect(overlaps(screenRect, reserved), `${label} must avoid ${selector}`).toBeFalsy();
}

test('desktop mixed scene exposes #115 diagnostics and coexists with #113 card geometry', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const ids = [MIXED_SCENE.npcRecordId, ...MIXED_SCENE.monsterRecordIds];
  const state = await openScenario(page, sceneEntry(MIXED_SCENE, { creature: MIXED_SCENE.npcRecordId }));
  await assertRecordIdsPublished(page, ids);
  expect((await viewportSize(page)).dpr).toBe(1);
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.mixed-card', {
    note: 'Mixed factual NPC/monster scene with the canonical #113 creature card open.',
  });

  const render = assertPresentationContract(state);
  expect(render.labelLayouts.some((entry) => entry.kind === 'npc')).toBeTruthy();
  expect(render.labelLayouts.some((entry) => entry.kind === 'monster')).toBeTruthy();
  const aligned = await waitForCreatureAlignedToBase(page, true);
  expect(render.baseGenerationAtCommit).toBe(aligned.base.generation);
  const selectedPresentation = render.presentationRects.find((entry) => entry.recordId === MIXED_SCENE.npcRecordId);
  expect(selectedPresentation?.rect).toEqual(state.cardTargetRect);
  const selectedLabel = labelLayoutFor(state, MIXED_SCENE.npcRecordId);
  if (selectedLabel?.rect) await assertLayoutAvoids(page, selectedLabel.rect, '#creature-quick-card', 'selected creature label');
  const atlasBox = await page.locator('#atlas').boundingBox();
  const cardBox = await page.locator('#creature-quick-card').boundingBox();
  expect(atlasBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  const hoverTarget = render.presentationRects
    .filter((entry) => MIXED_SCENE.monsterRecordIds.includes(entry.recordId) && entry.rect)
    .find((entry) => {
      const screenX = atlasBox.x + entry.rect.x + entry.rect.width / 2;
      const screenY = atlasBox.y + entry.rect.y + entry.rect.height / 2;
      return screenX < cardBox.x || screenX > cardBox.x + cardBox.width
        || screenY < cardBox.y || screenY > cardBox.y + cardBox.height;
    });
  expect(hoverTarget, 'mixed-scene needs an unoccluded monster hover target').toBeDefined();
  const hoverId = hoverTarget.recordId;
  const beforeHoverLayout = render.labelLayoutGeneration;
  await page.mouse.move(
    atlasBox.x + hoverTarget.rect.x + hoverTarget.rect.width / 2,
    atlasBox.y + hoverTarget.rect.y + hoverTarget.rect.height / 2,
  );
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.hoveredRecordId)).toBe(hoverId);
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.render?.labelLayoutGeneration ?? 0))
    .toBeGreaterThan(beforeHoverLayout);
  const hoveredState = await waitForPresentationCommit(page);
  expect(labelLayoutFor(hoveredState, hoverId)?.priority).toBe('hovered');
  assertNoRuntimeFailures(runtime);
});

test('desktop factual role rows preserve canonical roles, overflow count and active filtered role', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  let state = await openScenario(page, sceneEntry(TWO_ROLE_NPC, { creatures: 'npc' }));
  await revalidatePublicationRecord(page, TWO_ROLE_NPC);
  await revalidatePublicationRecord(page, OVERFLOW_NPC);
  assertPresentationContract(state);
  let badge = badgeLayoutFor(state, TWO_ROLE_NPC.record_id);
  expect(slotSummary(badge)).toEqual([
    { kind: 'role', role: 'shop' },
    { kind: 'role', role: 'quest' },
  ]);
  expect(badge.rects).toHaveLength(2);
  const viewport = await viewportSize(page);
  badge.rects.forEach((rect, index) => assertCssRect(rect, viewport, `Albinius badge ${index}`));

  state = await openScenario(page, sceneEntry(OVERFLOW_NPC, { creatures: 'npc' }));
  await revalidatePublicationRecord(page, OVERFLOW_NPC);
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.overflow-eremo', {
    note: 'Factual five-role Eremo fixture; expected row is first two roles plus +3 overflow.',
  });
  assertPresentationContract(state);
  badge = badgeLayoutFor(state, OVERFLOW_NPC.record_id);
  expect(slotSummary(badge)).toEqual([
    { kind: 'role', role: 'travel' },
    { kind: 'role', role: 'shop' },
    { kind: 'overflow', hiddenCount: 3 },
  ]);

  state = await openScenario(page, sceneEntry(OVERFLOW_NPC, { creatures: 'npc', npcRole: 'trainer' }));
  expect(state.npcRole).toBe('trainer');
  assertPresentationContract(state);
  badge = badgeLayoutFor(state, OVERFLOW_NPC.record_id);
  expect(slotSummary(badge)).toEqual([
    { kind: 'role', role: 'travel' },
    { kind: 'role', role: 'trainer' },
    { kind: 'overflow', hiddenCount: 3 },
  ]);
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.overflow-filter-trainer', {
    note: 'Active factual trainer filter must stay explicitly visible without rewriting canonical Eremo roles.',
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  state = await waitForPresentationCommit(page);
  expect(new URL(page.url()).searchParams.get('npcRole')).toBe('trainer');
  expect(state.npcRole).toBe('trainer');
  expect(slotSummary(badgeLayoutFor(state, OVERFLOW_NPC.record_id))).toEqual(slotSummary(badge));
  assertNoRuntimeFailures(runtime);
});

test('desktop dense occupancy is deterministic and long factual names stay bounded at edges', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  let state = await openScenario(page, sceneEntry(DENSE_MONSTER_SCENE, { creatures: 'monster', zoom: 1 }));
  await assertRecordIdsPublished(page, DENSE_MONSTER_SCENE.recordIds);
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.dense-monsters', {
    note: 'Five factual monsters occupy a two-tile cluster; label placement must stay deterministic and non-overlapping.',
  });
  let render = assertPresentationContract(state);
  const denseSet = new Set(DENSE_MONSTER_SCENE.recordIds);
  const signature = render.labelLayouts.filter((entry) => denseSet.has(entry.recordId))
    .map(({ recordId, displayText, suppressed, rect }) => ({ recordId, displayText, suppressed, rect }))
    .sort((a, b) => a.recordId.localeCompare(b.recordId));
  expect(signature.length).toBeGreaterThan(0);
  const drawnDense = signature.filter((entry) => !entry.suppressed && entry.rect);
  for (let left = 0; left < drawnDense.length; left += 1) {
    for (let right = left + 1; right < drawnDense.length; right += 1) {
      expect(
        overlaps(drawnDense[left].rect, drawnDense[right].rect),
        `dense labels ${drawnDense[left].recordId} and ${drawnDense[right].recordId} must not overlap`,
      ).toBeFalsy();
    }
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  state = await waitForPresentationCommit(page);
  render = assertPresentationContract(state);
  const repeated = render.labelLayouts.filter((entry) => denseSet.has(entry.recordId))
    .map(({ recordId, displayText, suppressed, rect }) => ({ recordId, displayText, suppressed, rect }))
    .sort((a, b) => a.recordId.localeCompare(b.recordId));
  expect(repeated).toEqual(signature);

  state = await openScenario(page, sceneEntry(NEARBY_NPC_SCENE, { creatures: 'npc', zoom: 1.5 }));
  await assertRecordIdsPublished(page, NEARBY_NPC_SCENE.recordIds);
  render = assertPresentationContract(state);
  const nearby = new Set(NEARBY_NPC_SCENE.recordIds);
  expect(render.badgeLayouts.filter((entry) => nearby.has(entry.recordId)).length).toBeGreaterThanOrEqual(3);
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.nearby-npcs', {
    note: 'Five nearby factual shop NPCs exercise bounded NPC label/badge occupancy.',
  });

  await openScenario(page, sceneEntry(LONG_NAME_NPC, { creatures: 'npc', zoom: 2 }));
  await revalidatePublicationRecord(page, LONG_NAME_NPC);
  const box = await page.locator('#atlas').boundingBox();
  expect(box).not.toBeNull();
  const halfTiles = box.width / (2 * 32 * 2);
  const edgeScene = { center: {
    floor: LONG_NAME_NPC.position.floor,
    x: LONG_NAME_NPC.position.x - Math.max(0.5, halfTiles - 0.75),
    y: LONG_NAME_NPC.position.y,
  } };
  state = await openScenario(page, sceneEntry(edgeScene, { creatures: 'npc', zoom: 2 }));
  render = assertPresentationContract(state);
  const longLabel = labelLayoutFor(state, LONG_NAME_NPC.record_id);
  expect(longLabel, 'long-name label must be represented in bounded diagnostics').not.toBeNull();
  expect(longLabel.suppressed).toBe(false);
  expect(longLabel.displayText).not.toBe(LONG_NAME_NPC.label);
  expect(longLabel.displayText).toMatch(/(?:…|\.\.\.)$/);
  assertCssRect(longLabel.rect, await viewportSize(page), 'long-name edge label');
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.long-name-edge', {
    note: 'Longest revalidated factual label is placed at a viewport edge and must ellipsize without clipping.',
  });
  assertNoRuntimeFailures(runtime);
});

test('desktop mode-aware LOD is sparse in minimap/classic/overview and follows canonical auto representation', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const mapLods = [];
  for (const zoom of [0.5, 1, 2]) {
    const state = await openScenario(page, sceneEntry(MIXED_SCENE, { zoom, mode: 'map' }));
    const render = assertPresentationContract(state);
    expect(render.effectivePresentation.requestedMode).toBe('map');
    mapLods.push(render.effectivePresentation.lod);
  }
  expect(mapLods).toEqual(['far', 'medium', 'close']);

  let state = await openScenario(page, sceneEntry(MIXED_SCENE, { zoom: 2, mode: 'minimap' }));
  let render = assertPresentationContract(state);
  expect(render.effectivePresentation.requestedMode).toBe('minimap');
  expect(render.labelsDrawn).toBe(0);
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.minimap-sparse', {
    note: 'Forced MINIMAP must suppress ordinary full creature labels.',
  });

  state = await openScenario(page, sceneEntry(MIXED_SCENE, { zoom: 2, mode: 'classic' }));
  render = assertPresentationContract(state);
  expect(render.effectivePresentation.requestedMode).toBe('classic');
  expect(render.labelsDrawn).toBe(0);
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.classic-sparse', {
    note: 'Forced CLASSIC shares the sparse creature annotation class.',
  });

  state = await openScenario(page, sceneEntry(MIXED_SCENE, { zoom: 0.3, mode: 'auto' }));
  render = assertPresentationContract(state);
  expect(render.effectivePresentation).toEqual(expect.objectContaining({ requestedMode: 'auto', representation: 'minimap' }));
  expect(render.labelsDrawn).toBe(0);

  state = await openScenario(page, sceneEntry(MIXED_SCENE, { zoom: 0.44, mode: 'auto' }));
  render = assertPresentationContract(state);
  expect(render.effectivePresentation).toEqual(expect.objectContaining({ requestedMode: 'auto', representation: 'transition' }));

  state = await openScenario(page, sceneEntry(MIXED_SCENE, { zoom: 0.6, mode: 'auto' }));
  render = assertPresentationContract(state);
  expect(render.effectivePresentation).toEqual(expect.objectContaining({ requestedMode: 'auto', representation: 'detail' }));
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.map-detail', {
    note: 'AUTO detail side uses the canonical FullWorld representation rather than a creature-owned threshold.',
  });

  const beforeOverview = render;
  await page.locator('#overview-toggle').check();
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.render?.labelLayoutGeneration ?? 0))
    .toBeGreaterThan(beforeOverview.labelLayoutGeneration);
  state = await waitForPresentationCommit(page);
  render = assertPresentationContract(state);
  expect(render.labelsDrawn).toBeLessThanOrEqual(beforeOverview.labelsDrawn);
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.overview-sparse', {
    note: 'Technical overview must not become a wall of creature labels.',
  });
  assertNoRuntimeFailures(runtime);
});

test('desktop selection, camera/floor changes and animation preserve layout-lifetime contract', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const entry = sceneEntry(TWO_ROLE_NPC, { creatures: 'npc,monster', creature: TWO_ROLE_NPC.record_id, zoom: 2 });
  let state = await openScenario(page, entry);
  await revalidatePublicationRecord(page, TWO_ROLE_NPC);
  let render = assertPresentationContract(state);
  let label = labelLayoutFor(state, TWO_ROLE_NPC.record_id);
  expect(label?.suppressed).toBe(false);
  expect(label?.priority).toBe('selected');
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  if (label?.rect) {
    await assertLayoutAvoids(page, label.rect, '#creature-quick-card', 'selected label');
    await assertLayoutAvoids(page, label.rect, '#runtime-badge', 'selected label');
  }
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.selected-card', {
    note: 'Selected factual NPC remains promoted while sharing #113 card and reserved HUD space.',
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForAtlas(page);
  state = await waitForPresentationCommit(page);
  expect(new URL(page.url()).searchParams.get('creature')).toBe(TWO_ROLE_NPC.record_id);
  expect(state.selectedRecordId).toBe(TWO_ROLE_NPC.record_id);
  expect(labelLayoutFor(state, TWO_ROLE_NPC.record_id)?.priority).toBe('selected');

  state = await openScenario(page, '/web/fullworld.html?x=32831&y=32596&floor=-12&zoom=2&mode=map&animation=off&creatures=monster');
  render = assertPresentationContract(state);
  expect(state.pixelDrawnRecords, 'animation layout probe requires factual pixel-rendered creatures').toBeGreaterThan(0);
  const stableLayoutGeneration = render.labelLayoutGeneration;
  const beforeFrames = state.animationRuntime?.frameUpdates ?? 0;
  const playback = page.getByRole('checkbox', { name: /Playback/ });
  await playback.check();
  await page.waitForFunction((before) => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === true
    && (globalThis.__OTERYN_ATLAS_CREATURES__?.animationRuntime?.frameUpdates ?? 0) > before, beforeFrames, { timeout: 30_000 });
  state = await waitForPresentationCommit(page);
  render = assertPresentationContract(state);
  expect(render.labelLayoutGeneration, 'animation logical time must not recompute label layout').toBe(stableLayoutGeneration);
  await playback.uncheck();
  await page.waitForFunction(() => globalThis.__OTERYN_ATLAS_CREATURES__?.animationOn === false);

  const beforePan = render.labelLayoutGeneration;
  const atlasBox = await page.locator('#atlas').boundingBox();
  expect(atlasBox).not.toBeNull();
  await page.mouse.move(atlasBox.x + atlasBox.width / 2, atlasBox.y + atlasBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(atlasBox.x + atlasBox.width / 2 + 120, atlasBox.y + atlasBox.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.render?.labelLayoutGeneration ?? 0))
    .toBeGreaterThan(beforePan);
  await waitForCreatureAlignedToBase(page);

  const beforeZoom = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__.render.labelLayoutGeneration);
  await page.locator('#zoom-out').click();
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.render?.labelLayoutGeneration ?? 0))
    .toBeGreaterThan(beforeZoom);
  await waitForCreatureAlignedToBase(page);

  const beforeFloor = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__.render.labelLayoutGeneration);
  const oldFloor = new URL(page.url()).searchParams.get('floor');
  if (await page.locator('#floor-down').isEnabled()) await page.locator('#floor-down').click();
  else if (await page.locator('#floor-up').isEnabled()) await page.locator('#floor-up').click();
  else throw new Error('presentation fixture has no navigable adjacent floor');
  await expect.poll(() => new URL(page.url()).searchParams.get('floor')).not.toBe(oldFloor);
  await expect.poll(() => page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__?.render?.labelLayoutGeneration ?? 0))
    .toBeGreaterThan(beforeFloor);
  await waitForCreatureAlignedToBase(page);
  assertNoRuntimeFailures(runtime);
});
