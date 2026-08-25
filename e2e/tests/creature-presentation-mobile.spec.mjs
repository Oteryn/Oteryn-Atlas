import { expect, test } from '@playwright/test';
import { MIXED_SCENE, OVERFLOW_NPC, sceneEntry } from '../support/creature-presentation-fixtures.mjs';
import {
  assertCssRect,
  assertPresentationContract,
  badgeLayoutFor,
  labelLayoutFor,
  revalidatePublicationRecord,
  viewportSize,
  waitForPresentationCommit,
} from '../support/creature-presentation-verification.mjs';
import { captureUserVisualEvidence } from '../support/user-acceptance.mjs';
import { assertNoRuntimeFailures, captureRuntimeFailures, gotoAtlas, waitForAtlas } from './runtime.mjs';

async function openScenario(page, entry) {
  await gotoAtlas(page, entry);
  await waitForAtlas(page);
  return waitForPresentationCommit(page);
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}
async function assertAvoidsCard(page, rect) {
  const atlas = await page.locator('#atlas').boundingBox();
  const card = await page.locator('#creature-quick-card').boundingBox();
  expect(atlas).not.toBeNull();
  expect(card).not.toBeNull();
  const screenRect = {
    x: atlas.x + rect.x,
    y: atlas.y + rect.y,
    width: rect.width,
    height: rect.height,
  };
  expect(overlaps(screenRect, card), 'mobile creature label must avoid quick card').toBeFalsy();
}

test('mobile DPR2 keeps truthful Eremo badges in CSS pixels beside the canonical card', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  const state = await openScenario(page, sceneEntry(OVERFLOW_NPC, {
    creatures: 'npc', creature: OVERFLOW_NPC.record_id, zoom: 2,
  }));
  await revalidatePublicationRecord(page, OVERFLOW_NPC);
  const viewport = await viewportSize(page);
  expect(viewport.dpr).toBe(2);
  await expect(page.locator('#creature-quick-card')).toBeVisible();
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.mobile-eremo-card', {
    note: 'DPR2 mobile selected Eremo with factual overflow row and #113 card.',
  });
  const render = assertPresentationContract(state);
  const badge = badgeLayoutFor(state, OVERFLOW_NPC.record_id);
  expect(badge?.slots).toEqual([
    { kind: 'role', role: 'travel' },
    { kind: 'role', role: 'shop' },
    { kind: 'overflow', hiddenCount: 3 },
  ]);
  badge.rects.forEach((rect, index) => assertCssRect(rect, viewport, `mobile Eremo badge ${index}`));
  const presentation = render.presentationRects.find((entry) => entry.recordId === OVERFLOW_NPC.record_id);
  expect(presentation?.rect).toEqual(state.cardTargetRect);
  const label = labelLayoutFor(state, OVERFLOW_NPC.record_id);
  expect(label?.priority).toBe('selected');
  if (label?.rect) await assertAvoidsCard(page, label.rect);
  assertNoRuntimeFailures(runtime);
});

test('mobile AUTO follows minimap/detail representation without DPR-specific label inflation', async ({ page }, testInfo) => {
  const runtime = captureRuntimeFailures(page);
  let state = await openScenario(page, sceneEntry(MIXED_SCENE, { mode: 'auto', zoom: 0.3 }));
  let render = assertPresentationContract(state);
  expect((await viewportSize(page)).dpr).toBe(2);
  expect(render.effectivePresentation).toEqual(expect.objectContaining({ requestedMode: 'auto', representation: 'minimap' }));
  expect(render.labelsDrawn).toBe(0);

  state = await openScenario(page, sceneEntry(MIXED_SCENE, { mode: 'auto', zoom: 0.6 }));
  render = assertPresentationContract(state);
  expect(render.effectivePresentation).toEqual(expect.objectContaining({ requestedMode: 'auto', representation: 'detail' }));
  for (const entry of render.labelLayouts.filter((item) => item.rect && !item.suppressed)) {
    assertCssRect(entry.rect, await viewportSize(page), `mobile label ${entry.recordId}`);
  }
  await captureUserVisualEvidence(page, testInfo, 'creature-presentation.mobile-auto-detail', {
    note: 'Mobile DPR2 AUTO detail state with bounded CSS-pixel creature labels.',
  });
  assertNoRuntimeFailures(runtime);
});
