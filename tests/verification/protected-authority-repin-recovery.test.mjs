import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as protectedExecution from '../../tools/verification/protected-hosted-execution.mjs';
import * as protectedGate from '../../tools/verification/protected-hosted-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = path.join(ROOT, '.github/workflows/protected-execution-promotion-qualification.yml');
const REPOSITORY = 'Oteryn/Oteryn-Atlas';
const AUTHORITY_HEAD_REF = 'fix/issue-179-qualification-live-digest-authority';
const SOURCE_HEAD_REF = 'fix/issue-179-qualification-functional-fixture';
const OLD_DIGEST = 'sha256:2f457583f21cd3ebf8d995c1cc520ea099b277dace69453db08d568de7584613';
const NEW_DIGEST = 'sha256:c36ed503f8ada27a673ba96780b70cb361fa2fe2ce08240e372dbff664a2866a';
const sha = (character) => character.repeat(40);

function authorityGateFixture(overrides = {}) {
  const protectedBaseSha = sha('a');
  const candidateHeadSha = sha('c');
  const prNumber = 300;
  const runId = 12001;
  const livePr = {
    number: prNumber,
    state: 'open',
    merged: false,
    base: { ref: 'main', sha: protectedBaseSha, repo: { full_name: REPOSITORY } },
    head: { ref: AUTHORITY_HEAD_REF, sha: candidateHeadSha, repo: { full_name: REPOSITORY } },
  };
  const status = {
    state: 'success',
    context: 'atlas-protected-product-qualification',
    description: 'Protected GitHub-hosted qualification authority repin safety net',
    target_url: `https://github.com/${REPOSITORY}/actions/runs/${runId}`,
    creator: { login: 'github-actions[bot]' },
  };
  const producerRun = {
    id: runId,
    run_attempt: 1,
    path: '.github/workflows/protected-execution-promotion-qualification.yml',
    event: 'pull_request_target',
    status: 'completed',
    conclusion: 'success',
    head_branch: 'main',
    head_sha: protectedBaseSha,
    repository: { full_name: REPOSITORY },
    pull_requests: [{
      number: prNumber,
      head: { sha: candidateHeadSha, repo: { full_name: REPOSITORY } },
      base: { sha: protectedBaseSha, repo: { full_name: REPOSITORY } },
    }],
  };
  const producerJobs = {
    jobs: [{
      name: 'Publish protected qualification authority repin evidence',
      status: 'completed',
      conclusion: 'success',
    }],
  };
  return {
    status,
    producerRun,
    producerJobs,
    livePr,
    expectedRepository: REPOSITORY,
    expectedPrNumber: prNumber,
    expectedCandidateHeadSha: candidateHeadSha,
    expectedProtectedBaseSha: protectedBaseSha,
    ...overrides,
  };
}

test('authority-only qualification repin has an exact protected recovery contract', () => {
  assert.equal(typeof protectedExecution.resolveProtectedAuthorityRepinQualification, 'function');
  const spec = protectedExecution.resolveProtectedAuthorityRepinQualification(AUTHORITY_HEAD_REF);
  assert.deepEqual(spec, {
    id: 'qualification-live-digest-authority-v1',
    headRef: AUTHORITY_HEAD_REF,
    changedFiles: [
      'tests/verification/protected-hosted-execution.test.mjs',
      'tools/verification/protected-hosted-execution.mjs',
    ],
    sourceHeadRef: SOURCE_HEAD_REF,
    gateProof: {
      kind: 'complete-hosted-browser-authority-repin-v1',
      workflowPath: '.github/workflows/protected-execution-promotion-qualification.yml',
      event: 'pull_request_target',
      jobName: 'Publish protected qualification authority repin evidence',
      statusContext: 'atlas-protected-product-qualification',
      statusDescription: 'Protected GitHub-hosted qualification authority repin safety net',
    },
  });
  assert.equal(Object.isFrozen(spec), true);
  assert.equal(Object.isFrozen(spec.changedFiles), true);
  assert.equal(Object.isFrozen(spec.gateProof), true);
});

