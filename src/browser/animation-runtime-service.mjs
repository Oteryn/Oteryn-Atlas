import { loadAnimationRuntime } from './animation-runtime.mjs';

let shared = null;
let sharedIdentity = null;

function runtimeIdentity(base, expectedSource) {
  if (expectedSource == null) return `${base}\nproduction-default`;
  return `${base}\n${expectedSource.gameSha ?? ''}\n${expectedSource.appearanceProductRoot ?? ''}\n${expectedSource.outfitSpatialProductRoot ?? ''}`;
}

export function getAnimationRuntime(baseUrl, fetcher = fetch, expectedSource = undefined) {
  const base = new URL(baseUrl).href;
  const identity = runtimeIdentity(base, expectedSource);
  if (sharedIdentity != null && sharedIdentity !== identity) {
    throw new Error('animation runtime identity changed after initialization');
  }
  if (shared == null) {
    sharedIdentity = identity;
    shared = loadAnimationRuntime(new URL(base), fetcher, expectedSource).catch((error) => {
      shared = null;
      sharedIdentity = null;
      throw error;
    });
  }
  return shared;
}
