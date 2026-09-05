import assert from 'node:assert/strict';
import test from 'node:test';
const sha = c => c.repeat(40);
const executionPlan = { semanticDigest: `sha256:${'f'.repeat(64)}`, requiredGroups: ['deterministic.core'], scenarioIds: ['geometry'], dataCapabilities: ['qualification_fixture'], profile: 'full', proofPurpose: 'candidate', evidenceKind: 'protected-candidate-v1', propertyObligations: [{stableId:'geometry',profile:'functional',properties:['geometry-preserved']}], hostedPartitions: [{ dataCapability: 'qualification_fixture', scenarioIds: ['geometry'] }], specialist: [], review: [] };
async function api() {
  const exports = await import('../../tools/verification/consume-protected-admission.mjs').catch(() => ({}));
  assert.equal(typeof exports.consumeProtectedAdmission, 'function', 'consumer must exist');
  return exports;
}
function fixture() {
  const repository = 'example/atlas', base = sha('a'), head = sha('b'), tree = sha('c');
  const pr = { number: 123, state: 'open', merged: false, changed_files: 1, head: { sha: head, repo: { full_name: repository } }, base: { sha: base, ref: 'trunk', repo: { full_name: repository } } };
  const calls = [];
  const state = { repository, base, head, tree, pr, runs: [], files: [{ filename: 'tools/verification/x.mjs', status: 'modified' }], associations: [pr], reads: 0 };
  const options = { repository, codeRevision: head, protectedBaseSha: base, prNumber: 123, now: '2026-09-05T12:10:00Z', authority: { executionPlan: structuredClone(executionPlan) }, scopeAdmission() { return { eligible: true }; }, async request(path) {
    calls.push(path);
    const route = path.split('?')[0];
    if (route === `/repos/${repository}`) return { full_name: repository, default_branch: 'trunk' };
    if (route === `/repos/${repository}/git/ref/heads/trunk`) return { object: { sha: state.base } };
    if (route === `/repos/${repository}/pulls/123`) { state.reads++; return structuredClone(state.pr); }
    if (route === `/repos/${repository}/pulls/123/files`) return state.files;
    if (route === `/repos/${repository}/commits/${head}` || route === `/repos/${repository}/commits/${sha('d')}`) return { commit: { tree: { sha: state.tree } } };
    if (route === `/repos/${repository}/commits/${sha('d')}/pulls`) return state.associations;
    if (route.endsWith('/actions/workflows/protected-admission.yml/runs')) return { workflow_runs: state.runs };
    throw new Error(`unexpected request ${path}`);
  }, async downloadEvidence() { throw new Error('unexpected artifact download'); } };
  return { options, state, calls };
}
test('no completed independent evidence returns false without trusting candidate status', async () => {
  const { consumeProtectedAdmission } = await api(); const { options } = fixture();
  assert.deepEqual(await consumeProtectedAdmission(options), { accepted: false, eligible: true, reason: 'missing-independent-evidence' });
});
test('complete changed files required even when evidence absent', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = fixture(); state.pr.changed_files = 2;
  await assert.rejects(consumeProtectedAdmission(options), /changed.file/i);
});
test('live protected base advancement rejects stale admission', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = fixture(); state.base = sha('f');
  await assert.rejects(consumeProtectedAdmission(options), /base/i);
});
test('candidate head movement rejects before locating evidence', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = fixture(); state.pr.head.sha = sha('f');
  await assert.rejects(consumeProtectedAdmission(options), /head/i);
});
test('MQ exact tree resolves PR without branch parsing', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, calls } = fixture(); delete options.prNumber; options.codeRevision = sha('d');
  assert.equal((await consumeProtectedAdmission(options)).accepted, false);
  assert(calls.some(p => p.includes(`/commits/${sha('d')}/pulls`)));
});
test('MQ rejects ambiguous PR association', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = fixture(); delete options.prNumber; options.codeRevision = sha('d'); state.associations.push({ ...state.pr, number: 124 });
  await assert.rejects(consumeProtectedAdmission(options), /association/i);
});
test('protected census covers every protected full safety net ID', async () => {
  const { protectedAdmissionScenarioIds } = await api();
  const catalog = { groups: { 'e2e.full': { specs: ['e2e/tests/test.mjs'], projects: ['desktop'] } } };
  assert.deepEqual(protectedAdmissionScenarioIds(catalog, ['desktop::e2e/tests/test.mjs::works']), ['desktop::e2e/tests/test.mjs::works']);
  assert.throws(() => protectedAdmissionScenarioIds(catalog, ['desktop::e2e/tests/other.mjs::works']), /census/i);
});
function successfulFixture() {
  const f = fixture(); const { options, state } = f;
  const workflow = '.github/workflows/protected-admission.yml';
  const digest = d => `sha256:${d.repeat(64)}`;
  const run = { id: 55, run_attempt: 1, path: workflow, event: 'pull_request_target', head_sha: state.base, status: 'completed', conclusion: 'success', repository: { id: 7, full_name: state.repository }, created_at: '2026-09-05T12:00:00Z', updated_at: '2026-09-05T12:06:00Z', pull_requests: [{ number: 123, head: { sha: state.head, repo: { id: 7 } }, base: { sha: state.base, repo: { id: 7 } } }] };
  const job = { id: 66, run_id: 55, run_attempt: 1, head_sha: state.base, name: 'Protected admission proof', status: 'completed', conclusion: 'success', started_at: '2026-09-05T12:01:00Z', completed_at: '2026-09-05T12:06:00Z' };
  state.runs = [run];
  options.authority = { executionPlan: structuredClone(executionPlan), requiredGroups: ['deterministic.core'], requiredScenarioIds: ['geometry'], oracleDigest: digest('d'), maxAgeMs: 3600000 };
  f.evidence = { schemaVersion: 1, kind: 'protected-admission', candidate: { repository: state.repository, prNumber: 123, headSha: state.head, baseSha: state.base, treeSha: state.tree, changedFiles: [{ path: state.files[0].filename, status: 'modified' }] }, producer: { workflowPath: workflow, event: 'pull_request_target', runId: 55, jobId: 66, runAttempt: 1, sourceSha: state.base }, createdAt: '2026-09-05T12:05:00Z', proof: { plan: structuredClone(executionPlan), deterministic: { groups: ['deterministic.core'], result: 'PASS' }, browser: { scenarioResults: [{ id: 'geometry', result: 'PASS' }], workers: 1, retries: 0, dataCapability: 'qualification_fixture', oracleDigest: digest('d'), productDigest: digest('e') } } };
  const b=f.evidence.proof.browser; b.partitions=[{...b}];
  const original = options.request;
  options.request = async route => {
    if (route.split('?')[0].endsWith('/actions/runs/55')) return structuredClone(run);
    if (route.includes('/actions/runs/55/attempts/1/jobs')) return { jobs: [job] };
    if (route.includes('/actions/runs/55/artifacts')) return { artifacts: [{ id: 77, name: 'protected-admission-evidence-55-1', expired: false }] };
    return original(route);
  };
  options.downloadEvidence = async id => { assert.equal(id, 77); return f.evidence; };
  return f;
}
test('successful PR consumes exact independent artifact and performs final reread', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = successfulFixture();
  const result = await consumeProtectedAdmission(options);
  assert.equal(result.accepted, true); assert.equal(state.reads, 2);
  assert.equal(result.evidence.candidate.headSha, state.head);
});
test('successful MQ consumes same evidence contract for exact candidate tree', async () => {
  const { consumeProtectedAdmission } = await api(); const { options } = successfulFixture(); delete options.prNumber; options.codeRevision = sha('d');
  assert.equal((await consumeProtectedAdmission(options)).accepted, true);
});
test('artifact from another candidate fails closed instead of ordinary fallback', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, evidence } = successfulFixture(); evidence.candidate.headSha = sha('f');
  await assert.rejects(consumeProtectedAdmission(options), /candidate/i);
});
test('head change while downloading evidence fails final reread', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state, evidence } = successfulFixture();
  options.downloadEvidence = async () => { state.pr.head.sha = sha('f'); return evidence; };
  await assert.rejects(consumeProtectedAdmission(options), /head/i);
});
test('newest failed run cannot be hidden by older successful evidence', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = successfulFixture(); state.runs.push({ ...state.runs[0], id: 99, conclusion: 'failure' });
  await assert.rejects(consumeProtectedAdmission(options), /failed/i);
});
test('new producer run during download invalidates older evidence', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state, evidence } = successfulFixture();
  options.downloadEvidence = async () => { state.runs.push({ ...state.runs[0], id: 99, status: 'in_progress', conclusion: null }); return evidence; };
  await assert.rejects(consumeProtectedAdmission(options), /latest producer/i);
});
test('MQ resolves unique exact tree through complete open PR fallback when synthetic association is empty', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = successfulFixture();
  delete options.prNumber; options.codeRevision = sha('d'); state.associations = [];
  const original = options.request;
  options.request = route => route.split('?')[0] === `/repos/${state.repository}/pulls` ? Promise.resolve([state.pr]) : original(route);
  assert.equal((await consumeProtectedAdmission(options)).accepted, true);
});
test('MQ fallback rejects two PRs with the same exact tree', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = successfulFixture();
  delete options.prNumber; options.codeRevision = sha('d'); state.associations = [];
  const original = options.request;
  options.request = route => route.split('?')[0] === `/repos/${state.repository}/pulls` ? Promise.resolve([state.pr, { ...state.pr, number: 124 }]) : original(route);
  await assert.rejects(consumeProtectedAdmission(options), /association/i);
});
test('MQ uses ordinary full path when candidate tree differs from queue tree', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = successfulFixture();
  delete options.prNumber; options.codeRevision = sha('d');
  const original = options.request;
  options.request = route => route.split('?')[0] === `/repos/${state.repository}/commits/${state.head}` ? Promise.resolve({ commit: { tree: { sha: sha('f') } } }) : original(route);
  assert.deepEqual(await consumeProtectedAdmission(options), { accepted: false, eligible: false, reason: 'missing-exact-tree-association' });
});
test('MQ fallback follows pagination before selecting the unique exact tree', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state } = successfulFixture();
  delete options.prNumber; options.codeRevision = sha('d'); state.associations = [];
  const original = options.request; const pages = [];
  options.request = route => {
    if (route.split('?')[0] === `/repos/${state.repository}/pulls`) {
      const page = Number(new URL(route, 'https://api.github.com').searchParams.get('page')); pages.push(page);
      return Promise.resolve(page === 1 ? Array.from({ length: 100 }, (_, i) => ({ number: 1000 + i, state: 'closed' })) : [state.pr]);
    }
    return original(route);
  };
  assert.equal((await consumeProtectedAdmission(options)).accepted, true); assert.deepEqual(pages, [1, 2]);
});

