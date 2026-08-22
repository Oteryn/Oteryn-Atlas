import { loadAnimationRuntime } from './animation-runtime.mjs';

let shared = null;
let sharedBase = null;

export function getAnimationRuntime(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl).href;
  if (sharedBase != null && sharedBase !== base) throw new Error('animation runtime base changed after initialization');
  if (shared == null) {
    sharedBase = base;
    shared = loadAnimationRuntime(new URL(base), fetcher).catch((error) => {
      shared = null;
      sharedBase = null;
      throw error;
    });
  }
  return shared;
}
