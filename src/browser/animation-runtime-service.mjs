import { loadAnimationRuntime, PRODUCTION_ANIMATION_SOURCE } from './animation-runtime.mjs';

let shared = null;
let sharedIdentity = null;

function runtimeIdentity(base, expectedSource) {
  return `${base}\n${expectedSource.gameSha ?? ''}\n${expectedSource.appearanceProductRoot ?? ''}\n${expectedSource.outfitSpatialProductRoot ?? ''}`;
}

export function getAnimationRuntime(baseUrl, fetcher = fetch, expectedSource = undefined) {
  const base = new URL(baseUrl).href;
  const normalizedExpectedSource = expectedSource ?? PRODUCTION_ANIMATION_SOURCE;
  const identity = runtimeIdentity(base, normalizedExpectedSource);
  if (sharedIdentity != null && sharedIdentity !== identity) {
    throw new Error('animation runtime identity changed after initialization');
  }
  if (shared == null) {
    sharedIdentity = identity;
    shared = loadAnimationRuntime(new URL(base), fetcher, normalizedExpectedSource).catch((error) => {
      shared = null;
      sharedIdentity = null;
      throw error;
    });
  }
  return shared;
}