test('ordinary docs PR falls back before unrelated failed admission producer lookup', async () => {
  const { consumeProtectedAdmission } = await api(); const { options, state, calls } = successfulFixture();
  state.files = [{ filename: 'docs/guide.md', status: 'modified' }]; state.runs[0].conclusion = 'failure';
  options.scopeAdmission = candidate => {
    assert.equal(candidate.changedFiles[0].path, 'docs/guide.md');
    const error = new TypeError('outside protected admission scope'); error.code = 'ADMISSION_SCOPE_INELIGIBLE'; throw error;
  };
  assert.deepEqual(await consumeProtectedAdmission(options), { accepted: false, eligible: false, reason: 'scope-ineligible' });
  assert(!calls.some(route => route.includes('/actions/workflows/')));
});
test('unsafe scope errors remain fatal rather than falling back', async () => {
  const { consumeProtectedAdmission } = await api(); const { options } = fixture();
  options.scopeAdmission = () => { throw new TypeError('unsafe changed-file identity'); };
  await assert.rejects(consumeProtectedAdmission(options), /unsafe/);
});

test('consumer derives semantic requirements independently instead of accepting artifact plan', async () => {
  const { consumeProtectedAdmission } = await api(); const { options } = successfulFixture();
  options.executionPlan = candidate => { assert.equal(candidate.headSha, options.codeRevision); return { ...executionPlan, scenarioIds: ['geometry', 'interaction'], propertyObligations: [...executionPlan.propertyObligations,{stableId:'interaction',profile:'functional',properties:['interaction-preserved']}] }; };
  await assert.rejects(consumeProtectedAdmission(options), /semantic plan/i);
});
for (const mode of ['PR', 'MQ']) test(`${mode} consumes browserless ordinary evidence with exact protected plan`, async () => {
  const { consumeProtectedAdmission } = await api(); const { options, evidence } = successfulFixture();
  const plan = { ...executionPlan, scenarioIds: [], requiredGroups: [] , dataCapabilities: [], profile: 'none', propertyObligations: [], hostedPartitions: [] };
  evidence.proof.browser.partitions=[];
  options.executionPlan = () => structuredClone(plan); evidence.proof.plan = structuredClone(plan);
  evidence.proof.deterministic.groups = [];
  Object.assign(evidence.proof.browser, { scenarioResults: [], dataCapability: null, productDigest: null });
  if (mode === 'MQ') { delete options.prNumber; options.codeRevision = sha('d'); }
  assert.equal((await consumeProtectedAdmission(options)).accepted, true);
});
test('consumer accepts protected dispatch for exact candidate with empty associations',async()=>{
 const {consumeProtectedAdmission}=await api();const {options,state,evidence}=successfulFixture();const run=state.runs[0];run.event=evidence.producer.event='workflow_dispatch';run.pull_requests=[];run.display_title=`protected-admission:${state.repository}:123:${state.head}:${state.base}`;
 assert.equal((await consumeProtectedAdmission(options)).accepted,true);
});
test('newer exact dispatch pending prevents reuse of older pull-request evidence',async()=>{
 const {consumeProtectedAdmission}=await api();const {options,state}=successfulFixture();state.runs.push({...state.runs[0],id:99,event:'workflow_dispatch',pull_requests:[],status:'in_progress',conclusion:null,display_title:`protected-admission:${state.repository}:123:${state.head}:${state.base}`});
 assert.deepEqual(await consumeProtectedAdmission(options),{accepted:false,eligible:true,reason:'missing-independent-evidence'});
});
test('dispatch for another PR cannot shadow exact candidate producer',async()=>{
 const {consumeProtectedAdmission}=await api();const {options,state}=successfulFixture();state.runs.push({...state.runs[0],id:99,event:'workflow_dispatch',pull_requests:[],status:'in_progress',conclusion:null,display_title:`protected-admission:${state.repository}:124:${state.head}:${state.base}`});
 assert.equal((await consumeProtectedAdmission(options)).accepted,true);
});
