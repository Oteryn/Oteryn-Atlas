export async function installHeldRangeRequests(page, { limit = 4 } = {}) {
  const state = { held: [], seen: [], released: [], waiters: [], releasedAll: false };
  const routeHandler = async (route, request) => {
    const range = request.headers()['range'];
    if (!range || state.releasedAll || state.held.length >= limit) return route.continue();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const entry = { index: state.held.length, url: request.url(), range, release, route };
    state.held.push(entry);
    state.seen.push({ index: entry.index, url: entry.url, range: entry.range });
    for (const waiter of state.waiters.splice(0)) waiter();
    await gate;
    state.released.push(entry.index);
    try { await route.continue(); } catch (error) {
      if (!/already handled|Target page, context or browser has been closed|Request is already handled/i.test(error?.message ?? '')) throw error;
    }
  };
  await page.route('**/*', routeHandler);
  return {
    async waitForHeld(count) {
      if (state.held.length >= count) return state.seen.slice(0, count);
      let timeout;
      try {
        await Promise.race([
          new Promise((resolve) => {
            const check = () => {
              if (state.held.length >= count) resolve();
              else state.waiters.push(check);
            };
            state.waiters.push(check);
          }),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error(`expected ${count} held Range requests, observed ${state.held.length}: ${JSON.stringify(state.seen)}`)), 30_000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
      }
      return state.seen.slice(0, count);
    },
    release(index) {
      const entry = state.held[index];
      if (!entry) throw new Error(`held request ${index} does not exist`);
      entry.release();
    },
    releaseAll() { state.releasedAll = true; for (const entry of state.held) entry.release(); },
    evidence() { return { seen: [...state.seen], released: [...state.released] }; },
    async dispose() { this.releaseAll(); await page.unroute('**/*', routeHandler); },
  };
}

export async function committedRenderer(page) {
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__);
}

export async function waitForCommittedView(page, expected, afterGeneration = 0) {
  await page.waitForFunction(({ expected, after }) => {
    const value = globalThis.__OTERYN_ATLAS_RENDERER_DIAGNOSTICS__;
    const transform = value?.transform;
    return value?.generation > after
      && transform?.floor === expected.floor
      && Math.abs(transform.centerTileX - expected.x) < 1e-9
      && Math.abs(transform.centerTileY - expected.y) < 1e-9
      && Math.abs(transform.zoom - expected.zoom) < 1e-9;
  }, { expected, after: afterGeneration }, { timeout: 30_000 });
  return committedRenderer(page);
}

export async function waitForQualifiedView(page, expected) {
  await page.waitForFunction((wanted) => {
    const result = globalThis.__OTERYN_ATLAS_FULLWORLD__;
    const view = result?.view;
    return result?.status === 'PASS'
      && view?.floor === wanted.floor
      && Math.abs(view.x - wanted.x) < 1e-9
      && Math.abs(view.y - wanted.y) < 1e-9
      && Math.abs(view.zoom - wanted.zoom) < 1e-9;
  }, expected, { timeout: 90_000 });
  return page.evaluate(() => globalThis.__OTERYN_ATLAS_FULLWORLD__);
}
export function viewFromUrl(url) {
  const value = new URL(url);
  return {
    x: Number(value.searchParams.get('x')),
    y: Number(value.searchParams.get('y')),
    floor: Number(value.searchParams.get('floor')),
    zoom: Number(value.searchParams.get('zoom')),
  };
}
