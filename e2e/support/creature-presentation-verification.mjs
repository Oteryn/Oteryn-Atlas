import { expect } from '@playwright/test';

export const MAX_PRESENTATION_SAMPLES = 24;

export async function waitForCreatureState(page) {
  await page.waitForFunction(() => ['PASS', 'FAIL'].includes(globalThis.__OTERYN_ATLAS_CREATURES__?.status), null, {
    timeout: 30_000,
  });
  const state = await page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__);
  expect(state.status, state.error ?? 'creature runtime').toBe('PASS');
  return state;
}

export async function waitForPresentationCommit(page) {
  await page.waitForFunction(() => {
    const state = globalThis.__OTERYN_ATLAS_CREATURES__;
    const render = state?.render;
    return state?.status === 'PASS'
      && render?.baseGenerationAtStart != null
      && render?.baseGenerationAtStart === render?.baseGenerationAtCommit;
  }, null, { timeout: 30_000 });
  return waitForCreatureState(page);
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
export function assertPresentationContract(state) {
  const render = state.render;
  expect(render?.labelStyle).toBe('creature-labels-v1');
  expect(render?.npcMarkerStyle).toBe('functional-icons-v2');
  for (const key of ['labelsConsidered', 'labelsDrawn', 'labelsSuppressed', 'drawnNpcBadges', 'drawnNpcIcons']) {
    expect(nonNegativeInteger(render?.[key]), `${key} must be a non-negative integer`).toBeTruthy();
  }
  expect(render.labelsDrawn + render.labelsSuppressed).toBe(render.labelsConsidered);
  expect(render.drawnNpcBadges).toBeGreaterThanOrEqual(render.drawnNpcIcons);
  expect(Number.isSafeInteger(render.labelLayoutGeneration)).toBeTruthy();
  expect(render.labelLayoutGeneration).toBeGreaterThanOrEqual(1);
  expect(typeof render.labelLayoutKey).toBe('string');
  expect(render.labelLayoutKey.length).toBeGreaterThan(0);
  expect(render.effectivePresentation).toEqual(expect.objectContaining({
    requestedMode: expect.any(String), representation: expect.any(String), lod: expect.any(String),
  }));
  for (const key of ['presentationRects', 'labelLayouts', 'badgeLayouts']) {
    expect(Array.isArray(render[key]), `${key} must be an array`).toBeTruthy();
    expect(render[key].length, `${key} must remain bounded`).toBeLessThanOrEqual(MAX_PRESENTATION_SAMPLES);
  }
  return render;
}

export function assertCssRect(rect, viewport, label = 'presentation rect') {
  expect(rect, `${label} missing`).not.toBeNull();
  for (const key of ['x', 'y', 'width', 'height']) {
    expect(Number.isFinite(rect?.[key]), `${label}.${key} must be finite`).toBeTruthy();
  }
  expect(rect.width, `${label}.width`).toBeGreaterThan(0);
  expect(rect.height, `${label}.height`).toBeGreaterThan(0);
  expect(rect.x, `${label}.x`).toBeGreaterThanOrEqual(-1);
  expect(rect.y, `${label}.y`).toBeGreaterThanOrEqual(-1);
  expect(rect.x + rect.width, `${label}.right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(rect.y + rect.height, `${label}.bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

export function labelLayoutFor(state, recordId) {
  return state.render?.labelLayouts?.find((entry) => entry.recordId === recordId) ?? null;
}

export function badgeLayoutFor(state, recordId) {
  return state.render?.badgeLayouts?.find((entry) => entry.recordId === recordId) ?? null;
}

export async function viewportSize(page) {
  return page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
}
export async function revalidatePublicationRecord(page, fixture) {
  const actual = await page.evaluate(async (recordId) => {
    const response = await fetch('/data/creatures/search.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`creature search HTTP ${response.status}`);
    const payload = await response.json();
    return payload.records.find((item) => item.record_id === recordId) ?? null;
  }, fixture.record_id);
  expect(actual, `publication fixture ${fixture.record_id}`).not.toBeNull();
  expect(actual.label).toBe(fixture.label);
  expect(actual.kind).toBe(fixture.kind);
  expect(actual.position).toEqual(fixture.position);
  expect(actual.roles ?? []).toEqual([...fixture.roles]);
  return actual;
}

export async function assertRecordIdsPublished(page, recordIds) {
  const observed = await page.evaluate(async (ids) => {
    const response = await fetch('/data/creatures/search.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`creature search HTTP ${response.status}`);
    const payload = await response.json();
    const wanted = new Set(ids);
    return payload.records.filter((item) => wanted.has(item.record_id)).map((item) => item.record_id);
  }, recordIds);
  expect(new Set(observed)).toEqual(new Set(recordIds));
}
