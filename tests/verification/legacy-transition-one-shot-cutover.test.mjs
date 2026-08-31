import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const REPOSITORY = 'Oteryn/Oteryn-Atlas';
const PR_NUMBER = 277;
const PROTECTED_BASE_SHA = 'f8de8e42ca57112cf71100aa19322ef22527b168';
const HEAD_REF = 'feat/issue-179-legacy-transition-qualifier';
const CANDIDATE_HEAD_SHA = 'cccccccccccccccccccccccccccccccccccccccc';
const WORKFLOW_PATH = '.github/workflows/legacy-molehill-transition-qualification.yml';

function livePr(overrides = {}) {
  return {
    number: PR_NUMBER,
    state: 'open',
    merged: false,
    base: { ref: 'main', sha: PROTECTED_BASE_SHA, repo: { full_name: REPOSITORY } },
    head: { ref: HEAD_REF, sha: CANDIDATE_HEAD_SHA, repo: { full_name: REPOSITORY } },
    ...overrides,
  };
}

function status(overrides = {}) {
  return {
    state: 'success',
    context: 'atlas-local-e2e',
    description: 'Local Docker Playwright 77 exact planned IDs PASS; visual review approved',
    target_url: `https://github.com/${REPOSITORY}/commit/${CANDIDATE_HEAD_SHA}`,
    creator: { login: 'github-actions[bot]' },
    ...overrides,
  };
}

function producerRun(overrides = {}) {
  return {
    id: 33430975592,
    run_attempt: 1,
    status: 'completed',
    conclusion: 'success',
    path: WORKFLOW_PATH,
    event: 'pull_request',
    head_branch: HEAD_REF,
    head_sha: CANDIDATE_HEAD_SHA,
    repository: { full_name: REPOSITORY },
    pull_requests: [{
      number: PR_NUMBER,
      head: { sha: CANDIDATE_HEAD_SHA, repo: { full_name: REPOSITORY } },
      base: { sha: PROTECTED_BASE_SHA, repo: { full_name: REPOSITORY } },
    }],
    ...overrides,
  };
}

function producerJobs(overrides = {}) {
  return {
    jobs: [
      { name: 'Capture exact-head legacy transition evidence', status: 'completed', conclusion: 'success' },
      { name: 'Publish reviewed atlas-local-e2e transition status', status: 'completed', conclusion: 'success' },
    ],
    ...overrides,
  };
}

test('one-shot legacy cutover requires exact protected producer identity', async () => {
  const moduleUrl = new URL('../../tools/verification/legacy-transition-cutover-gate.mjs', import.meta.url);
  assert.equal(fs.existsSync(moduleUrl), true, 'missing one-shot legacy cutover validator');
  const { validateLegacyTransitionCutoverGate } = await import(moduleUrl);
  assert.equal(typeof validateLegacyTransitionCutoverGate, 'function');

  const input = {
    status: status(),
    producerRun: producerRun(),
    producerJobs: producerJobs(),
    livePr: livePr(),
    expectedRepository: REPOSITORY,
    expectedPrNumber: PR_NUMBER,
    expectedCandidateHeadSha: CANDIDATE_HEAD_SHA,
    expectedProtectedBaseSha: PROTECTED_BASE_SHA,
    expectedHeadRef: HEAD_REF,
  };
  const result = validateLegacyTransitionCutoverGate(input);
  assert.equal(result.mode, 'legacy-transition-one-shot-cutover');
  assert.equal(result.producerRunId, 33430975592);
  assert.equal(result.producerRunAttempt, 1);

  assert.throws(
    () => validateLegacyTransitionCutoverGate({ ...input, expectedPrNumber: 278 }),
    /one-shot|PR/i,
  );
  assert.throws(
    () => validateLegacyTransitionCutoverGate({ ...input, expectedProtectedBaseSha: 'dddddddddddddddddddddddddddddddddddddddd' }),
    /one-shot|base/i,
  );
  assert.throws(
    () => validateLegacyTransitionCutoverGate({ ...input, expectedHeadRef: 'other-branch' }),
    /one-shot|head ref/i,
  );
  assert.throws(
    () => validateLegacyTransitionCutoverGate({ ...input, producerRun: producerRun({ run_attempt: 2 }) }),
    /attempt/i,
  );
  assert.throws(
    () => validateLegacyTransitionCutoverGate({ ...input, status: status({ creator: { login: 'blakinio' } }) }),
    /authoritative|creator/i,
  );
  assert.throws(
    () => validateLegacyTransitionCutoverGate({
      ...input,
      producerJobs: producerJobs({ jobs: [{ name: 'Capture exact-head legacy transition evidence', status: 'completed', conclusion: 'success' }] }),
    }),
    /publication|jobs|proof/i,
  );
});

test('CI accepts legacy cutover only through the exact one-shot validator', () => {
  const ci = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const browserStart = ci.indexOf('  verification-browser:\n');
  const gateStart = ci.indexOf('  atlas-gate:\n', browserStart);
  assert.notEqual(browserStart, -1, 'missing verification-browser job');
  assert.notEqual(gateStart, -1, 'missing atlas-gate job');
  const browserJob = ci.slice(browserStart, gateStart);

  assert.match(browserJob, /ATLAS_LEGACY_CUTOVER_PR_NUMBER:\s*['"]?277['"]?/);
  assert.match(browserJob, /ATLAS_LEGACY_CUTOVER_BASE_SHA:\s*f8de8e42ca57112cf71100aa19322ef22527b168/);
  assert.match(browserJob, /ATLAS_LEGACY_CUTOVER_HEAD_REF:\s*feat\/issue-179-legacy-transition-qualifier/);
  assert.match(browserJob, /ATLAS_HEAD_REF:\s*\$\{\{ github\.event\.pull_request\.head\.ref \}\}/);
  assert.match(browserJob, /validateLegacyTransitionCutoverGate/);
  assert.match(browserJob, /legacy-molehill-transition-qualification\.yml/);
  assert.match(browserJob, /actions\/runs/);
  assert.match(browserJob, /Capture exact-head legacy transition evidence/);
  assert.match(browserJob, /Publish reviewed atlas-local-e2e transition status/);
  assert.doesNotMatch(browserJob, /mode:\s*['"]legacy-cutover-exact-base-only['"]/);
});
