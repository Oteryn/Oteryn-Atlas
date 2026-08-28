import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const controller = fs.readFileSync(new URL('../../.github/workflows/protected-verification-controller.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const executor = fs.readFileSync(new URL('../../.github/workflows/protected-hosted-executor.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const compose = fs.readFileSync(new URL('../../e2e/compose.protected-hosted-executor.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function occurrences(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

test('protected controller obtains candidate census only inside a no-network no-secret read-only sandbox', () => {
  assert.match(controller, /pull_request_target:/);
  assert.match(controller, /refs\/pull\/\$ATLAS_PR_NUMBER\/head/);
  assert.match(controller, /rev-parse FETCH_HEAD/);
  assert.match(controller, /git\s+(?:-C\s+\S+\s+)?worktree\s+add\s+--detach/);
  assert.match(controller, /--network\s+none/);
  assert.match(controller, /--read-only/);
  assert.match(controller, /--cap-drop(?:=|\s+)ALL/);
  assert.match(controller, /no-new-privileges/);
  assert.match(controller, /candidate-census/i);
  assert.match(controller, /parse-playwright-test-list\.mjs/);
  assert.match(controller, /protected-hosted-plan\.mjs/);
  assert.match(controller, /git\s+show[^\n]*tools\/verification\/impact-manifest\.json/);
  assert.match(controller, /git\s+show[^\n]*tools\/verification\/verification-catalog\.json/);
  assert.match(controller, /git diff --check "\$merge_base_sha" "\$ATLAS_CANDIDATE_HEAD_SHA"/);
  assert.match(controller, /assert-current-pr-head\.mjs/);
  assert.match(controller, /cancel-in-progress:\s*true/);
  assert.doesNotMatch(controller, /atlas-local-e2e|192\.168\.|molehill|synology/i);
});

test('hosted executor consumes a published protected plan under read-only GitHub permissions', () => {
  assert.match(executor, /name:\s*Protected Hosted Verification Executor/);
  assert.match(executor, /workflow_run:/);
  assert.match(executor, /Protected Verification Controller/);
  assert.match(executor, /runs-on:\s*ubuntu-24\.04/);
  assert.match(executor, /contents:\s*read/);
  assert.match(executor, /actions:\s*read/);
  assert.match(executor, /pull-requests:\s*read/);
  assert.match(executor, /protected-verification-plan/);
  assert.match(executor, /protected-hosted-execution\.mjs/);
  assert.match(executor, /e2e\/compose\.github-hosted\.yml/);
  assert.match(executor, /protected-hosted-fan-in\.mjs/);
  assert.match(executor, /expectedStableTestIds:\s*execution\.hosted\.stableTestIds/);
  assert.match(executor, /expectedStableTestIdsDigest:\s*execution\.hostedExpectedStableTestIdsDigest/);
  assert.doesNotMatch(executor, /const hostedPlan = \{ \.\.\.plan/);
  assert.ok(occurrences(executor, /assert-current-pr-head\.mjs/g) >= 2, 'executor must fence the PR head before expensive execution and before fan-in');
  assert.match(executor, /cancel-in-progress:\s*true/);
  assert.doesNotMatch(executor, /pull_request_target:|atlas-local-e2e|192\.168\.|molehill|synology|secrets:/i);
});

test('pre-merge hosted proof bootstraps from pull_request isolation and self-disables once protected', () => {
  assert.match(executor, /pull_request:\n\s+types:\s*\[opened, synchronize, reopened\]/);
  assert.match(executor, /github\.event_name\s*==\s*'pull_request'/);
  assert.match(executor, /PROTECTED_BASE_SHA/);
  assert.match(executor, /contents\/\.github\/workflows\/protected-hosted-executor\.yml\?ref=\$PROTECTED_BASE_SHA/);
  assert.match(executor, /actions\/workflows\/protected-verification-controller\.yml\/runs\?event=pull_request_target/);
  assert.match(executor, /controller_run_id/);
  assert.match(executor, /bootstrap_active=false/);
});

test('hosted artifact downloads bind the repository explicitly outside git worktrees', () => {
  assert.ok(
    occurrences(executor, /gh run download[^\n]*--repo "\$GITHUB_REPOSITORY"/g) >= 3,
    'every hosted artifact download must pass --repo because the workspace root is not a Git checkout',
  );
});

test('Phase D hosted execution stays packed until Phase E calibrates sharding', () => {
  assert.match(executor, /matrix:\n\s+include:\n\s+- shard:\s*1\n\s+index:\s*0/);
  assert.doesNotMatch(executor, /- shard:\s*2/);
  assert.match(executor, /ATLAS_E2E_WORKERS:\s*'1'/);
  assert.match(executor, /ATLAS_E2E_SHARD:\s*\$\{\{ matrix\.shard \}\}\/1/);
});

test('protected-base test implementations and candidate additions execute from separate capability-scoped contexts', () => {
  assert.match(executor, /test-lists\/\$dataCapability\/protected\.txt/);
  assert.match(executor, /test-lists\/\$dataCapability\/candidate-additions\.txt/);
  assert.match(executor, /--placement protected/);
  assert.match(executor, /--placement candidate-additions/);
  assert.match(executor, /--data-capability "\$dataCapability"/);
  assert.match(executor, /protected-execution-context/);
  assert.match(executor, /candidate-additions-execution-context/);
  assert.match(executor, /rm -rf "\$protected_context\/e2e"/);
  assert.match(executor, /cp -a protected-control\/e2e "\$protected_context\/e2e"/);
  assert.match(executor, /placement: \$placement, dataCapability: \$dataCapability, summaryPath: \$summaryPath/);
  assert.match(executor, /--source-manifest/);
  assert.doesNotMatch(executor, /--additional-summary/);
});

test('candidate browser execution and hosted publication share one internal default network with no host IPC', () => {
  assert.match(compose, /networks:\n\s+default:\n\s+internal:\s*true/);
  assert.doesNotMatch(compose, /atlas-e2e-internal/);
  assert.match(compose, /--test-list=\/run\/atlas-protected-test-list\.txt/);
  assert.match(compose, /--retries=0/);
  assert.doesNotMatch(compose, /ipc:\s*host|network_mode:\s*host/);
});

test('executor candidate census mounts protected dependencies outside the read-only candidate tree', () => {
  assert.match(executor, /test ! -e "\$candidate_dir\/e2e\/node_modules"/);
  assert.match(executor, /ln -s \/protected-e2e-node-modules\/node_modules "\$candidate_dir\/e2e\/node_modules"/);
  assert.match(executor, /dst=\/protected-e2e-node-modules\/node_modules,readonly/);
  assert.match(executor, /ATLAS_ARTIFACTS_DIR=\/tmp\/artifacts/);
  assert.doesNotMatch(executor, /dst=\/candidate\/e2e\/node_modules,readonly/);
});

test('hosted executor atomically readies exact protected products before Compose serves them', () => {
  assert.match(executor, /protected-control\/tools\/verification\/publication-readiness\.mjs/);
  assert.match(executor, /publishReadyPublication/);
  assert.match(executor, /producerRunId:\s*`\$\{process\.env\.GITHUB_RUN_ID\}-\$\{process\.env\.GITHUB_RUN_ATTEMPT\}`/);
  assert.match(executor, /harnessDigest/);
  assert.match(executor, /sourceRoot/);
  assert.match(executor, /publicationRoot/);
  assert.match(executor, /readinessPath/);
  assert.match(executor, /ATLAS_QUALIFICATION_PUBLICATION_HOST="\$publication_root"/);
  assert.doesNotMatch(executor, /ATLAS_QUALIFICATION_PUBLICATION_HOST="\$product_root"/);
});
