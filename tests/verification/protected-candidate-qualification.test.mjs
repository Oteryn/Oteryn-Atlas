import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { validateProtectedProductQualificationGate } from '../../tools/verification/protected-hosted-gate.mjs';

const SHA = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const RUN_ID = 12345;
const REPOSITORY = 'Oteryn/Oteryn-Atlas';
const WORKFLOW = '.github/workflows/protected-candidate-qualification.yml';
const JOB = 'Publish generic protected candidate qualification evidence';
const DESCRIPTION = 'Protected GitHub-hosted complete candidate qualification safety net';

function fixture(overrides = {}) {
  const livePr = {
    number: 317,
    state: 'open',
    merged: false,
    base: { ref: 'main', sha: BASE, repo: { full_name: REPOSITORY } },
    head: { ref: 'fix/verification-clean', sha: SHA, repo: { full_name: REPOSITORY } },
  };
  return {
    status: {
      state: 'success',
      context: 'atlas-protected-product-qualification',
      description: DESCRIPTION,
      target_url: `https://github.com/${REPOSITORY}/actions/runs/${RUN_ID}`,
      creator: { login: 'github-actions[bot]' },
    },
    producerRun: {
      id: RUN_ID,
      run_attempt: 1,
      status: 'completed',
      conclusion: 'success',
      path: WORKFLOW,
      event: 'pull_request_target',
      head_branch: 'main',
      head_sha: BASE,
      repository: { full_name: REPOSITORY },
      pull_requests: [{ number: 317, head: { sha: SHA, repo: { full_name: REPOSITORY } }, base: { sha: BASE, repo: { full_name: REPOSITORY } } }],
    },
    producerJobs: { jobs: [{ name: JOB, status: 'completed', conclusion: 'success' }] },
    livePr,
    expectedRepository: REPOSITORY,
    expectedPrNumber: 317,
    expectedCandidateHeadSha: SHA,
    expectedProtectedBaseSha: BASE,
    ...overrides,
  };
}

test('generic protected candidate qualification is independent of branch registry', () => {
  const result = validateProtectedProductQualificationGate(fixture());
  assert.equal(result.mode, 'protected-candidate-qualification');
  assert.equal(result.qualificationId, 'generic-candidate-qualification-v1');
  assert.equal(result.candidateHeadSha, SHA);
  assert.equal(result.protectedBaseSha, BASE);
});

test('generic candidate qualification remains exact-head and protected-run fail closed', () => {
  assert.throws(() => validateProtectedProductQualificationGate(fixture({
    producerRun: { ...fixture().producerRun, head_sha: 'c'.repeat(40) },
  })), /base|producer/i);
  assert.throws(() => validateProtectedProductQualificationGate(fixture({
    producerJobs: { jobs: [{ name: JOB, status: 'completed', conclusion: 'failure' }] },
  })), /proof job|successful/i);
  assert.throws(() => validateProtectedProductQualificationGate(fixture({
    status: { ...fixture().status, description: 'weaker proof' },
  })), /status|authoritative/i);
});

test('protected candidate qualification workflow is generic, sandboxed and complete', () => {
  assert.equal(fs.existsSync(WORKFLOW), true, 'generic protected candidate qualification workflow must exist');
  assert.equal(fs.existsSync('tools/verification/run-candidate-qualification-proof.sh'), true, 'shared candidate qualification proof runner must exist');
  const workflow = fs.readFileSync(WORKFLOW, 'utf8');
  const runner = fs.readFileSync('tools/verification/run-candidate-qualification-proof.sh', 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /Publish generic protected candidate qualification evidence/);
  assert.match(workflow, /atlas-protected-product-qualification/);
  assert.doesNotMatch(workflow, /issue-179|pull\/300|pull\/303|fix\/issue-/i);
  assert.match(runner, /--network none/);
  assert.match(runner, /--read-only/);
  assert.match(runner, /qualification-world\.mjs/);
  assert.match(runner, /protected-hosted-product-identities\.json/);
  assert.match(runner, /diff -u .*protected.*ids.*candidate.*ids/s);
  assert.match(runner, /--workers=1 --retries=0/);
  assert.doesNotMatch(runner, /real_fullworld|atlas-runners|oteryn-atlas-pc|synology/i);
});
