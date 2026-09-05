import assert from 'node:assert/strict';
import test from 'node:test';

const sha = (digit) => digit.repeat(40);
const digest = (digit) => `sha256:${digit.repeat(64)}`;
function fixture() {
  const candidate = { repository: 'example/atlas', prNumber: 17, headSha: sha('a'), baseSha: sha('b'), treeSha: sha('c'), changedFiles: [{ path: 'tools/verification/repair.mjs', status: 'modified' }] };
  const authority = { protectedBaseSha: candidate.baseSha, expectedRunId: 123, expectedJobId: 456, workflowPath: '.github/workflows/protected-admission.yml', event: 'pull_request_target', jobName: 'Independent admission proof', evidenceKind: 'protected-admission', requiredGroups: ['deterministic.core'], requiredScenarioIds: ['geometry', 'interaction'], oracleDigest: digest('d'), maxAgeMs: 3600000 };
  return {
    authority, currentCandidate: candidate, now: '2026-09-05T12:10:00Z',
    evidence: { schemaVersion: 1, kind: authority.evidenceKind, candidate: structuredClone(candidate), producer: { workflowPath: authority.workflowPath, event: authority.event, runId: 123, jobId: 456, runAttempt: 1, sourceSha: candidate.baseSha }, createdAt: '2026-09-05T12:05:00Z', proof: { deterministic: { groups: ['deterministic.core'], result: 'PASS' }, browser: { scenarioResults: [{ id: 'geometry', result: 'PASS' }, { id: 'interaction', result: 'PASS' }], workers: 1, retries: 0, dataCapability: 'qualification_fixture', oracleDigest: authority.oracleDigest, productDigest: digest('e') } } },
    producerRun: { id: 123, run_attempt: 1, path: authority.workflowPath, event: authority.event, head_sha: candidate.baseSha, status: 'completed', conclusion: 'success', repository: { id: 99, full_name: candidate.repository }, created_at: '2026-09-05T12:00:00Z', updated_at: '2026-09-05T12:06:00Z', pull_requests: [{ number: candidate.prNumber, head: { sha: candidate.headSha, repo: { id: 99 } }, base: { sha: candidate.baseSha, repo: { id: 99 } } }] },
    producerJobs: { jobs: [{ id: 456, run_id: 123, run_attempt: 1, head_sha: candidate.baseSha, name: authority.jobName, status: 'completed', conclusion: 'success', started_at: '2026-09-05T12:01:00Z', completed_at: '2026-09-05T12:06:00Z' }] },
  };
}
async function validator() {
  const exports = await import('../../tools/verification/protected-admission-evidence.mjs').catch(() => ({}));
  assert.equal(typeof exports.validateProtectedAdmissionEvidence, 'function', 'protected admission validator must exist');
  return exports.validateProtectedAdmissionEvidence;
}
test('valid exact candidate is accepted using independently fetched producer metadata', async () => {
  const validate = await validator();
  assert.equal(validate(fixture()).status, 'success');
});
const negativeCases = {
  'wrong repository': x => { x.evidence.candidate.repository = 'foreign/atlas'; },
  'wrong PR': x => { x.evidence.candidate.prNumber++; },
  'wrong head': x => { x.evidence.candidate.headSha = sha('f'); },
  'wrong base': x => { x.evidence.candidate.baseSha = sha('f'); },
  'changed file drift': x => { x.currentCandidate.changedFiles.push({ path: 'extra.mjs', status: 'added' }); },
  'changed file status drift': x => { x.currentCandidate.changedFiles[0].status = 'removed'; },
  'rename provenance drift': x => { x.evidence.candidate.changedFiles[0] = { path: 'new.mjs', status: 'renamed', previousPath: 'old.mjs' }; x.currentCandidate.changedFiles[0] = { path: 'new.mjs', status: 'renamed', previousPath: 'different.mjs' }; },
  'tree drift': x => { x.currentCandidate.treeSha = sha('f'); },
  'stale run': x => { x.now = '2026-09-05T14:00:00Z'; },
  'wrong workflow producer': x => { x.producerRun.path = '.github/workflows/candidate.yml'; },
  'wrong job': x => { x.producerJobs.jobs[0].id++; },
  'wrong attempt': x => { x.producerRun.run_attempt++; },
  'retried producer': x => { x.evidence.producer.runAttempt = x.producerRun.run_attempt = x.producerJobs.jobs[0].run_attempt = 2; },
  'missing evidence': x => { delete x.evidence; },
  'incomplete census': x => { x.evidence.proof.browser.scenarioResults.pop(); },
  'duplicate census': x => { x.evidence.proof.browser.scenarioResults[1] = x.evidence.proof.browser.scenarioResults[0]; },
  'failed scenario': x => { x.evidence.proof.browser.scenarioResults[0].result = 'FAIL'; },
  'skipped scenario': x => { x.evidence.proof.browser.scenarioResults[0].result = 'SKIP'; },
  'missing deterministic evidence': x => { x.evidence.proof.deterministic.groups = []; },
  'failed deterministic proof': x => { x.evidence.proof.deterministic.result = 'FAIL'; },
  'oracle substitution': x => { x.evidence.proof.browser.oracleDigest = digest('f'); },
  'workers lower bound alteration': x => { x.evidence.proof.browser.workers = 2; },
  'retries weakening': x => { x.evidence.proof.browser.retries = 1; },
  'FullWorld substitution': x => { x.evidence.proof.browser.dataCapability = 'real_fullworld'; },
  'candidate self authorization': x => { x.evidence.authority = x.authority; },
  'candidate defined census': x => { x.evidence.proof.browser.requiredScenarioIds = ['geometry']; },
  'branch specific admission': x => { x.evidence.candidate.branch = 'allowed-branch'; },
  'PR specific admission': x => { x.evidence.allowedPrNumbers = [17]; },
  'another candidate run': x => { x.producerRun.pull_requests[0].head.sha = sha('f'); },
  'wrong associated PR': x => { x.producerRun.pull_requests[0].number++; },
  'foreign associated repository': x => { x.producerRun.pull_requests[0].head.repo.id++; },
  'candidate workflow source': x => { x.evidence.producer.sourceSha = x.currentCandidate.headSha; },
  'unrelated producer run head': x => { x.producerRun.head_sha = sha('f'); },
  'wrong event': x => { x.producerRun.event = 'pull_request'; },
  'missing job attempt': x => { delete x.producerJobs.jobs[0].run_attempt; },
  'job from another run': x => { x.producerJobs.jobs[0].run_id++; },
  'unsuccessful run': x => { x.producerRun.conclusion = 'failure'; },
  'unsuccessful job': x => { x.producerJobs.jobs[0].conclusion = 'failure'; },
  'future evidence': x => { x.evidence.createdAt = '2026-09-06T12:00:00Z'; },
  'evidence predates run': x => { x.evidence.createdAt = '2026-09-05T11:59:00Z'; },
  'evidence after job completion': x => { x.evidence.createdAt = '2026-09-05T12:07:00Z'; },
  'invalid product identity': x => { x.evidence.proof.browser.productDigest = 'anything'; },
};
for (const [name, mutate] of Object.entries(negativeCases)) test(`${name} rejects`, async () => {
  const validate = await validator(); const input = fixture(); mutate(input); assert.throws(() => validate(input), TypeError);
});
test('admission is independent of PR number and repository name', async () => {
  const validate = await validator(); const input = fixture();
  input.currentCandidate.repository = input.evidence.candidate.repository = input.producerRun.repository.full_name = 'another/project';
  input.currentCandidate.prNumber = input.evidence.candidate.prNumber = input.producerRun.pull_requests[0].number = 923;
  assert.equal(validate(input).status, 'success');
});

test('pull_request_target candidate-head metadata retains exact association and protected source binding', async () => {
  const validate = await validator(); const input = fixture(); input.producerRun.head_sha = input.currentCandidate.headSha; input.producerJobs.jobs[0].head_sha = input.currentCandidate.headSha; assert.equal(validate(input).status, 'success');
});
