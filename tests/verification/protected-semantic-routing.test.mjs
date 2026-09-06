import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateProtectedRouting, validateProtectedRouting } from '../../tools/verification/protected-semantic-routing.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${name}.json`, import.meta.url)));
const manifest = read('impact-manifest'), catalog = read('verification-catalog'), census = read('full-safety-net-stable-ids');
const candidate = { repository:'Example/Repository', prNumber:42, headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'docs/readme.md',status:'modified'}] };
const inventory=read('protected-scenario-inventory');
const input = {candidate,manifest,catalog,census,inventory,routing:{schemaVersion:1,mode:'conservative'}};
test('ordinary documentation and deterministic tests require no browser', () => {
 for (const path of ['docs/readme.md','tests/verification/new.test.mjs']) {
  const result = evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path,status:'added'}]}});
  assert.deepEqual(result.scenarioIds,[]);
 }
});
test('forced repair retains complete protected census and independent execution policy', () => {
 const result = evaluateProtectedRouting({...input,forceFull:true});
 assert.ok(census.stableTestIds.every(id=>result.scenarioIds.includes(id)));
 assert.equal(result.workers,1);assert.equal(result.retries,0);
 assert.ok(result.requiredGroups.includes('e2e.full'));
});
test('PR and MQ receive exactly the same normalized semantic contract', () => {
 assert.deepEqual(evaluateProtectedRouting(input),evaluateProtectedRouting(structuredClone(input)));
});
test('every identity field and complete changed set binds the semantic digest', () => {
 const expected = evaluateProtectedRouting(input).semanticDigest;
 for (const [key,value] of Object.entries({repository:'Another/Repo',prNumber:99,headSha:'d'.repeat(40),baseSha:'e'.repeat(40),treeSha:'f'.repeat(40),changedFiles:[{path:'docs/other.md',status:'added'}]})) {
  assert.notEqual(evaluateProtectedRouting({...input,candidate:{...candidate,[key]:value}}).semanticDigest,expected,key);
 }
});
test('malformed identities and branch-specific metadata are rejected', () => {
 for(const patch of [{repository:'broken'},{prNumber:0},{headSha:'bad'},{baseSha:null},{treeSha:''},{branch:'special'},{changedFiles:[]}]) assert.throws(()=>evaluateProtectedRouting({...input,candidate:{...candidate,...patch}}));
});
test('closed inert routing rejects lower bounds, capabilities, oracle and branch overrides', () => {
 for (const patch of [{workers:2},{retries:1},{capabilities:[]},{oracle:'candidate'},{prNumber:42},{branch:'main'},{mode:'none'},{schemaVersion:2}]) assert.throws(()=>evaluateProtectedRouting({...input,routing:{...input.routing,...patch}}));
});
test('grouping must preserve exact protected census without unknown or duplicate IDs', () => {
 const ids = census.stableTestIds;
 assert.doesNotThrow(()=>validateProtectedRouting({schemaVersion:1,mode:'selective',groups:{functional:ids}},census));
 for (const groups of [{functional:ids.slice(1)},{functional:[...ids,'unknown::spec::test']},{functional:ids,duplicate:[ids[0]]},{'pr-42':ids}]) assert.throws(()=>validateProtectedRouting({schemaVersion:1,mode:'selective',groups},census));
});
test('selective retains protected classifier minima and conservative can only widen browser proof',()=>{
 const changedFiles=[{path:'web/fullworld-search.mjs',status:'modified'}];
 const selected=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles},routing:{schemaVersion:1,mode:'selective'}});
 const conservative=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles}});
 assert.ok(selected.scenarioIds.length>0);
 assert.ok(selected.scenarioIds.every(id=>conservative.scenarioIds.includes(id)));
 assert.ok(census.stableTestIds.every(id=>conservative.scenarioIds.includes(id)));
});
test('group aliases cannot reduce selection or change protected capabilities',()=>{
 const changedFiles=[{path:'web/fullworld-search.mjs',status:'modified'}];
 const plain=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles},routing:{schemaVersion:1,mode:'selective'}});
 const grouped=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles},routing:{schemaVersion:1,mode:'selective',groups:{arbitrary:census.stableTestIds}}});
 assert.deepEqual(grouped.scenarioIds,plain.scenarioIds);
 assert.deepEqual(grouped.requiredGroups,plain.requiredGroups);
 assert.deepEqual(grouped.capabilities,plain.capabilities);
});
test('complete file set is order independent and rename source retains protected impact',()=>{
 const changedFiles=[{path:'docs/readme.md',status:'modified'},{path:'tests/verification/new.test.mjs',status:'added'}];
 const a=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles}});
 const b=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[...changedFiles].reverse()}});
 assert.deepEqual(a,b);
 const rename=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path:'docs/moved.md',previousPath:'web/fullworld-search.mjs',status:'renamed'}]}});
 assert.ok(rename.scenarioIds.length>0);
});

