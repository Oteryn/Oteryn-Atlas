export async function waitForRendererCommit(page, afterGeneration = 0) {
  await page.waitForFunction((after) => {
    const value = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__;
    return value?.generation > after && value?.transform?.framebufferWidth > 0;
  }, afterGeneration, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__);
}

export async function waitForCreatureCommit(page, afterGeneration = 0, requireAnchors = false) {
  await page.waitForFunction(({ after, anchors }) => {
    const value = globalThis.__OTERYN_ATLAS_CREATURES__;
    return value?.status === 'PASS'
      && value?.render?.generation > after
      && (!anchors || value.render.anchors?.length > 0);
  }, { after: afterGeneration, anchors: requireAnchors }, { timeout: 30_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_CREATURES__.render);
}

export async function installGeometryEventLog(page) {
  await page.evaluate(() => {
    const log = [];
    const push = (kind, value) => {
      log.push({ kind, value });
      if (log.length > 512) log.shift();
    };
    if (globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__) push('base', globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__);
    if (globalThis.__OTERYN_ATLAS_CREATURES__?.render) push('creature', globalThis.__OTERYN_ATLAS_CREATURES__.render);
    window.addEventListener('oteryn-atlas-render-committed', (event) => push('base', event.detail));
    window.addEventListener('oteryn-atlas-creature-render-committed', (event) => push('creature', event.detail));
    globalThis.__OTERYN_ATLAS_GEOMETRY_EVENT_LOG__ = log;
  });
}

export async function readGeometryEventLog(page) {
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_GEOMETRY_EVENT_LOG__ ?? []);
}


export async function waitForCreatureAlignedToBase(page, requireAnchors = false) {
  await page.waitForFunction((anchors) => {
    const base = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__;
    const creature = globalThis.__OTERYN_ATLAS_CREATURES__?.render;
    if (!base || !creature) return false;
    if (anchors && !creature.anchors?.length) return false;
    return creature.baseGenerationAtStart === base.generation
      && creature.baseGenerationAtCommit === base.generation
      && creature.view.floor === base.transform.floor
      && Math.abs(creature.view.x - base.transform.centerTileX) < 1e-9
      && Math.abs(creature.view.y - base.transform.centerTileY) < 1e-9
      && Math.abs(creature.view.zoom - base.transform.zoom) < 1e-9;
  }, requireAnchors, { timeout: 15_000 });
  return page.evaluate(() => ({
    base: globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__,
    creature: globalThis.__OTERYN_ATLAS_CREATURES__?.render ?? null,
  }));
}
