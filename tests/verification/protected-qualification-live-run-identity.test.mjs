import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProtectedProductQualificationGate } from '../../tools/verification/protected-hosted-gate.mjs';

const REPOSITORY = 'Oteryn/Oteryn-Atlas';
const REPOSITORY_ID = 1337995824;
const protectedBaseSha = 'a'.repeat(40);
const candidateHeadSha = 'c'.repeat(40);
const prNumber = 321;
const runId = 33878936456;

function input() {
  const branch = 'fix/issue-315-functional-qualification-world';
  return {
    expectedRepository: REPOSITORY,
    expectedPrNumber: prNumber,
    expectedCandidateHeadSha: candidateHeadSha,
    expectedProtectedBaseSha: protectedBaseSha,
    livePr: {
      number: prNumber,
      state: 'open',
      merged: false,
      base: { ref: 'main', sha: protectedBaseSha, repo: { id: REPOSITORY_ID, full_name: REPOSITORY } },
      head: { ref: branch, sha: candidateHeadSha, repo: { id: REPOSITORY_ID, full_name: REPOSITORY } },
    },
    status: {
      state: 'success',
      context: 'atlas-protected-product-qualification',
      description: 'Protected GitHub-hosted qualification repair safety net',
      target_url: `https://github.com/${REPOSITORY}/actions/runs/${runId}`,
      creator: { login: 'github-actions[bot]' },
    },
    producerRun: {
      id: runId,
      run_attempt: 1,
      path: '.github/workflows/protected-qualification-repair.yml',
      event: 'pull_request_target',
      status: 'completed',
      conclusion: 'success',
      head_branch: branch,
      head_sha: candidateHeadSha,
      repository: { id: REPOSITORY_ID, full_name: REPOSITORY },
      pull_requests: [{
        number: prNumber,
        head: { sha: candidateHeadSha, repo: { id: REPOSITORY_ID, name: 'Oteryn-Atlas' } },
        base: { sha: protectedBaseSha, repo: { id: REPOSITORY_ID, name: 'Oteryn-Atlas' } },
      }],
    },
    producerJobs: {
      jobs: [{ name: 'Protected qualification repair', status: 'completed', conclusion: 'success' }],
    },
  };
}

test('accepts the exact GitHub workflow-run PR association shape published by qualification repair', () => {
  const result = validateProtectedProductQualificationGate(input());
  assert.equal(result.status, 'success');
  assert.equal(result.candidateHeadSha, candidateHeadSha);
});

test('rejects a qualification run associated with a different repository ID', () => {
  const invalid = input();
  invalid.producerRun.pull_requests[0].head.repo.id += 1;
  assert.throws(() => validateProtectedProductQualificationGate(invalid), /association|repository/i);
});
