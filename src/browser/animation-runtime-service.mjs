import { loadAnimationRuntime } from './animation-runtime.mjs';

let shared = null;
let sharedBase = null;
let sharedSourceKey = null;

export function getAnimationRuntime(baseUrl, fetcher = fetch, expectedSource = undefined) {
  const base = new URL(baseUrl).href;
  const sourceKey = JSON.stringify(expectedSource ?? null);
  if (sharedBase != null && sharedBase !== base) throw new Error('animation runtime base changed after initialization');
  if (sharedSourceKey != null && sharedSourceKey !== sourceKey) throw new Error('animation runtime source expectations changed after initialization');
  if (shared == null) {
    sharedBase = base;
    sharedSourceKey = sourceKey;
    shared = loadAnimationRuntime(new URL(base), fetcher, expectedSource).catch((error) => {
      shared = null;
      sharedBase = null;
      sharedSourceKey = null;
      throw error;
    });
  }
  return shared;
}
