import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateProtectedRouting, validateProtectedRouting } from '../../tools/verification/protected-semantic-routing.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../../tools/verification/${name}.json`, import.meta.url)));
const manifest = read('impact-manifest'), catalog = read('verification-catalog'), census = read('full-safety-net-stable-ids');
const candidate = { repository:'Example/Repository', prNumber:42, headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'docs/readme.md',status:'modified'}] };
const inventory=read('protected-scenario-inventory');
const input = {candidate,manifest,catalog,census,inventory,routing:{schemaVersion:1,mode:'conservative'}};
const frames=read('protected-visual-capture-contract').requiredFrames;
const visualPath='src/browser/creature-model.mjs';
const run=(path=visualPath,extra={})=>evaluateProtectedRouting({...input,candidate:{...candidate,changedFiles:[{path,status:'modified'}]},routing:{schemaVersion:1,mode:'selective'},...extra});
test('hosted visual proof retains five independent review IDs and complete capture closure',()=>{
 for(const result of [run(),run(visualPath,{forceFull:true}),run('tools/verification/new.mjs',{forceFull:true})]) {
  const review=result.review.find(p=>p.groupIds.includes('visual.creatures'));
  assert.equal(review.dataCapability,'qualification_fixture');
  assert.equal(review.evidenceKind,'restricted-visual-review');
  assert.equal(review.scenarioIds.length,5);
  assert.deepEqual(result.requiredFrames,frames);
  assert.equal(frames.length,17);
  const specs=new Set(frames.map(f=>f.stableTestId.split('::')[1]));
  const closure=inventory.stableTestIds.filter(id=>specs.has(id.split('::')[1]));
  for(const id of closure) assert.ok(result.scenarioIds.includes(id),id);
  for(const id of review.scenarioIds) assert.ok(result.hostedPartitions.some(p=>p.dataCapability==='qualification_fixture'&&p.scenarioIds.includes(id)));
  for(const frame of frames) assert.ok(result.hostedPartitions.some(p=>p.scenarioIds.includes(frame.stableTestId)),frame.frameId);
  assert.ok(result.hostedPartitions.some(p=>p.dataCapability==='bounded_real_world'&&p.scenarioIds.some(id=>id.includes('creature-gameplay'))));
 }
});
test('ordinary nonvisual changes add no visual capture or review tax',()=>{
 const result=run('docs/readme.md');
 assert.deepEqual(result.review,[]);assert.deepEqual(result.requiredFrames,[]);assert.deepEqual(result.scenarioIds,[]);
});
test('private visual and real world placement remain specialist obligations',()=>{
 const privateCatalog=structuredClone(catalog);
 Object.assign(privateCatalog.groups['visual.creatures'].capabilities,{hosted:false,specialistReason:'private-visual',dataCapability:'bounded_real_world'});
 assert.equal(run(visualPath,{catalog:privateCatalog}).review[0].dataCapability,'bounded_real_world');
 const real=run('e2e/tests/fullworld-animation-census-desktop.spec.mjs');
 assert.ok(real.specialist.some(p=>p.dataCapability==='real_fullworld'));
});
test('candidate routing cannot replace protected visual capture or capability requirements',()=>{
 for(const override of [{requiredFrames:[]},{review:[]},{dataCapability:'bounded_real_world'},{visualReview:false}])
 assert.throws(()=>run(visualPath,{routing:{schemaVersion:1,mode:'selective',...override}}));
});
test('protected frame map exactly follows required census and real capture sites',()=>{
 const required=JSON.parse(fs.readFileSync(new URL('../../e2e/user-visual-scenarios.json',import.meta.url))).scenarios;
 assert.deepEqual(frames.map(f=>f.frameId).sort(),required.map(f=>f.id).sort());
 for(const frame of frames) {
  assert.ok(inventory.stableTestIds.includes(frame.stableTestId));
  const [project,spec,title]=frame.stableTestId.split('::');
  assert.equal(project,required.find(f=>f.id===frame.frameId).project);
  const source=fs.readFileSync(new URL('../../'+spec,import.meta.url),'utf8');
  const capture=source.indexOf("captureUserVisualEvidence(page, testInfo, '"+frame.frameId+"'");
  assert.ok(capture>=0);
  const titles=[...source.slice(0,capture).matchAll(/test\('([^']+)'/g)];
  assert.equal(titles.at(-1)[1],title);
 }
});