test('authority-only repin verifier accepts only the same digest literal replacement in authority and mirror test bytes', () => {
  assert.equal(typeof protectedExecution.validateProtectedAuthorityRepinSources, 'function');
  const trustedModuleSource = `before\nexpectedProductDigest: '${OLD_DIGEST}',\nafter\n`;
  const candidateModuleSource = `before\nexpectedProductDigest: '${NEW_DIGEST}',\nafter\n`;
  const trustedTestSource = `assert.equal(value, '${OLD_DIGEST}');\n`;
  const candidateTestSource = `assert.equal(value, '${NEW_DIGEST}');\n`;

  const result = protectedExecution.validateProtectedAuthorityRepinSources({
    authorityHeadRef: AUTHORITY_HEAD_REF,
    trustedModuleSource,
    candidateModuleSource,
    trustedTestSource,
    candidateTestSource,
  });
  assert.equal(result.sourceHeadRef, SOURCE_HEAD_REF);
  assert.equal(result.previousProductDigest, OLD_DIGEST);
  assert.equal(result.expectedProductDigest, NEW_DIGEST);

  assert.throws(() => protectedExecution.validateProtectedAuthorityRepinSources({
    authorityHeadRef: AUTHORITY_HEAD_REF,
    trustedModuleSource,
    candidateModuleSource: `${candidateModuleSource}// unrelated candidate mutation\n`,
    trustedTestSource,
    candidateTestSource,
  }), /digest-only|authority.*repin|byte/i);
});

test('hosted gate accepts only the protected complete-browser authority repin producer', () => {
  const result = protectedGate.validateProtectedProductQualificationGate(authorityGateFixture());
  assert.equal(result.status, 'success');
  assert.equal(result.mode, 'protected-authority-repin-qualification');
  assert.equal(result.qualificationId, 'qualification-live-digest-authority-v1');
  assert.equal(result.sourceHeadRef, SOURCE_HEAD_REF);
  assert.equal(result.producerRunAttempt, 1);

  const valid = authorityGateFixture();
  assert.throws(() => protectedGate.validateProtectedProductQualificationGate(authorityGateFixture({
    producerJobs: { jobs: [{ ...valid.producerJobs.jobs[0], conclusion: 'failure' }] },
  })), /proof job|successful/i);
  assert.throws(() => protectedGate.validateProtectedProductQualificationGate(authorityGateFixture({
    status: { ...valid.status, description: 'weaker authority proof' },
  })), /status|authoritative/i);
});

test('protected promotion workflow proves authority repin against its exact source PR without Molehill or FullWorld', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const job = workflow.split('  qualification-authority-repin:')[1]?.split('  qualification-functional-fixture:')[0] ?? '';
  assert.match(job, /fix\/issue-179-qualification-live-digest-authority/);
  assert.match(job, /runs-on:\s*ubuntu-24\.04/);
  assert.match(job, /resolveProtectedAuthorityRepinQualification/);
  assert.match(job, /validateProtectedAuthorityRepinSources/);
  assert.match(job, /fix\/issue-179-qualification-functional-fixture/);
  assert.match(job, /tests\/verification\/protected-hosted-execution\.test\.mjs/);
  assert.match(job, /tools\/verification\/protected-hosted-execution\.mjs/);
  assert.match(job, /pulls\?state=open/);
  assert.match(job, /parse-playwright-test-list\.mjs/);
  assert.match(job, /e2e\.full/);
  assert.match(job, /buildQualificationWorld/);
  assert.match(job, /qualificationTrustDescriptor/);
  assert.match(job, /compose\.protected-hosted-executor\.yml/);
  assert.match(job, /compose\.github-hosted\.yml/);
  assert.match(job, /--workers=1/);
  assert.match(job, /--retries=0/);
  assert.match(job, /--network none/);
  assert.match(job, /--read-only/);
  assert.match(job, /--cap-drop ALL/);
  assert.match(job, /assert-current-pr-head\.mjs/);
  assert.match(job, /statuses:\s*write/);
  assert.match(job, /context='atlas-protected-product-qualification'|context.*atlas-protected-product-qualification/s);
  assert.match(job, /Protected GitHub-hosted qualification authority repin safety net/);
  assert.doesNotMatch(job, /context='atlas-local-e2e'/);
  assert.doesNotMatch(job, /group:\s*atlas-runners|labels:\s*oteryn-atlas-pc|visual-review\.json|synology|real_fullworld/i);
});