test('complete protected inventory includes source-contract scenarios outside full floor',()=>{
 const result=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path:'web/semantic-search/index.json',status:'modified'}]},routing:{schemaVersion:1,mode:'selective'}});
 assert.ok(result.hostedPartitions.some(p=>p.dataCapability==='bounded_real_world'&&p.scenarioIds.some(id=>id.includes('api-contract-desktop.spec.mjs'))));
});
test('visual review obligations survive overlapping hosted execution IDs',()=>{
 const result=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path:'src/browser/creature-model.mjs',status:'modified'}]}});
 assert.ok(result.review.some(p=>p.dataCapability==='qualification_fixture'&&p.evidenceKind==='restricted-visual-review'));
 assert.ok(result.review[0].scenarioIds.some(id=>result.hostedPartitions.some(p=>p.scenarioIds.includes(id))));
});
test('inventory cannot omit the historical floor or catalog browser specs',()=>{
 assert.throws(()=>evaluateProtectedRouting({...input,inventory:{stableTestIds:inventory.stableTestIds.filter(id=>id!==census.stableTestIds[0])}}));
 assert.throws(()=>evaluateProtectedRouting({...input,inventory:{stableTestIds:census.stableTestIds}}));
});

test('selective functional UI retains scale unique oracle and removes unrelated depth tax',()=>{
 const result=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path:'web/fullworld-search.mjs',status:'modified'}]},routing:{schemaVersion:1,mode:'selective'}});
 assert.ok(result.scenarioIds.some(id=>id.includes('/scale-desktop.')));
 assert.ok(!result.scenarioIds.some(id=>id.includes('/performance-desktop.')));
 assert.ok(!result.scenarioIds.some(id=>id.includes('/soak-desktop.')));
 assert.ok(!result.requiredGroups.includes('e2e.full'));
 assert.ok(result.requiredGroups.includes('functional.full'));
});
test('protected depth purpose requires exact main and runs all four profile oracles',()=>{
 const result=evaluateProtectedRouting({...input,proofPurpose:'depth',candidate:{...candidate,prNumber:null,headSha:candidate.baseSha,changedFiles:[]}});
 assert.equal(result.scenarioIds.length,4);
 assert.equal(result.profile,'full');
 assert.equal(result.evidenceKind,'protected-main-depth-v1');
 assert.throws(()=>evaluateProtectedRouting({...input,proofPurpose:'depth'}));
 assert.throws(()=>evaluateProtectedRouting({...input,proofPurpose:'other'}));
});
test('exact MQ identity may have null PR without granting PR admission',()=>{
 const result=evaluateProtectedRouting({...input,candidate:{...candidate,prNumber:null}});
 assert.equal(result.candidate.prNumber,null);
 assert.notEqual(result.semanticDigest,evaluateProtectedRouting(input).semanticDigest);
});
test('candidate cannot reassign profiles or defer transition properties',()=>{
 assert.throws(()=>evaluateProtectedRouting({...input,routing:{...input.routing,profiles:{scale:'optional'}}}));
 const result=evaluateProtectedRouting({...input,forceFull:true,routing:{schemaVersion:1,mode:'selective'}});
 assert.ok(census.stableTestIds.every(id=>result.scenarioIds.includes(id)));
 for(const path of ['.github/workflows/ci.yml','tools/verification/protected-routing.json','new-unknown-runtime.mjs']) {
  const guarded=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path,status:'modified'}]},routing:{schemaVersion:1,mode:'selective'}});
  assert.ok(census.stableTestIds.every(id=>guarded.scenarioIds.includes(id)));
 }
});
test('depth dependency requirements widen a targeted protected classifier plan',()=>{
 const result=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path:'src/browser/verified-content-cache.mjs',status:'modified'}]},routing:{schemaVersion:1,mode:'selective'}});
 for(const name of ['performance','scale','soak','stress']) assert.ok(result.scenarioIds.some(id=>id.includes(`/${name}-desktop.`)),name);
});

test('selected evidence names every protected property and fixed profile',()=>{
 const result=evaluateProtectedRouting({...input,forceFull:true});
 assert.deepEqual(result.propertyObligations.map(row=>row.stableId),result.scenarioIds);
 const scale=result.propertyObligations.find(row=>row.profile==='scale');
 assert.ok(scale.properties.includes('invalid-query-rejection'));
 assert.ok(scale.properties.includes('bounded-search-dom'));
});
test('shared browser and layer changes preserve every protected functional floor property',()=>{
 const properties=read('protected-scenario-properties');
 const functionalFloor=census.stableTestIds.filter(id=>properties.scenarios.find(row=>row.stableId===id).profile==='functional');
 assert.equal(functionalFloor.length,64);
 for(const path of ['src/browser/loader.mjs','src/browser/verified-content-cache.mjs','src/layers/overview.mjs']) {
  const result=evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path,status:'modified'}]},routing:{schemaVersion:1,mode:'selective'}});
  assert.ok(functionalFloor.every(id=>result.scenarioIds.includes(id)),path);
  assert.ok(result.requiredGroups.includes('functional.full')||result.requiredGroups.includes('e2e.full'),path);
 }
});
