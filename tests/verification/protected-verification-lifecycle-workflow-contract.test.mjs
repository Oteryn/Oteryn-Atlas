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

test('base-advance workflow dispatch resolves current protected main instead of a stale PR base snapshot', () => {
  assert.match(controller, /branches\/main/, 'controller must read the current protected main identity');
  assert.doesNotMatch(controller, /base_sha:\s*pr\.base\.sha/, 'stale pull-request base SHA must not be semantic protected-base authority');
  assert.match(controller, /candidate_head_sha:\s*pr\.head\.sha/, 'candidate identity must remain bound to the live PR head');
});

test('protected controller derives browser semantic content from exact protected and candidate Git objects without executing candidate code', () => {
  assert.match(controller, /git ls-tree -r -z --full-tree "\$ATLAS_PROTECTED_BASE_SHA"/);
  assert.match(controller, /git ls-tree -r -z --full-tree "\$ATLAS_CANDIDATE_HEAD_SHA"/);
  assert.match(controller, /browser-semantic-content\.mjs/);
  assert.match(controller, /buildBrowserSemanticContentIdentity/);
  assert.match(controller, /browser-semantic-content-identity\.json/);
  assert.match(controller, /browserSemanticContentDigest:\s*browserSemanticContentIdentity\.browserSemanticContentDigest/);
  assert.equal(authorityPaths.has('tools/verification/browser-semantic-content.mjs'), true);
});

test('base-advance changed paths are captured without multiplexing pipeline stdin with the Node program', () => {
  assert.doesNotMatch(
    executor,
    /git -C protected-control diff --name-only[\s\S]*?\|\s*node --input-type=module - "\$changed" <<'NODE'/,
    'a heredoc consumes Node stdin, so git diff bytes cannot also feed that parser under pipefail',
  );
  assert.match(executor, /git -C protected-control diff --name-only[^\n]*> "\$changed_raw"/);
  assert.match(executor, /node --input-type=module - "\$changed_raw" "\$changed" <<'NODE'/);
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

test('executor restores the latest authoritative PR lifecycle state before candidate-SHA semantic compatibility is evaluated', () => {
  const restore = executor.split('      - name: Restore latest authoritative')[1]?.split('      - name: Decide active')[0] ?? '';
  assert.match(restore, /state_prefix="protected-verification-state-pr-\$PR_NUMBER-"/);
  assert.match(restore, /actions\/artifacts\?per_page=100/);
  assert.match(restore, /startsWith\(statePrefix\)/);
  assert.doesNotMatch(restore, /actions\/artifacts\?name=\$state_name/);
  assert.doesNotMatch(restore, /state\.candidateHeadSha !== candidateHeadSha/);
  assert.match(restore, /state\.prNumber !== Number\(prValue\)/);
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
});

test('zero-work fan-in permits no environment qualification while preserving exact state publication', () => {
  assert.match(executor, /lifecycle\.expectedEvidence\.length === 0/);
  assert.match(executor, /environmentQualification:\s*zeroWork\s*\?\s*null/);
  assert.match(executor, /qualificationFiles\.length !== \(zeroWork \? 0 : 1\)/);
  const fanInCondition = executor.split('  fan-in:')[1]?.split('    needs:')[0] ?? '';
  assert.doesNotMatch(fanInCondition, /hosted_count\s*!=\s*'0'/, 'zero-work fan-in must not be gated on hosted stable-ID count');
  assert.match(executor, /protected-hosted-fan-in-\$\{\{ needs\.preflight\.outputs\.protected_base_sha \}\}-\$\{\{ needs\.preflight\.outputs\.candidate_head_sha \}\}/);
});
