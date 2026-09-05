import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const moduleURL = new URL('../../tools/verification/run-protected-admission.mjs', import.meta.url);
async function producer() { assert.ok(fs.existsSync(fileURLToPath(moduleURL)), 'protected producer implementation must exist'); return import(moduleURL); }
const candidate={repository:'owner/repo',prNumber:7,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'web/fullworld-app.mjs',status:'modified'}]};
test('publication fence rejects every exact identity drift', async()=>{const {assertSameCandidate}=await producer();assert.doesNotThrow(()=>assertSameCandidate(candidate,structuredClone(candidate)));for(const key of ['repository','prNumber','headSha','baseSha','treeSha','changedFiles']) {const changed=structuredClone(candidate);changed[key]=key==='changedFiles'?[]:key==='prNumber'?8:'drift';assert.throws(()=>assertSameCandidate(candidate,changed),/candidate changed/);}});
test('browser proof requires complete unique protected census, exact head, and zero retries',async()=>{const {validateBrowserSummary}=await producer();const summary={status:'passed',metadata:{expectedRevision:candidate.headSha,workers:1},scenarios:[{project:'desktop',specPath:'e2e/tests/a.mjs',scenario:'one',stableTestId:'desktop::e2e/tests/a.mjs::one',status:'passed',retry:0}]};assert.doesNotThrow(()=>validateBrowserSummary(summary,['desktop::e2e/tests/a.mjs::one'],candidate.headSha));for(const changed of [{...summary,scenarios:[]},{...summary,scenarios:[...summary.scenarios,...summary.scenarios]},{...summary,metadata:{...summary.metadata,workers:2}},{...summary,scenarios:[{...summary.scenarios[0],retry:1}]},{...summary,scenarios:[{...summary.scenarios[0],status:'skipped'}]},{...summary,metadata:{...summary.metadata,expectedRevision:'d'.repeat(40)}}])assert.throws(()=>validateBrowserSummary(changed,['desktop::e2e/tests/a.mjs::one'],candidate.headSha));});
test('candidate sandbox contains no token, network, mutable input or privileged capability',async()=>{const {candidateSandboxArgs}=await producer();const args=candidateSandboxArgs({source:'/input',output:'/output',script:'/build.mjs'});assert.ok(args.includes('none'));assert.ok(args.includes('--read-only'));assert.ok(args.includes('ALL'));assert.ok(args.includes('no-new-privileges'));assert.ok(args.some(x=>x==='type=bind,src=/input,dst=/candidate,readonly'));assert.ok(!args.some(x=>/TOKEN|GITHUB|docker.sock/.test(x)));});
test('census follows all protected full specs without historical numeric census shortcut',async()=>{const {resolveProtectedBrowserCensus}=await producer();const catalog={groups:{'e2e.full':{specs:['e2e/tests/a.spec.mjs','e2e/tests/b.spec.mjs']}}};const list='  [desktop] › a.spec.mjs:1:1 › one\n  [mobile] › b.spec.mjs:2:1 › two\n  [other] › excluded.spec.mjs:1:1 › excluded';const result=resolveProtectedBrowserCensus(list,catalog);assert.equal(result.scenarioIds.length,2);assert.match(result.testList,/one/);assert.match(result.testList,/two/);assert.doesNotMatch(result.testList,/excluded/);assert.throws(()=>resolveProtectedBrowserCensus('',catalog));assert.throws(()=>resolveProtectedBrowserCensus(list+'\n'+list,catalog));});
test('protected producer workflow has no candidate-authority execution or manual green status',async()=>{const workflow=fs.readFileSync(new URL('../../.github/workflows/protected-admission.yml',import.meta.url),'utf8');assert.match(workflow,/pull_request_target:/);assert.match(workflow,/node trusted-base\/tools\/verification\/run-protected-admission.mjs/);assert.doesNotMatch(workflow,/statuses: write|checks: write|workflow_dispatch:|node candidate\//);assert.match(workflow,/protected-admission-evidence-\$\{\{ github.run_id \}\}-1/);});
test('publication identity and qualification mode are generic protected environment inputs',()=>{const compose=fs.readFileSync(new URL('../../e2e/compose.github-hosted.yml',import.meta.url),'utf8');assert.match(compose,/repository: process.env.GITHUB_REPOSITORY/);assert.match(compose,/ATLAS_E2E_DATA_CAPABILITY: \$\{ATLAS_E2E_DATA_CAPABILITY:-qualification_fixture\}/);});
test('ordinary scope produces neutral admission while malformed authority still fails closed', async () => {
  const { classifyAdmission } = await producer();
  assert.equal(typeof classifyAdmission, 'function', 'protected admission needs narrow scope classification');
  const admission = {eligible:true};
  assert.equal(await classifyAdmission(()=>admission), admission);
  assert.deepEqual(await classifyAdmission(()=>{throw Object.assign(new TypeError('ordinary scope'),{code:'ADMISSION_SCOPE_INELIGIBLE'});}), {eligible:false});
  for (const code of ['WRONG_HEAD','WRONG_BASE',undefined]) {
    await assert.rejects(classifyAdmission(()=>{throw Object.assign(new TypeError('invalid authority'),{code});}), /invalid authority/);
  }
});
test('independent double-build proof rejects divergent product digests',async()=>{
  const {validateDeterministicProduct}=await producer();assert.equal(typeof validateDeterministicProduct,'function');
  const digest='sha256:'+'a'.repeat(64);assert.doesNotThrow(()=>validateDeterministicProduct(digest,digest));
  assert.throws(()=>validateDeterministicProduct(digest,'sha256:'+'b'.repeat(64)),/determinism/);
});
test('identity mirror accepts only independently verified digest substitution',async()=>{
 const {validateProductIdentityMirror}=await producer();assert.equal(typeof validateProductIdentityMirror,'function');
 const old='sha256:'+'a'.repeat(64), next='sha256:'+'b'.repeat(64), source=`assert.equal(product.digest, '${old}');`;
 assert.doesNotThrow(()=>validateProductIdentityMirror(source,source.replace(old,next),old,next));
 assert.throws(()=>validateProductIdentityMirror(source,'// bypass',old,next),/mirror/);
});
test('independent deterministic sandbox mounts protected tests over exact candidate code',async()=>{
 const {candidateSandboxArgs}=await producer();const args=candidateSandboxArgs({source:'/candidate-tree',output:'/proof',script:'/test.mjs',protectedTests:'/protected/tests'});
 assert.ok(args.includes('type=bind,src=/protected/tests,dst=/candidate/tests,readonly'));
 assert.ok(args.includes('type=bind,src=/candidate-tree,dst=/candidate,readonly'));
});
test('deterministic census comes from every protected CI selected path without evaluating shell', async()=>{
 const { resolveProtectedDeterministicPatterns }=await producer();assert.equal(typeof resolveProtectedDeterministicPatterns,'function');
 const ci=fs.readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8');const patterns=resolveProtectedDeterministicPatterns(ci);
 assert.ok(patterns.includes('tests/animation-runtime.mjs'));assert.ok(patterns.includes('tests/properties/*.test.mjs'));assert.ok(patterns.includes('tests/verification/*.test.mjs'));assert.equal(patterns.length,23);
 assert.throws(()=>resolveProtectedDeterministicPatterns('files=( $(curl malicious) )'),/deterministic/);
 assert.throws(()=>resolveProtectedDeterministicPatterns('files=( ../../escape.mjs )'),/deterministic/);
 assert.throws(()=>resolveProtectedDeterministicPatterns('files=( tests/a.mjs )\nfiles=( tests/b.mjs )'),/deterministic/);
});
