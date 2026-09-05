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
test('protected producer workflow has no candidate-authority execution or manual green status',async()=>{const workflow=fs.readFileSync(new URL('../../.github/workflows/protected-admission.yml',import.meta.url),'utf8');assert.match(workflow,/pull_request_target:/);assert.match(workflow,/node trusted-base\/tools\/verification\/run-protected-admission.mjs/);assert.doesNotMatch(workflow,/statuses: write|checks: write|node candidate\//);assert.match(workflow,/protected-admission-evidence-\$\{\{ github.run_id \}\}-1/);});
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
test('selected browser census preserves protected IDs and rejects absent or duplicate selections', async()=>{
 const {selectProtectedBrowserCensus}=await producer();assert.equal(typeof selectProtectedBrowserCensus,'function');
 const census={scenarioIds:['one','two'],testList:'first\nsecond\n'};
 assert.deepEqual(selectProtectedBrowserCensus(census,['one','two']),census);
 assert.deepEqual(selectProtectedBrowserCensus(census,['two']),{scenarioIds:['two'],testList:'second\n'});
 assert.deepEqual(selectProtectedBrowserCensus(census,[]),{scenarioIds:[],testList:''});
 assert.throws(()=>selectProtectedBrowserCensus(census,['missing']),/selection/);
 assert.throws(()=>selectProtectedBrowserCensus(census,['one','one']),/selection/);
});
test('shared proof rejects unsupported capabilities and preserves browserless deterministic metadata',async()=>{
 const {validateExecutionPlan}=await producer();
 const base={scenarioIds:[],capabilities:[],workers:1,retries:0,hostedPartitions:[],specialist:[],review:[]};
 assert.doesNotThrow(()=>validateExecutionPlan(base));
 assert.doesNotThrow(()=>validateExecutionPlan({...base,capabilities:['qualification_fixture']}));
 assert.throws(()=>validateExecutionPlan({...base,capabilities:['real_fullworld']}),/capability/);
 assert.throws(()=>validateExecutionPlan({...base,workers:2}),/execution/);
});
test('hosted execution partitions preserve independent bounded and qualification obligations',async()=>{
 const {validateExecutionPlan}=await producer();
 const plan={workers:1,retries:0,scenarioIds:['one','two'],capabilities:['bounded_real_world','qualification_fixture'],hostedPartitions:[{dataCapability:'qualification_fixture',scenarioIds:['one']},{dataCapability:'bounded_real_world',scenarioIds:['two']}],specialist:[],review:[]};
 assert.doesNotThrow(()=>validateExecutionPlan(plan));
 assert.throws(()=>validateExecutionPlan({...plan,hostedPartitions:[plan.hostedPartitions[0]]}),/partition/);
 assert.throws(()=>validateExecutionPlan({...plan,hostedPartitions:[...plan.hostedPartitions,plan.hostedPartitions[0]]}),/partition/);
 assert.throws(()=>validateExecutionPlan({...plan,review:[{groupIds:['visual.creatures'],scenarioIds:['one']}]}),/independent/);
 assert.throws(()=>validateExecutionPlan({...plan,specialist:[{groupIds:['fullworld.animation-census'],scenarioIds:['one']}]}),/independent/);
});
test('complete catalog inventory includes bounded IDs but respects declared project',async()=>{
 const {resolveProtectedBrowserInventory}=await producer();assert.equal(typeof resolveProtectedBrowserInventory,'function');
 const catalog={groups:{full:{specs:['e2e/tests/a.spec.mjs'],projects:['desktop']},bounded:{specs:['e2e/tests/b.spec.mjs'],projects:['mobile']}}};
 const list='[desktop] › a.spec.mjs:1:1 › one\n[mobile] › b.spec.mjs:2:1 › two\n[desktop] › b.spec.mjs:2:1 › excluded';
 const result=resolveProtectedBrowserInventory(list,catalog);assert.equal(result.scenarioIds.length,2);assert.doesNotMatch(result.testList,/excluded/);
});
test('parent census rejects exit-zero import that skips protected assertions', async()=>{
 const {collectDeterministicCensus,validateDeterministicCensus}=await producer();assert.equal(typeof collectDeterministicCensus,'function');
 const os=await import('node:os'),path=await import('node:path');const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-parent-census-'));
 try{
  const file=path.join(root,'contract.test.mjs'),dependency=path.join(root,'candidate.mjs');
  fs.writeFileSync(file,"import './candidate.mjs';import test from 'node:test';import assert from 'node:assert/strict';test('protected assertion',()=>assert.equal(1,1));");
  fs.writeFileSync(dependency,'export const value=1;');
  const parent=path.join(root,'parent.mjs');fs.writeFileSync(parent,`import {collectDeterministicCensus} from ${JSON.stringify(moduleURL.href)};process.stdout.write(JSON.stringify(await collectDeterministicCensus([${JSON.stringify(file)}],${JSON.stringify(root)})));`);
  const {execFileSync}=await import('node:child_process');const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const collect=()=>JSON.parse(execFileSync(process.execPath,[parent],{encoding:'utf8',env}));
  const expected=collect();
  assert.doesNotThrow(()=>validateDeterministicCensus(expected,collect()));
  fs.writeFileSync(dependency,'process.exit(0);');
  const actual=collect();
  assert.throws(()=>validateDeterministicCensus(expected,actual),/census/);
  fs.writeFileSync(file,"import assert from 'node:assert/strict';assert.equal(1,1);");
  const bare=collect();assert.doesNotThrow(()=>validateDeterministicCensus(bare,collect()));
  fs.writeFileSync(file,"import test from 'node:test';test.skip('protected skipped',()=>{});");
  assert.throws(()=>collect());
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('producer events and GitHub snapshot associations are exact and fail closed',async()=>{
 const {validateProducerEvent,validateProducerSnapshotAssociation}=await producer();assert.equal(typeof validateProducerEvent,'function');assert.equal(typeof validateProducerSnapshotAssociation,'function');
 for(const event of ['pull_request_target','workflow_dispatch'])assert.equal(validateProducerEvent(event),event);
 for(const event of ['pull_request','merge_group','push','workflow_run',undefined])assert.throws(()=>validateProducerEvent(event),/event/);
 const repo={full_name:'owner/repo',default_branch:'main'},pr={number:7,state:'open',head:{sha:'a'.repeat(40),repo:{full_name:'owner/repo'}},base:{sha:'b'.repeat(40),ref:'main',repo:{full_name:'owner/repo'}}},base={ref:'refs/heads/main',object:{sha:'b'.repeat(40)}},commit={sha:'a'.repeat(40),tree:{sha:'c'.repeat(40)}};
 const valid={repository:'owner/repo',prNumber:7,repo,pr,base,commit};assert.doesNotThrow(()=>validateProducerSnapshotAssociation(valid));
 for(const mutate of [x=>x.pr.number++,x=>x.repo.full_name='other/repo',x=>x.pr.head.repo.full_name='other/repo',x=>x.pr.base.repo.full_name='other/repo',x=>x.commit.sha='d'.repeat(40),x=>x.commit.tree.sha='invalid',x=>x.base.object.sha='e'.repeat(40),x=>x.base.ref='refs/heads/other',x=>x.pr.state='closed']){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>validateProducerSnapshotAssociation(bad),/association/);}
});
