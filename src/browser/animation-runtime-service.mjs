import { loadAnimationRuntime } from './animation-runtime.mjs';
import { ancillarySourceExpectations, resolveFullWorldTrust } from './fullworld-trust.mjs';

let shared = null;
let sharedBase = null;

export function getAnimationRuntime(baseUrl, fetcher = fetch) {
  const base = new URL(baseUrl).href;
  if (sharedBase != null && sharedBase !== base) throw new Error('animation runtime base changed after initialization');
  if (shared == null) {
    sharedBase = base;
    const expectedSource = ancillarySourceExpectations(resolveFullWorldTrust()).animation;
    shared = loadAnimationRuntime(new URL(base), fetcher, expectedSource).catch((error) => {
      shared = null;
      sharedBase = null;
      throw error;
    });
  }
  return shared;
}
