import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProtectedBootstrapPlan } from '../../tools/verification/protected-controller-bootstrap.mjs';

const protectedBaseSha = 'a'.repeat(40);
const candidateHeadSha = 'b'.repeat(40);
const mergeBaseSha = 'c'.repeat(40);
const stableTestIds = [
  'desktop-chromium::e2e/tests/desktop.spec.mjs::desktop FullWorld qualifies',
  'mobile-chromium::e2e/tests/mobile.spec.mjs::mobile FullWorld exposes drawers',
];

function build(overrides = {}) {
  return buildProtectedBootstrapPlan({
    repository: 'Oteryn/Oteryn-Atlas',
    prNumber: 206,
    protectedBaseSha,
    candidateHeadSha,
    mergeBaseSha,
    changedFiles: [{ path: 'src/browser/app.mjs' }],
    stableTestIds,
    ...overrides,
  });
}

test('bootstrap controller is authoritative full-safe and binds exact protected-base census', () => {
  const plan = build();
  assert.equal(plan.controller.id, 'atlas-protected-controller-bootstrap-v1');
  assert.equal(plan.controller.sourceSha, protectedBaseSha);
  assert.equal(plan.profile, 'full');
  assert.equal(plan.selectiveExecution, false);
  assert.equal(plan.retryPolicy.retries, 0);
  assert.deepEqual(plan.requiredGroupIds, ['deterministic.core', 'e2e.full']);
  assert.deepEqual(plan.stableTestIds, [...stableTestIds].sort());
  assert.match(plan.expectedStableTestIdsDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(plan.planDigest, /^sha256:[a-f0-9]{64}$/);
});

test('bootstrap controller cannot be narrowed by candidate policy because candidate policy is not an input', () => {
  const plan = build({ changedFiles: [{ path: 'docs/readme.md' }] });
  assert.equal(plan.profile, 'full');
  assert.equal(plan.selectiveExecution, false);
  assert.deepEqual(plan.stableTestIds, [...stableTestIds].sort());
});

test('bootstrap controller preserves rename source and destination evidence', () => {
  const plan = build({ changedFiles: [{ path: 'src/browser/new.mjs', previousPath: 'tools/verification/old.mjs' }] });
  assert.deepEqual(plan.changedPaths, ['src/browser/new.mjs', 'tools/verification/old.mjs']);
  assert.match(plan.changedPathsDigest, /^sha256:[a-f0-9]{64}$/);
});

test('bootstrap controller fails closed on malformed identity, changed-file evidence and census', () => {
  assert.throws(() => build({ candidateHeadSha: 'not-a-sha' }), /candidateHeadSha/);
  assert.throws(() => build({ changedFiles: [] }), /changedFiles/);
  assert.throws(() => build({ changedFiles: [{ path: '../escape' }] }), /changedFiles/);
  assert.throws(() => build({ stableTestIds: [] }), /stableTestIds/);
  assert.throws(() => build({ stableTestIds: [stableTestIds[0], stableTestIds[0]] }), /stableTestIds/);
});
