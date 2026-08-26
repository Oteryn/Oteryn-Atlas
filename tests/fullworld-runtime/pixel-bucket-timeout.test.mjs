import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadVerifiedPixelBucket,
  loadVerifiedPixelBundle,
} from '../../src/browser/fullworld-pixel-buckets.mjs';
import { sha256ContentId } from '../../src/browser/loader.mjs';

function abortAwareNever(_url, { signal } = {}) {
  return new Promise((_, reject) => {
    const abort = () => reject(signal?.reason ?? Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}

async function settleWithin(promise, timeoutMs = 100) {
  return Promise.race([
    promise.then(
      (value) => ({ kind: 'resolved', value }),
      (error) => ({ kind: 'rejected', error }),
    ),
    new Promise((resolve) => setTimeout(() => resolve({ kind: 'pending' }), timeoutMs)),
  ]);
}

test('runtime pixel bucket and local-max fetches fail closed on a stalled network request', async () => {
  const raw = new Uint8Array([1, 2, 3, 4]);
  const contentId = await sha256ContentId(raw);
  const descriptor = {
    bucket: '99', bytes: raw.byteLength, contentId, identityAuthority: false,
    path: 'buckets/99.rgba', sha256: contentId.slice(7),
  };
  const bundle = {
    bytes: raw.byteLength, contentId, identityAuthority: false,
    path: 'local-max/all-pixels.rgba', sha256: contentId.slice(7),
  };
  const catalog = {
    baseUrl: new URL('https://atlas.example/runtime-pixels/'),
    buckets: new Map([['99', descriptor]]),
    manifest: { localMaxBundle: bundle },
  };

  for (const load of [
    () => loadVerifiedPixelBucket(catalog, '99', abortAwareNever, { timeoutMs: 25 }),
    () => loadVerifiedPixelBundle(catalog, abortAwareNever, { timeoutMs: 25 }),
  ]) {
    const outcome = await settleWithin(load());
    assert.equal(outcome.kind, 'rejected', 'stalled authenticated pixel fetch must not remain pending');
    assert.match(outcome.error.message, /fetch timed out after 25ms/);
  }
});
