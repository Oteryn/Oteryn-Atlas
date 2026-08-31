import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n');
const controller = read('.github/workflows/protected-verification-controller.yml');
const executor = read('.github/workflows/protected-hosted-executor.yml');
const ci = read('.github/workflows/ci.yml');
const gate = read('tools/verification/protected-hosted-gate.mjs');
const authority = JSON.parse(read('tools/verification/verification-authority-manifest.json'));
const authorityPaths = new Set(authority.components.map(({ path }) => path));

test('main advances actively dispatch bounded compatibility evaluation for every open main PR', () => {
  const dispatcherPath = new URL('../../.github/workflows/protected-base-advance-dispatcher.yml', import.meta.url);
  assert.equal(fs.existsSync(dispatcherPath), true);
  const dispatcher = fs.readFileSync(dispatcherPath, 'utf8').replace(/\r\n/g, '\n');
  assert.match(dispatcher, /push:[\s\S]*branches:\s*\[main\]/);
  assert.match(dispatcher, /actions:\s*write/);
  assert.match(dispatcher, /pull-requests:\s*read/);
  assert.match(dispatcher, /state=open[^\n]*base=main/);
  assert.match(dispatcher, /protected-verification-controller\.yml/);
  assert.match(dispatcher, /pr_number/);
  assert.match(controller, /workflow_dispatch:[\s\S]*pr_number:/);
  assert.match(controller, /Resolve exact PR lifecycle identity/);
  assert.match(controller, /pulls\/\$ATLAS_REQUESTED_PR_NUMBER/);
});

test('executor makes lifecycle decisions before expensive work and persists a stable exact-candidate state artifact', () => {
  assert.match(executor, /protected-verification-workflow\.mjs/);
  assert.match(executor, /decideProtectedWorkflowLifecycle/);
  assert.match(executor, /materializeProtectedWorkflowReuse/);
  assert.match(executor, /protected-verification-state-pr-/);
  assert.match(executor, /previous-protected-verification-state\.json/);
  assert.match(executor, /execute_environment/);
  assert.match(executor, /execute_hosted/);
  assert.match(executor, /heavy_executions_required/);
  assert.match(executor, /needs\.preflight\.outputs\.execute_environment == 'true'/);
  assert.match(executor, /needs\.preflight\.outputs\.execute_hosted == 'true'/);
  assert.match(executor, /reuse-evidence:/);
  assert.match(executor, /reuseEvidenceIds/);
});

test('executed and reused evidence use schema v2 and converge through one exact fan-in validator', () => {
  assert.match(executor, /evidenceSemanticDigest/);
  assert.match(executor, /evidenceSemanticDigests/);
  assert.match(executor, /buildProtectedWorkflowSuccessState/);
  assert.match(executor, /disposition.*EXECUTED|EXECUTED.*disposition/);
  assert.match(executor, /materializeProtectedWorkflowReuse/);
  assert.match(ci, /validateProtectedHostedGate/);
  assert.match(gate, /evidenceSemanticDigest/);
  assert.match(gate, /validateEvidenceManifest/);
});

test('workflow failures feed canonical ownership and progress circuit breakers instead of candidate mutation', () => {
  assert.match(executor, /buildProtectedWorkflowFailureState/);
  assert.match(executor, /failure_ownership=environment/);
  assert.match(executor, /failure_ownership=product/);
  assert.match(executor, /failure_ownership=candidate/);
  assert.match(executor, /failure_ownership=authority/);
  assert.match(executor, /failure_ownership=external/);
  assert.match(executor, /failure-summary\.json/);
  assert.match(executor, /candidateMutationAllowed/);
  assert.match(executor, /nextAttemptAllowed/);
  assert.match(executor, /circuitBreaker/);
});

test('protected authority cannot be promoted by candidate-controlled executor code', () => {
  assert.doesNotMatch(executor, /^  pull_request:/m);
  assert.doesNotMatch(executor, /atlas-protected-authority-promotion|authority_promotion|buildProtectedAuthorityPromotionPlan/);
  assert.doesNotMatch(gate, /atlas-protected-authority-promotion|authorityPromotion|PROMOTION_LABEL/);
});

test('authority closure includes the active lifecycle and base-advance dispatcher', () => {
  assert.equal(authorityPaths.has('tools/verification/protected-verification-lifecycle.mjs'), true);
  assert.equal(authorityPaths.has('.github/workflows/protected-base-advance-dispatcher.yml'), true);
});test('zero-work fan-in permits no environment qualification while preserving exact state publication', () => {
  assert.match(executor, /lifecycle\.expectedEvidence\.length === 0/);
  assert.match(executor, /environmentQualification:\s*zeroWork\s*\?\s*null/);
  assert.match(executor, /qualificationFiles\.length !== \(zeroWork \? 0 : 1\)/);
  assert.match(executor, /protected-hosted-fan-in-\$\{\{ needs\.preflight\.outputs\.protected_base_sha \}\}-\$\{\{ needs\.preflight\.outputs\.candidate_head_sha \}\}/);
});
