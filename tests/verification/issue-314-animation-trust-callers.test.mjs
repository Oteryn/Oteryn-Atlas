import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const appSource = fs.readFileSync(path.join(ROOT, 'web/fullworld-app.mjs'), 'utf8');
const creatureSource = fs.readFileSync(path.join(ROOT, 'web/fullworld-creatures.mjs'), 'utf8');

function assertTrustAwareAnimationCaller(source, label) {
  assert.match(source, /ancillarySourceExpectations\(FULLWORLD_TRUST\)/, `${label} must derive ancillary authority from active FullWorld trust`);
  assert.match(source, /getAnimationRuntime\([\s\S]*?fetch,\s*[A-Z_]+\.animation,\s*\)/, `${label} must key the shared animation runtime with the trust-bound animation source`);
}

test('F3: every shared FullWorld animation singleton caller uses the active trust-bound animation identity', () => {
  assertTrustAwareAnimationCaller(appSource, 'fullworld app');
  assertTrustAwareAnimationCaller(creatureSource, 'creature overlay');
});