test('one-shot stabilization bootstrap consumes exact protected legacy heavy proof rather than manual local status', () => {
  assert.equal(typeof protectedGate.validateLegacyTransitionBootstrapGate, 'function');
  const protectedBaseSha = 'e31015d0880e9f81a4b96f990658490af45e8fa6';
  const candidateHeadSha = sha('d');
  const prNumber = 303;
  const headRef = 'feat/issue-179-legacy-transition-qualifier';
  const livePr = {
    number: prNumber, state: 'open', merged: false,
    base: { ref: 'main', sha: protectedBaseSha, repo: { full_name: REPOSITORY } },
    head: { ref: headRef, sha: candidateHeadSha, repo: { full_name: REPOSITORY } },
  };
  const producerRun = {
    id: 13001, run_attempt: 1,
    path: '.github/workflows/legacy-molehill-transition-qualification.yml',
    event: 'pull_request', status: 'completed', conclusion: 'failure',
    head_branch: headRef, head_sha: candidateHeadSha,
    repository: { id: 1337995824, full_name: REPOSITORY },
    pull_requests: [{ number: prNumber,
      head: { ref: headRef, sha: candidateHeadSha, repo: { id: 1337995824, url: `https://api.github.com/repos/${REPOSITORY}`, name: 'Oteryn-Atlas' } },
      base: { ref: 'main', sha: protectedBaseSha, repo: { id: 1337995824, url: `https://api.github.com/repos/${REPOSITORY}`, name: 'Oteryn-Atlas' } },
    }],
  };
  const producerJobs = { jobs: [
    { name: 'Capture exact-head legacy transition evidence', status: 'completed', conclusion: 'success' },
    { name: 'Publish targeted protected-census compatibility evidence', status: 'completed', conclusion: 'skipped' },
    { name: 'Publish reviewed atlas-local-e2e transition status', status: 'completed', conclusion: 'failure' },
  ] };
  const result = protectedGate.validateLegacyTransitionBootstrapGate({
    producerRun, producerJobs, livePr,
    expectedRepository: REPOSITORY,
    expectedPrNumber: prNumber,
    expectedCandidateHeadSha: candidateHeadSha,
    expectedProtectedBaseSha: protectedBaseSha,
    changedFiles: [
      '.github/workflows/ci.yml',
      '.github/workflows/merge-authority-audit.yml',
      '.github/workflows/protected-execution-promotion-qualification.yml',
      'docs/migration/legacy-atlas-extraction-provenance.json',
      'tests/verification/ci-workflow-contract.test.mjs',
      'tests/verification/pr-browser-trust.test.mjs',
      'tests/verification/protected-anti-loop-workflow-integration.test.mjs',
      'tests/verification/protected-authority-repin-recovery.test.mjs',
      'tests/verification/selfhosted-compose-contract.test.mjs',
      'tools/verification/protected-hosted-execution.mjs',
      'tools/verification/protected-hosted-gate.mjs',
    ],
  });
  assert.equal(result.status, 'success');
  assert.equal(result.mode, 'legacy-transition-heavy-proof-exact-base-only');
  assert.equal(result.headRef, headRef);
  assert.equal(result.producerRunAttempt, 1);

  const mismatchedRepo = structuredClone(producerRun);
  mismatchedRepo.pull_requests[0].head.repo.id = 42;
  assert.throws(() => protectedGate.validateLegacyTransitionBootstrapGate({
    producerRun: mismatchedRepo, producerJobs, livePr,
    expectedRepository: REPOSITORY,
    expectedPrNumber: prNumber,
    expectedCandidateHeadSha: candidateHeadSha,
    expectedProtectedBaseSha: protectedBaseSha,
    changedFiles: [
      '.github/workflows/ci.yml',
      '.github/workflows/merge-authority-audit.yml',
      '.github/workflows/protected-execution-promotion-qualification.yml',
      'docs/migration/legacy-atlas-extraction-provenance.json',
      'tests/verification/ci-workflow-contract.test.mjs',
      'tests/verification/pr-browser-trust.test.mjs',
      'tests/verification/protected-anti-loop-workflow-integration.test.mjs',
      'tests/verification/protected-authority-repin-recovery.test.mjs',
      'tests/verification/selfhosted-compose-contract.test.mjs',
      'tools/verification/protected-hosted-execution.mjs',
      'tools/verification/protected-hosted-gate.mjs',
    ],
  }), /association mismatch/i);

  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const browserJob = ci.split('  verification-browser:')[1]?.split('  atlas-gate:')[0] ?? '';
  assert.match(browserJob, /ATLAS_LEGACY_CUTOVER_BASE_SHA:\s*e31015d0880e9f81a4b96f990658490af45e8fa6/);
  assert.match(browserJob, /ATLAS_LEGACY_CUTOVER_HEAD_REF:\s*feat\/issue-179-legacy-transition-qualifier/);
  assert.match(browserJob, /validateLegacyTransitionBootstrapGate/);
  assert.match(browserJob, /legacy-molehill-transition-qualification\.yml/);
  const cutover = browserJob.split('ATLAS_LEGACY_CUTOVER_BASE_SHA')[1]?.split('expected_name=')[0] ?? '';
  assert.doesNotMatch(cutover, /atlas-local-e2e/);
});
