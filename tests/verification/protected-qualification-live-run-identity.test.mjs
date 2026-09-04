import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProtectedProductQualificationGate } from '../../tools/verification/protected-hosted-gate.mjs';

const REPOSITORY = 'Oteryn/Oteryn-Atlas';
const protectedBaseSha = 'a'.repeat(40);
const candidateHeadSha = 'c'.repeat(40);
const prNumber = 321;
const runId = 33875049574;

test('accepts the live GitHub pull_request_target run identity published by qualification repair', () => {
  const branch = 'fix/issue-315-functional-qualification-world';
  const result = validateProtectedProductQualificationGate({
    expectedRepository: REPOSITORY,
    expectedPrNumber: prNumber,
    expectedCandidateHeadSha: candidateHeadSha,
    expectedProtectedBaseSha: protectedBaseSha,
    livePr: {
      number: prNumber,
      state: 'open',
      merged: false,
      base: { ref: 'main', sha: protectedBaseSha, repo: { full_name: REPOSITORY } },
      head: { ref: branch, sha: candidateHeadSha, repo: { full_name: REPOSITORY } },
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
      repository: { full_name: REPOSITORY },
      pull_requests: [{
        number: prNumber,
        head: { sha: candidateHeadSha, repo: { full_name: REPOSITORY } },
        base: { sha: protectedBaseSha, repo: { full_name: REPOSITORY } },
      }],
    },
    producerJobs: {
      jobs: [{ name: 'Protected qualification repair', status: 'completed', conclusion: 'success' }],
    },
  });

  assert.equal(result.status, 'success');
  assert.equal(result.candidateHeadSha, candidateHeadSha);
});
