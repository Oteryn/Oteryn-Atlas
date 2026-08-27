import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const app = fs.readFileSync(new URL('web/fullworld-app.mjs', root), 'utf8');
const creatures = fs.readFileSync(new URL('web/fullworld-creatures.mjs', root), 'utf8');
const service = fs.readFileSync(new URL('src/browser/animation-runtime-service.mjs', root), 'utf8');

test('browser animation consumers derive source expectations from FullWorld trust', () => {
  for (const source of [app, creatures]) {
    assert.match(source, /ancillarySourceExpectations\(FULLWORLD_TRUST\)/);
    assert.match(source, /getAnimationRuntime\([^;]*\.animation/s);
  }
});

test('shared animation runtime cache binds source expectation identity as well as base URL', () => {
  assert.match(service, /expectedSource/);
  assert.match(service, /sharedSourceKey/);
  assert.match(service, /animation runtime source expectations changed after initialization/);
  assert.match(service, /loadAnimationRuntime\([^;]*expectedSource/s);
});
