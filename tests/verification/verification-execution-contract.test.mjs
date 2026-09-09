import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {R5_SEMANTIC_BUILDER_ORACLE, R5_SEMANTIC_BUILDER_ORACLE_DIGEST, R5_SEMANTIC_SOURCE, assertCandidateReadback, resolveExecutionContract, sealExecutionContract, verifyR5SemanticProduct} from '../../tools/verification/verification-execution-contract.mjs';
import {createPublicationProofFixtures} from './helpers/publication-proof-fixture.mjs';
const sha = c => c.repeat(40);
const snapshot = () => ({repository:'Oteryn/Oteryn-Atlas',prNumber:7,headSha:sha('a'),baseSha:sha('b'),treeSha:sha('c'),changedFiles:[{path:'src/browser/loader.mjs',status:'modified'}]});
const source = {sourceRepository:'Oteryn/Oteryn-Atlas',sourceRef:'refs/heads/main',sourceRevision:sha('b')};
const root=fileURLToPath(new URL('../../',import.meta.url));
function executionInput(path='tests/semantic-search.mjs') {
 const candidate={...snapshot(),changedFiles:[{path,status:'modified'}]};
 const protectedCatalog=JSON.parse(fs.readFileSync(`${root}/tools/verification/verification-catalog.json`));
 const protectedImpactManifest=JSON.parse(fs.readFileSync(`${root}/tools/verification/impact-manifest.json`));
 return {root,candidate,protectedCatalog,protectedImpactManifest,environmentDigest:'f'.repeat(64),
  planInput:{repository:candidate.repository,headSha:candidate.headSha,integrationBaseSha:candidate.baseSha,mergeBaseSha:candidate.baseSha,changedFiles:candidate.changedFiles,
   candidateVerificationCatalog:protectedCatalog,candidateImpactManifest:protectedImpactManifest}};
}
test('final candidate readback rejects head/base/tree/repository/file drift',()=>{
 const planned=snapshot();assert.equal(assertCandidateReadback({planned,current:snapshot(),...source}),true);
 for(const key of ['headSha','baseSha','treeSha','repository']) {const current=snapshot();current[key]=key==='repository'?'Other/Atlas':sha('d');assert.throws(()=>assertCandidateReadback({planned,current,...source}),/readback/);}
 const current=snapshot();current.changedFiles[0].path='README.md';assert.throws(()=>assertCandidateReadback({planned,current,...source}),/readback/);
});

test('candidate branches cannot impersonate protected execution source',()=>{
 for(const bad of [{sourceRef:'refs/heads/feature'},{sourceRepository:'Other/Atlas'},{sourceRevision:sha('d')}]) assert.throws(()=>assertCandidateReadback({planned:snapshot(),current:snapshot(),...source,...bad}),/protected source/);
});

test('planner resolves exact deterministic commands and preserves changed-test coverage',()=>{
 const contract=resolveExecutionContract(executionInput());
 assert.deepEqual(contract.groups.map(g=>g.id),['deterministic.search']);
 assert(contract.commands.some(c=>c.expectedTestIds.includes('tests/semantic-search.mjs')));
 assert(contract.commands.every(c=>c.engine==='deterministic'&&c.argv[0]==='node'&&c.cwd==='.'&&c.dataCapability==='qualification_fixture'));
 assert.equal(new Set(contract.commands.flatMap(c=>c.expectedTestIds)).size,contract.commands.flatMap(c=>c.expectedTestIds).length);
});

test('docs-only plan produces no command or runner and needs no publication',()=>{
 const input=executionInput('docs/ordinary.md');const contract=resolveExecutionContract(input);
 assert.deepEqual(contract.commands,[]);assert.deepEqual(contract.groups,[]);
});

test('unknown paths and stale claimed plans fail closed while candidate group widening has no execution authority',()=>{
 assert.throws(()=>resolveExecutionContract(executionInput('unknown/product.mjs')),/unresolved obligations/);
 const baseline=resolveExecutionContract(executionInput());
 const input=executionInput();input.planInput.candidateVerificationCatalog=structuredClone(input.protectedCatalog);
 input.planInput.candidateVerificationCatalog.groups['deterministic.search'].specs.push('tests/creature-gameplay-model.mjs');
 assert.deepEqual(resolveExecutionContract(input),baseline);
 assert.throws(()=>resolveExecutionContract({...executionInput(),claimedPlan:{}}),/recomputed plan/);
 const changed=executionInput();changed.candidate.treeSha='bad';assert.throws(()=>resolveExecutionContract(changed),/readback identity/);
});

test('HTTP Playwright proof resolves exact protected test census without browser or FullWorld',()=>{
 const input=executionInput('e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs');
 input.protectedStableTestIds=JSON.parse(fs.readFileSync(`${root}/tools/verification/protected-scenario-inventory.json`)).stableTestIds;
 Object.assign(input,createPublicationProofFixtures());
 const contract=resolveExecutionContract(input);
 assert.deepEqual(contract.groups.map(g=>g.id),['integration.source-contract-http']);
 assert.equal(contract.commands.length,1);assert.equal(contract.commands[0].expectedTestIds.length,2);
 assert.equal(contract.commands[0].dataCapability,'bounded_real_world');
 assert.equal(contract.commands[0].resourceClass,'cpu-light');
 assert.equal(contract.commands[0].cwd,'e2e');
 assert.throws(()=>resolveExecutionContract({...input,protectedStableTestIds:undefined}),/missing protected test census/);
 const bad=structuredClone(input);bad.publicationProofs.bounded_real_world.source.revision='e'.repeat(40);
 assert.throws(()=>resolveExecutionContract(bad),/publication authentication/);
});

test('review frames remain additional obligations after exact browser command resolution',()=>{
 const input=executionInput('e2e/tests/creature-presentation-desktop.spec.mjs');
 input.protectedStableTestIds=JSON.parse(fs.readFileSync(`${root}/tools/verification/protected-scenario-inventory.json`)).stableTestIds;
 Object.assign(input,createPublicationProofFixtures());
 const contract=resolveExecutionContract(input);
 assert.equal(contract.commands.length,2);assert.equal(contract.reviews.length,2);
 assert.equal(contract.reviews.flatMap(r=>r.frames).length,13);
 assert(contract.commands.every(c=>c.dataCapability==='qualification_fixture'));
});

test('review frame IDs cannot substitute for the complete protected machine test census',()=>{
 const input=executionInput('e2e/tests/creature-gameplay-desktop.spec.mjs');
 Object.assign(input,createPublicationProofFixtures());
 assert.throws(()=>resolveExecutionContract(input),/missing protected test census/);
 input.protectedStableTestIds=JSON.parse(fs.readFileSync(`${root}/tools/verification/protected-scenario-inventory.json`)).stableTestIds;
 const contract=resolveExecutionContract(input);
 const command=contract.commands.find(row=>row.expectedTestIds.some(id=>id.includes('creature-gameplay-desktop.spec.mjs')));
 assert.equal(command.expectedTestIds.length,4);
 assert.equal(contract.reviews.find(row=>row.groupId==='review.creature-gameplay-desktop').frames.length,1);
});

test('actual changed candidate leaf executes without protected source repin', t => {
 const input=executionInput('tests/example.mjs');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-candidate-bytes-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 fs.mkdirSync(path.join(directory,'tests'));
 const baseline="import test from 'node:test'; test('baseline bytes',()=>{});\n";
 fs.writeFileSync(path.join(directory,'tests/example.mjs'),baseline);
 const oldSpecs=input.protectedCatalog.groups['deterministic.search'].specs;
 input.protectedCatalog.groups['deterministic.search'].specs=['tests/example.mjs'];
 input.protectedCatalog.executionPolicy.deterministic.entries=input.protectedCatalog.executionPolicy.deterministic.entries.filter(row=>!oldSpecs.includes(row.spec));
 input.protectedCatalog.executionPolicy.deterministic.entries.push({spec:'tests/example.mjs',interpreter:'node',argv:['--test','tests/example.mjs'],sourceSha256:createHash('sha256').update(baseline).digest('hex'),imports:[],subprocessTests:[]});
 input.root=directory;
 const policyBefore=JSON.stringify(input.protectedCatalog);
 const changed="import test from 'node:test'; test('CANDIDATE_BYTES_EXECUTED',()=>{});\n";
 fs.writeFileSync(path.join(directory,'tests/example.mjs'),changed);
 const contract=resolveExecutionContract(input);
 assert.deepEqual(contract.groups.map(row=>row.id),['deterministic.search']);
 assert.equal(contract.commands.length,1);
 const command=contract.commands[0];
 assert.deepEqual(command.argv,['node','--test','tests/example.mjs']);
 const result=spawnSync(command.argv[0],command.argv.slice(1),{cwd:directory,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:undefined}});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/CANDIDATE_BYTES_EXECUTED/);
 assert.equal(JSON.stringify(input.protectedCatalog),policyBefore);
 fs.writeFileSync(path.join(directory,'tests/example.mjs'),"throw new Error('CANDIDATE_FAILURE_VISIBLE');\n");
 const failedContract=resolveExecutionContract(input);
 const failed=spawnSync(failedContract.commands[0].argv[0],failedContract.commands[0].argv.slice(1),{cwd:directory,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:undefined}});
 assert.notEqual(failed.status,0);
 assert.match(failed.stdout+failed.stderr,/CANDIDATE_FAILURE_VISIBLE/);
});

test('equivalent PR and MQ content resolves identical semantic obligations',()=>{
 const pr=executionInput(),mq=executionInput();
 mq.candidate.prNumber=null;
 const left=resolveExecutionContract(pr),right=resolveExecutionContract(mq);
 const semantic=contract=>({groups:contract.groups.map(g=>g.id),commands:contract.commands.map(({id,...row})=>row),reviews:contract.reviews});
 assert.deepEqual(semantic(left),semantic(right));
});
test('added candidate test executes as an unprivileged subject while candidate-only owner metadata stays inert',t=>{
 const spec=`tests/pre-r4-add-${process.pid}-${Date.now()}.mjs`;
 const subjectRoot=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-add-subject-'));
 fs.cpSync(path.join(root,'tests'),path.join(subjectRoot,'tests'),{recursive:true});
 const target=path.join(subjectRoot,spec);
 t.after(()=>fs.rmSync(subjectRoot,{recursive:true,force:true}));
 fs.writeFileSync(target,"import test from 'node:test'; test('ADD_CANDIDATE_EXECUTED',()=>{});\n");
 const input=executionInput(spec);
 // Repository bytes are the known protected fixture; only the new subject differs.
 input.protectedRoot=root;
 input.root=subjectRoot;
 input.candidate.changedFiles=[{path:spec,status:'added'}];
 input.planInput.changedFiles=input.candidate.changedFiles;
 input.planInput.candidateVerificationCatalog=structuredClone(input.protectedCatalog);
 input.planInput.candidateVerificationCatalog.groups['deterministic.search'].specs.push(spec);
 const contract=resolveExecutionContract(input);
 const command=contract.commands.find(row=>row.expectedTestIds.includes(spec));
 assert.ok(command);
 assert.deepEqual(command.argv,['node','--test',spec]);
 assert.deepEqual(command.groupIds,[]);
 assert.equal(contract.commands.length,1);
 assert.deepEqual(contract.groups,[]);
 assert.deepEqual(contract.candidateTestSubjects,[{spec,commandId:command.id}]);
 assert.deepEqual(command.expectedTestIds,[spec]);
 let result=spawnSync(command.argv[0],command.argv.slice(1),{cwd:subjectRoot,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:undefined}});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/ADD_CANDIDATE_EXECUTED/);
 fs.writeFileSync(target,"throw new Error('ADD_CANDIDATE_FAILURE_VISIBLE');\n");
 const failed=resolveExecutionContract(input);
 assert.equal(failed.commands.length,1);
 const failedCommand=failed.commands.find(row=>row.expectedTestIds.includes(spec));
 result=spawnSync(failedCommand.argv[0],failedCommand.argv.slice(1),{cwd:subjectRoot,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:undefined}});
 assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/ADD_CANDIDATE_FAILURE_VISIBLE/);
});

test('renamed deterministic test executes candidate bytes at the new path under the old protected identity',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-candidate-rename-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));fs.mkdirSync(path.join(directory,'tests'));
 const oldPath='tests/example.mjs',newPath='tests/renamed-example.mjs';
 const baseline="import test from 'node:test'; test('baseline rename',()=>{});\n";
 const candidateBytes="import test from 'node:test'; test('RENAME_CANDIDATE_EXECUTED',()=>{});\n";
 fs.writeFileSync(path.join(directory,newPath),candidateBytes);
 const input=executionInput(newPath);
 const oldSpecs=input.protectedCatalog.groups['deterministic.search'].specs;
 input.protectedCatalog.groups['deterministic.search'].specs=[oldPath];
 input.protectedCatalog.executionPolicy.deterministic.entries=input.protectedCatalog.executionPolicy.deterministic.entries.filter(row=>!oldSpecs.includes(row.spec));
 input.protectedCatalog.executionPolicy.deterministic.entries.push({spec:oldPath,interpreter:'node',argv:['--test',oldPath],sourceSha256:createHash('sha256').update(baseline).digest('hex'),imports:[],subprocessTests:[]});
 input.root=directory;input.candidate.changedFiles=[{path:newPath,status:'renamed',previousPath:oldPath}];input.planInput.changedFiles=input.candidate.changedFiles;
 const contract=resolveExecutionContract(input);
 assert.deepEqual(contract.groups.map(row=>row.id),['deterministic.search']);
 const command=contract.commands.find(row=>row.expectedTestIds.includes(oldPath));
 assert.ok(command);assert.deepEqual(command.argv,['node','--test',newPath]);assert.deepEqual(command.expectedTestIds,[oldPath]);
 const result=spawnSync(command.argv[0],command.argv.slice(1),{cwd:directory,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:undefined}});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/RENAME_CANDIDATE_EXECUTED/);
});

test('modified protected aggregator executes itself but loses stale child coverage credit',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-candidate-parent-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));fs.mkdirSync(path.join(directory,'tests'));
 const parent='tests/example-parent.mjs',child='tests/example-child.mjs';
 const childBytes="import test from 'node:test'; test('PROTECTED_CHILD_EXECUTED',()=>{});\n";
 const baseline="import './example-child.mjs';\nimport test from 'node:test'; test('baseline parent',()=>{});\n";
 const candidateParent="import test from 'node:test'; test('MODIFIED_PARENT_EXECUTED',()=>{});\n";
 fs.writeFileSync(path.join(directory,parent),candidateParent);fs.writeFileSync(path.join(directory,child),childBytes);
 const input=executionInput(parent);const oldSpecs=input.protectedCatalog.groups['deterministic.search'].specs;
 input.protectedCatalog.groups['deterministic.search'].specs=[parent,child];
 input.protectedCatalog.executionPolicy.deterministic.entries=input.protectedCatalog.executionPolicy.deterministic.entries.filter(row=>!oldSpecs.includes(row.spec));
 input.protectedCatalog.executionPolicy.deterministic.entries.push(
  {spec:parent,interpreter:'node',argv:['--test',parent],sourceSha256:createHash('sha256').update(baseline).digest('hex'),imports:[child],subprocessTests:[]},
  {spec:child,interpreter:'node',argv:['--test',child],sourceSha256:createHash('sha256').update(childBytes).digest('hex'),imports:[],subprocessTests:[]},
 );
 input.root=directory;
 const contract=resolveExecutionContract(input);
 const parentCommand=contract.commands.find(row=>row.expectedTestIds.includes(parent));
 const childCommand=contract.commands.find(row=>row.expectedTestIds.includes(child));
 assert.ok(parentCommand&&childCommand);assert.deepEqual(parentCommand.expectedTestIds,[parent]);assert.deepEqual(childCommand.expectedTestIds,[child]);
 let result=spawnSync(parentCommand.argv[0],parentCommand.argv.slice(1),{cwd:directory,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:undefined}});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/MODIFIED_PARENT_EXECUTED/);
 result=spawnSync(childCommand.argv[0],childCommand.argv.slice(1),{cwd:directory,encoding:'utf8',env:{...process.env,NODE_TEST_CONTEXT:undefined}});
 assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PROTECTED_CHILD_EXECUTED/);
});
test('candidate execution metadata cannot replace protected interpreter or hashes',()=>{
 const input=executionInput();
 input.planInput.candidateVerificationCatalog=structuredClone(input.protectedCatalog);
 const row=input.planInput.candidateVerificationCatalog.executionPolicy.deterministic.entries.find(row=>row.spec==='tests/semantic-search.mjs');
 row.interpreter='bash';row.argv=['-c','candidate-policy'];row.sourceSha256='0'.repeat(64);
 const contract=resolveExecutionContract(input);
 assert(contract.commands.every(row=>row.argv[0]==='node'));
 assert(!JSON.stringify(contract).includes('candidate-policy'));
});

import {authenticateR5SemanticSource,buildR5SemanticPublication,resolveShadowEvent,planShadow,deterministicDockerArgs,fixtureBrowserArgs} from '../../tools/verification/run-verification-shadow.mjs';
test('fixture browser preserves runner ownership of report artifacts',()=>{
 const compose=['compose','-p','protected-fixture','-f','/protected/compose.yml'];
 assert.deepEqual(fixtureBrowserArgs(compose,{uid:1001,gid:1002}),[...compose,'run','--user','1001:1002','--rm','--no-deps','e2e']);
 assert.deepEqual(fixtureBrowserArgs(compose),[...compose,'run','--user',`${process.getuid()}:${process.getgid()}`,'--rm','--no-deps','e2e']);
 for(const bad of [-1,1.5,'1001',NaN,Infinity]){
  assert.throws(()=>fixtureBrowserArgs(compose,{uid:bad,gid:1002}),/fixture host identity/);
  assert.throws(()=>fixtureBrowserArgs(compose,{uid:1001,gid:bad}),/fixture host identity/);
 }
});

const r5Read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'tools/verification', `${name}.json`), 'utf8'));
const r5Catalog = r5Read('verification-catalog');
const r5Impact = r5Read('impact-manifest');
const r5Inventory = r5Read('protected-scenario-inventory');
const r5SemanticSourceBytes = () => Buffer.from('ewogICJjYXBhYmlsaXR5IjogInNlbWFudGljLXNlYXJjaC1zb3VyY2UtdjEiLAogICJjb250cmFjdF9pZCI6ICJvdGVyeW4tZ2FtZS1hdGxhcy1leHBvcnQtdjEiLAogICJjb29yZGluYXRlX3Byb2ZpbGUiOiAib3RlcnluLXdvcmxkLXNwYXRpYWwtdjEiLAogICJjb3VudHMiOiB7CiAgICAia2luZHMiOiB7CiAgICAgICJucGMiOiAxLAogICAgICAidG93biI6IDEKICAgIH0sCiAgICAicmVjb3JkcyI6IDIKICB9LAogICJpbnB1dF9mbG9vcl9hbGlhc2VzIjogewogICAgIjAiOiAwLAogICAgIjEiOiAtMSwKICAgICIxMCI6IC0xMCwKICAgICIxMSI6IC0xMSwKICAgICIxMiI6IC0xMiwKICAgICIxMyI6IC0xMywKICAgICIxNCI6IC0xNCwKICAgICIxNSI6IC0xNSwKICAgICIyIjogLTIsCiAgICAiMyI6IC0zLAogICAgIjQiOiAtNCwKICAgICI1IjogLTUsCiAgICAiNiI6IC02LAogICAgIjciOiAtNywKICAgICI4IjogLTgsCiAgICAiOSI6IC05CiAgfSwKICAibGVnYWN5X2ltcG9ydF9wcm9maWxlIjogIm90ZXJ5bi1jcnlzdGFsc2VydmVyLWxlZ2FjeS1zcGF0aWFsLWltcG9ydC12MSIsCiAgInByb2ZpbGVfaWQiOiAib3RlcnluLWdhbWUtYXRsYXMtc2VtYW50aWMtc2VhcmNoLXYxIiwKICAicmVjb3JkcyI6IFsKICAgIHsKICAgICAgImFsaWFzZXMiOiBbXSwKICAgICAgImJvdW5kcyI6IG51bGwsCiAgICAgICJjYXBhYmlsaXRpZXMiOiBbCiAgICAgICAgInNob3AiLAogICAgICAgICJzdGF0aWMtcGxhY2VtZW50IgogICAgICBdLAogICAgICAiaWQiOiAibnBjOjcyNjQ4NzQzOGM4MzA4YWJmMjkxNjIyYTUyZDkxYjI0IiwKICAgICAgImtpbmQiOiAibnBjIiwKICAgICAgImxhYmVsIjogIlNhbSIsCiAgICAgICJwb3NpdGlvbiI6IHsKICAgICAgICAiZmxvb3IiOiAtNywKICAgICAgICAieCI6IDMyMzYxLAogICAgICAgICJ5IjogMzIxOTgKICAgICAgfSwKICAgICAgInByb3ZlbmFuY2UiOiB7CiAgICAgICAgImF1dGhvcml0eSI6ICJPdGVyeW4vT3RlcnluLUdhbWUiLAogICAgICAgICJsZWdhY3lfcmVwb3NpdG9yeSI6ICJibGFraW5pby9PdGhlcnluIiwKICAgICAgICAibGVnYWN5X3JlcG9zaXRvcnlfc2hhIjogImU0MTdjNWU3YzIyOTg2YmY0YWNlZjA0OTVlYjQ3ZjdiNzJjOTdjY2UiLAogICAgICAgICJvcmlnaW4iOiAiYmFzZS1tYXAiLAogICAgICAgICJyZXNvbHV0aW9uX3N0YXRlIjogIlJFU09MVkVEIiwKICAgICAgICAic2VydmljZV9yZXNvbHV0aW9uX3N0YXRlIjogIlJFU09MVkVEIiwKICAgICAgICAic291cmNlX2NhcGFiaWxpdHkiOiAic3RhdGljLWNyZWF0dXJlcy12MSIsCiAgICAgICAgInNvdXJjZV9zZW1hbnRpY19kaWdlc3QiOiAic2hhMjU2OjAxOTIxOTY4YTZjYjRmNmVjZWEyMzc4MjBhMDUzZmM1MDUyYWFhMWRhNTU2ODUxZjJjMmE2MGQ5OTg5MGI1ZTEiCiAgICAgIH0KICAgIH0sCiAgICB7CiAgICAgICJhbGlhc2VzIjogW10sCiAgICAgICJib3VuZHMiOiBudWxsLAogICAgICAiY2FwYWJpbGl0aWVzIjogWwogICAgICAgICJuYXZpZ2F0aW9uIiwKICAgICAgICAib3ZlcmxheS1wb2ludCIKICAgICAgXSwKICAgICAgImlkIjogInNlbWFudGljLXJlY29yZDoyMzcxNmEzNTA5OWEwNDE3OWY3YjllM2U2YzkxOThlZSIsCiAgICAgICJraW5kIjogInRvd24iLAogICAgICAibGFiZWwiOiAiVGhhaXMiLAogICAgICAicG9zaXRpb24iOiB7CiAgICAgICAgImZsb29yIjogLTcsCiAgICAgICAgIngiOiAzMjM2OSwKICAgICAgICAieSI6IDMyMjQxCiAgICAgIH0sCiAgICAgICJwcm92ZW5hbmNlIjogewogICAgICAgICJhdXRob3JpdHkiOiAiT3RlcnluL090ZXJ5bi1HYW1lIiwKICAgICAgICAiaWRlbnRpdHlfc3RhdGUiOiAiVU5SRVNPTFZFRCIsCiAgICAgICAgImxlZ2FjeV9wYXJzZXJfYmxvYnMiOiB7CiAgICAgICAgICAidG9vbHMvb3RibV9hdGxhcy9hc3NldHMucHkiOiAiMjVlZDI0MDA4MTNiYjNjY2RjNTQ0ODI5NjdlZDA1MTk3ZWIxYTg1MCIsCiAgICAgICAgICAidG9vbHMvb3RibV9hdGxhcy9ub2RlZmlsZS5weSI6ICJiZWQ2ZjdhODAzZDlkZTQ4NWMxZjAzY2JkY2E0YmUwY2IxNTIxZDMwIiwKICAgICAgICAgICJ0b29scy9vdGJtX2F0bGFzL3NlbWFudGljLnB5IjogImExMTM0M2E0NzIxNDVhZWU0ZDljZjY1YzZjZTI4YjNlNGE3MWEyYjMiCiAgICAgICAgfSwKICAgICAgICAibGVnYWN5X3JlcG9zaXRvcnkiOiAiYmxha2luaW8vT3RoZXJ5biIsCiAgICAgICAgImxlZ2FjeV9yZXBvc2l0b3J5X3NoYSI6ICJlNDE3YzVlN2MyMjk4NmJmNGFjZWYwNDk1ZWI0N2Y3YjcyYzk3Y2NlIiwKICAgICAgICAic291cmNlX2ZhbWlseSI6ICJ0b3duIiwKICAgICAgICAid29ybGRfb3RibV9zaGEyNTYiOiAiM2JkNDBkMTRmZWZlYzQxZjI0YzRiM2FlODc5ZTQyMGJlMWE4MzFlZjU1Yjk1ZGNiZWM3MjFlNTg3YTA5YjAzNCIKICAgICAgfQogICAgfQogIF0sCiAgInNjaGVtYV92ZXJzaW9uIjogMSwKICAic2VtYW50aWNfZGlnZXN0IjogInNoYTI1NjphNGE0NzAzOTYyYmQ2OTg0ZDMxZWYxZGFmY2QyN2JhZDQ3NWQ2YjYxZjU3MGQwMTM1NjBjMTZhNzA0OTg5YmY4IiwKICAic2VtYW50aWNfcmV2aXNpb24iOiAxCn0K', 'base64');
const r5Candidate = (changedPath) => ({
  repository: 'Oteryn/Oteryn-Atlas', prNumber: 315, headSha: sha('a'), baseSha: sha('b'), treeSha: sha('c'),
  changedFiles: [{ path: changedPath, status: 'modified' }],
});
const r5Plan = (changedPath) => buildVerificationPlan({
  repository: 'Oteryn/Oteryn-Atlas', headSha: sha('a'), integrationBaseSha: sha('b'), mergeBaseSha: sha('b'),
  changedFiles: [{ path: changedPath, status: 'modified' }], trustedImpactManifest: r5Impact,
  candidateImpactManifest: r5Impact, verificationCatalog: r5Catalog, protectedStableTestIds: r5Inventory.stableTestIds,
});

test('R5 C1 selects only the exact deterministic authority-registry proof', () => {
  const result = r5Plan('tools/fullworld-layers/verify_authority_registry.py');
  assert.deepEqual(result.requiredGroupIds, ['deterministic.fullworld-layers']);
  assert.deepEqual(result.requiredDataCapabilities, ['qualification_fixture']);
  assert.deepEqual(result.groups[0].specs, [
    'tests/fullworld-layers/overview-browser.test.mjs',
    'tests/fullworld-layers/test_authority_registry.py',
    'tests/fullworld-layers/test_overview.py',
  ]);
});

test('R5 C2 selects the minimal fixture browser and deterministic farm obligations', () => {
  const result = r5Plan('web/fullworld-farm-explorer.mjs');
  assert.deepEqual(result.requiredGroupIds, ['deterministic.farm-ui', 'e2e.farm-explorer']);
  assert.deepEqual(result.requiredDataCapabilities, ['qualification_fixture']);
  assert.deepEqual(result.stableTestIds, [
    'desktop-chromium::e2e/tests/farm-explorer-desktop.spec.mjs::desktop Farm Explorer fails closed for upstream facts and keeps custom kill estimator usable',
    'mobile-chromium::e2e/tests/farm-explorer-mobile.spec.mjs::mobile Farm Explorer remains reachable and truthful in the existing controls drawer',
  ]);
  assert.deepEqual(result.requiredVisualGroupIds, []);
});

test('R5 C3 selects exact search and bounded-source obligations without unrelated fixture navigation', () => {
  const result = r5Plan('tools/build-semantic-search-index.py');
  assert.deepEqual(result.requiredGroupIds, [
    'deterministic.search',
    'integration.source-contract-browser',
  ]);
  assert.deepEqual(result.requiredDataCapabilities, ['bounded_real_world', 'qualification_fixture']);
  assert.deepEqual(result.groups.find(({ id }) => id === 'deterministic.search').specs, [
    'tests/browser-semantic.mjs',
    'tests/semantic-search-creatures.mjs',
    'tests/semantic-search.mjs',
  ]);
  assert.deepEqual(result.stableTestIds, [
    'desktop-chromium::e2e/tests/api-contract-desktop.spec.mjs::browser search diagnostics match published semantic API contracts',
    'desktop-chromium::e2e/tests/api-contract-desktop.spec.mjs::published API records render unchanged through browser search',
  ]);
  assert.deepEqual(result.requiredVisualGroupIds, []);
});

test('R5 protected shadow planner accepts exactly the three bounded canary routes', () => {
  for (const changedPath of [
    'tools/fullworld-layers/verify_authority_registry.py',
    'web/fullworld-farm-explorer.mjs',
    'tools/build-semantic-search-index.py',
  ]) {
    assert.doesNotThrow(() => planShadow({ candidate: r5Candidate(changedPath), root, protectedRoot: root }), changedPath);
  }
});

test('R5 bounded semantic publication derives from one exact authenticated Game source byte', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-r5-semantic-'));
  fs.rmSync(directory, { recursive: true, force: true });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const sourceBytes = r5SemanticSourceBytes();
  const publication = await buildR5SemanticPublication(directory, sourceBytes);
  const manifest = publication.manifest;
  assert.equal(manifest.sourceDigests[R5_SEMANTIC_SOURCE.id], R5_SEMANTIC_SOURCE.digest);
  assert.equal(publication.selected.source.repository, 'Oteryn/Oteryn-Game');
  assert.equal(publication.selected.source.revision, R5_SEMANTIC_SOURCE.revision);
  const index = JSON.parse(fs.readFileSync(path.join(directory, 'web/semantic-search/index.json'), 'utf8'));
  assert.equal(index.source.game_revision, R5_SEMANTIC_SOURCE.revision);
  assert.equal(index.records.length, 2);
  assert.doesNotThrow(() => verifyR5SemanticProduct(publication.selectedFiles));
  const tampered = { ...publication.selectedFiles, sourceBytes: Buffer.from('{}\n') };
  assert.throws(() => verifyR5SemanticProduct(tampered), /source bytes do not match/);

  const planned = planShadow({ candidate: r5Candidate('tools/build-semantic-search-index.py'), root, protectedRoot: root });
  const fixture = createPublicationProofFixtures(['qualification_fixture']);
  const contract = resolveExecutionContract({ ...planned.input, environmentDigest: 'd'.repeat(64),
    publicationProofs: { qualification_fixture: fixture.publicationProofs.qualification_fixture },
    protectedExpectedAuthorities: { qualification_fixture: fixture.protectedExpectedAuthorities.qualification_fixture },
    selectedSemanticFiles: publication.selectedFiles,
  });
  assert.equal(contract.commands.length, 5);
  assert.deepEqual(contract.commands.map(({ engine, dataCapability }) => `${engine}:${dataCapability}`).sort(), [
    'deterministic:qualification_fixture',
    'deterministic:qualification_fixture',
    'deterministic:qualification_fixture',
    'deterministic:qualification_fixture',
    'playwright:bounded_real_world',
  ]);
  const oracle = contract.commands.find(({ executionScope }) => executionScope === 'protected-harness');
  assert.deepEqual(oracle.groupIds, ['deterministic.search']);
  assert.deepEqual(oracle.argv, ['node', '/protected-harness/r5-semantic-builder-oracle.mjs']);
  assert.deepEqual(oracle.expectedTestIds, ['protected-oracle::tools/build-semantic-search-index.py::selected semantic product']);
  assert.match(oracle.protectedHarnessDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(oracle.protectedInputDigest, 'sha256:3075f42ee1b5502a10d23ec2df9171f9ef829158d82c9bba8ab9bb91abc654bc');
  const harnessFile = path.join(directory, 'oracle.mjs');
  fs.writeFileSync(harnessFile, R5_SEMANTIC_BUILDER_ORACLE);
  const inputFile = path.join(root, 'tests/fixtures/game-semantic-search-source.json');
  const dockerArgs = deterministicDockerArgs({ command: oracle, candidateRoot: root,
    dependencyRoot: path.join(root, 'e2e/node_modules'), shimRoot: directory, protectedHarnessFile: harnessFile, protectedInputFile: inputFile,
    image: `example.invalid/atlas@sha256:${'a'.repeat(64)}`, containerName: 'atlas-r5-oracle-test' });
  assert.ok(dockerArgs.includes(`type=bind,src=${harnessFile},dst=/protected-harness/r5-semantic-builder-oracle.mjs,readonly`));
  assert.ok(dockerArgs.includes(`type=bind,src=${inputFile},dst=/protected-input/game-semantic-search-source.json,readonly`));
  fs.appendFileSync(harnessFile, '// drift\n');
  assert.throws(() => deterministicDockerArgs({ command: oracle, candidateRoot: root,
    dependencyRoot: path.join(root, 'e2e/node_modules'), shimRoot: directory, protectedHarnessFile: harnessFile, protectedInputFile: inputFile,
    image: `example.invalid/atlas@sha256:${'a'.repeat(64)}`, containerName: 'atlas-r5-oracle-test' }), /protected harness inputs/);
});

test('bounded builder rejects a claimed source digest without the exact source bytes', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-r5-semantic-bad-'));
  fs.rmSync(directory, { recursive: true, force: true });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  await assert.rejects(buildR5SemanticPublication(directory, Buffer.from('{}\n')), /R5 semantic source bytes/);
});

test('R5 selected source authenticates the exact commit and revision:path blob binding', () => {
  const bytes = r5SemanticSourceBytes();
  const commit = { sha: R5_SEMANTIC_SOURCE.revision, tree: { sha: sha('d') } };
  const file = {
    type: 'file', path: R5_SEMANTIC_SOURCE.path, name: path.posix.basename(R5_SEMANTIC_SOURCE.path),
    sha: R5_SEMANTIC_SOURCE.blob, size: bytes.length, encoding: 'base64', content: bytes.toString('base64'),
  };
  assert.deepEqual(authenticateR5SemanticSource({ commit, file }), bytes);
  for (const [label, mutate] of [
    ['revision', ({ commit: value }) => { value.sha = sha('e'); }],
    ['path', ({ file: value }) => { value.path = `other/${value.name}`; }],
    ['blob', ({ file: value }) => { value.sha = sha('f'); }],
    ['bytes', ({ file: value }) => { value.content = Buffer.from('{}\n').toString('base64'); }],
  ]) {
    const value = { commit: structuredClone(commit), file: structuredClone(file) };
    mutate(value);
    assert.throws(() => authenticateR5SemanticSource(value), /R5 semantic/, label);
  }
});

test('R5 protected harness executes only the candidate builder and enforces exact product bytes', () => {
  assert.equal(`sha256:${createHash('sha256').update(R5_SEMANTIC_BUILDER_ORACLE).digest('hex')}`, R5_SEMANTIC_BUILDER_ORACLE_DIGEST);
  const localHarness = R5_SEMANTIC_BUILDER_ORACLE
    .replaceAll('/candidate', root.replace(/\/$/, ''))
    .replace('/protected-input/game-semantic-search-source.json', path.join(root, 'tests/fixtures/game-semantic-search-source.json'));
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', localHarness], {
    cwd: root, env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', HOME: os.tmpdir() }, encoding: 'utf8', shell: false, timeout: 30_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"oracle":"r5-semantic-candidate-builder","passed":true/);
});

import {assertDeterministicContainer} from '../../tools/verification/run-verification-shadow.mjs';
{
const repository='Oteryn/Oteryn-Atlas',base='a'.repeat(40),head='b'.repeat(40),tree='c'.repeat(40);
const root=fileURLToPath(new URL('../../',import.meta.url));
function fixture(){
 const repo={full_name:repository,default_branch:'main'};
 const headRef='refs/heads/gh-readonly-queue/main/pr-7-deadbeef';
 const responses={
  [`/repos/${repository}/git/ref/heads/main`]:{object:{sha:base}},
  [`/repos/${repository}/git/commits/${head}`]:{sha:head,tree:{sha:tree},parents:[{sha:base},{sha:'d'.repeat(40)}]},
 };
 const event={repository:repo,action:'checks_requested',merge_group:{base_ref:'refs/heads/main',base_sha:base,head_ref:headRef,head_sha:head}};
 return {responses,input:{eventName:'merge_group',event,githubSha:head,githubRef:headRef,request:async url=>{assert.ok(responses[url],url);return structuredClone(responses[url]);}}};
}
test('MQ source comes from protected merge_group and binds exact queue identity before or just after integration',async()=>{
 const f=fixture();let result=await resolveShadowEvent(f.input);assert.equal(result.baseSha,base);assert.equal(result.headSha,head);assert.equal(result.parentRunId,null);assert.equal(result.treeSha,tree);
 f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha=head;
 result=await resolveShadowEvent(f.input);assert.equal(result.baseSha,base);assert.equal(result.headSha,head);
});
test('MQ unrelated protected-main drift cannot impersonate a protected source',async()=>{const f=fixture();f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha='e'.repeat(40);await assert.rejects(resolveShadowEvent(f.input),/protected base moved/);});
test('MQ spoofed direct event, queue ref, head, tree or parent topology reject',async()=>{
 const mutations=[f=>f.input.event.action='destroyed',f=>{f.input.event.merge_group.base_ref='refs/heads/other';},f=>{f.input.event.merge_group.head_ref='refs/heads/feature/forged';f.input.githubRef=f.input.event.merge_group.head_ref;},f=>{f.input.githubRef='refs/heads/gh-readonly-queue/main/pr-8-forged';},f=>{f.input.githubSha='d'.repeat(40);},f=>{f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha='d'.repeat(40);},f=>{f.responses[`/repos/${repository}/git/commits/${head}`].tree.sha='bad';},f=>{f.responses[`/repos/${repository}/git/commits/${head}`].parents=[];},f=>{f.responses[`/repos/${repository}/git/commits/${head}`].parents=[{sha:'d'.repeat(40)}];}];
 for(const mutate of mutations){const f=fixture();mutate(f);await assert.rejects(resolveShadowEvent(f.input));}
});
test('PR source rejects fork, stale base and candidate workflow revision',async()=>{
 const f=fixture();f.input.eventName='pull_request_target';f.input.githubSha=base;f.input.event={repository:f.input.event.repository,action:'synchronize',pull_request:{number:7,base:{sha:base,ref:'main',repo:{full_name:repository}},head:{sha:head,repo:{full_name:repository}}}};
 assert.equal((await resolveShadowEvent(f.input)).prNumber,7);
 for(const mutate of [x=>x.event.pull_request.head.repo.full_name='Other/Fork',x=>x.event.pull_request.base.sha=head,x=>x.githubSha=head]){const input=structuredClone({...f.input,request:undefined});input.request=f.input.request;mutate(input);await assert.rejects(resolveShadowEvent(input));}
});
test('S0 plans zero groups and S2/S3 select only their narrow protected owners',()=>{
 const candidate={repository,prNumber:7,baseSha:base,headSha:head,treeSha:tree,changedFiles:[{path:'docs/ordinary.md',status:'modified'}]};
 const plan=name=>{candidate.changedFiles=[{path:name,status:'modified'}];return planShadow({candidate,root,protectedRoot:root}).plan;};
 assert.deepEqual(plan('docs/ordinary.md').groups,[]);
 assert.deepEqual(plan('e2e/tests/layer-audit-desktop.spec.mjs').groups.map(g=>g.id),['e2e.layer-availability']);
 assert.deepEqual(plan('e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs').groups.map(g=>g.id),['integration.source-contract-http']);
 assert.throws(()=>plan('e2e/tests/soak-desktop.spec.mjs'),/bounded executor unavailable/);
});
test('deterministic runner has exact command and readonly credential-free mounts with bounded isolation',()=>{
 const command={id:'sha256:'+'a'.repeat(64),engine:'deterministic',cwd:'.',argv:['node','--test','tests/example.mjs']};
 const input={command,candidateRoot:'/candidate-source',dependencyRoot:'/protected-deps',shimRoot:'/python-shim',containerName:'atlas-r4-example',image:'image@sha256:'+'b'.repeat(64)};
 const args=deterministicDockerArgs(input);
 assert.deepEqual(args.slice(-3),command.argv);
 for(const flag of ['--network=none','--read-only','--user=1000:1000','--cap-drop=ALL','--security-opt=no-new-privileges'])assert.ok(args.includes(flag));
 assert.ok(args.filter(x=>x.startsWith('type=bind')).every(x=>x.endsWith(',readonly')));
 assert.ok(!args.some(x=>/TOKEN|docker.sock|protected-control/.test(x)));
 assert.throws(()=>deterministicDockerArgs({...input,command:{...command,argv:['sh','-c','true']}}));
});

test('actual container evidence rejects extra writable mounts, capabilities, credentials and argv drift',()=>{
 const command={argv:['node','--test','tests/example.mjs']};
 const input={command,candidateRoot:'/subject',dependencyRoot:'/deps',shimRoot:'/shim',image:'image@sha256:'+'b'.repeat(64)};
 const container={Config:{Image:input.image,User:'1000:1000',WorkingDir:'/candidate',Env:['HOME=/tmp']},
 HostConfig:{NetworkMode:'none',ReadonlyRootfs:true,Privileged:false,CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PidsLimit:192,Memory:1610612736,NanoCpus:2000000000,Tmpfs:{'/tmp':'rw,nodev,nosuid,size=256m'}},
 State:{Running:false,OOMKilled:false},Path:'node',Args:command.argv.slice(1),Mounts:[{Type:'bind',RW:false,Source:'/subject',Destination:'/candidate'},{Type:'bind',RW:false,Source:'/deps',Destination:'/candidate/e2e/node_modules'},{Type:'bind',RW:false,Source:'/shim',Destination:'/tmp/atlas-python-bin'}]};
 assert.equal(assertDeterministicContainer(container,input),true);
 for(const mutate of [x=>x.Mounts[0].RW=true,x=>x.Mounts.push({Type:'bind',RW:false,Source:'/var/run/docker.sock',Destination:'/socket'}),x=>x.HostConfig.Privileged=true,x=>x.HostConfig.CapDrop=[],x=>x.HostConfig.SecurityOpt=[],x=>x.HostConfig.PidsLimit=0,x=>x.Config.Env.push('GH_TOKEN=fake'),x=>x.Args.push('--test-only'),x=>x.State.Running=true]){const bad=structuredClone(container);mutate(bad);assert.throws(()=>assertDeterministicContainer(bad,input));}
});
}

import {prepareExecutionView,verifyExecutionView,assertContainerStarted} from '../../tools/verification/run-verification-shadow.mjs';
test('execution view preserves tracked bytes/modes and Git identity while isolating the dependency mountpoint',t=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-execution-view-test-'));t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
 const sourceRoot=path.join(temporary,'source'),destination=path.join(temporary,'view');fs.mkdirSync(sourceRoot);
 const git=(...args)=>{const r=spawnSync('git',['-C',sourceRoot,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
 fs.mkdirSync(path.join(sourceRoot,'e2e'));fs.writeFileSync(path.join(sourceRoot,'e2e/package.json'),'{}\n');fs.writeFileSync(path.join(sourceRoot,'run.sh'),'#!/bin/sh\nexit 0\n',{mode:0o755});
 git('add','.');git('commit','-m','fixture');const revision=git('rev-parse','HEAD');
 prepareExecutionView({sourceRoot,revision,destination});
 const input={viewRoot:destination,sourceRoot,revision};assert.equal(verifyExecutionView(input),true);
 assert.equal(fs.existsSync(path.join(sourceRoot,'e2e/node_modules')),false);assert.equal(git('status','--porcelain'),'');
 const copyGit=spawnSync('git',['-C',destination,'rev-parse','HEAD'],{encoding:'utf8'});assert.equal(copyGit.stdout.trim(),revision);
 const target=path.join(destination,'run.sh'),original=fs.readFileSync(target);
 fs.writeFileSync(target,'mutated');assert.throws(()=>verifyExecutionView(input),/bytes or mode/);fs.writeFileSync(target,original);
 fs.chmodSync(target,0o644);assert.throws(()=>verifyExecutionView(input),/bytes or mode/);fs.chmodSync(target,0o755);
 fs.writeFileSync(path.join(destination,'extra'),'extra');assert.throws(()=>verifyExecutionView(input),/unexpected execution view/);fs.unlinkSync(path.join(destination,'extra'));
 fs.symlinkSync('/etc/passwd',path.join(destination,'link'));assert.throws(()=>verifyExecutionView(input),/symlink/);fs.unlinkSync(path.join(destination,'link'));
 fs.writeFileSync(path.join(destination,'e2e/node_modules/extra'),'extra');assert.throws(()=>verifyExecutionView(input),/unexpected execution view/);fs.unlinkSync(path.join(destination,'e2e/node_modules/extra'));
 fs.unlinkSync(target);assert.throws(()=>verifyExecutionView(input),/census/);
 fs.writeFileSync(path.join(sourceRoot,'run.sh'),'source mutation');assert.throws(()=>prepareExecutionView({sourceRoot,revision,destination:path.join(temporary,'other')}),/cleanliness/);
});
test('Docker startup failures expose bounded diagnostics and never attest executed specs',()=>{
 const started={State:{StartedAt:'2026-09-08T00:00:00.000Z',Error:'',ExitCode:1}};
 assert.equal(assertContainerStarted(started,{status:1}),true);
 for(const container of [null,{State:{StartedAt:'0001-01-01T00:00:00Z',Error:'mount destination missing',ExitCode:125}},{State:{...started.State,Error:'mount failed'}}]) {
  assert.throws(()=>assertContainerStarted(container,{status:125,stderr:'x'.repeat(10000)+' DIAGNOSTIC_TAIL'}),error=>error.message.includes('no specs executed')&&error.message.includes('DIAGNOSTIC_TAIL')&&error.message.length<5000);
 }
 assert.throws(()=>assertContainerStarted(started,{status:125}),/never started/);
});

import {buildVerificationPlan} from '../../tools/verification/build-verification-plan.mjs';
test('authenticated self-only subjects compose with docs, another subject and HTTP without claiming core',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-subject-composition-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'tests'),path.join(directory,'tests'),{recursive:true});
 const first='tests/new-subject.mjs',second='tests/second-subject.py';
 fs.writeFileSync(path.join(directory,first),"import test from 'node:test';test('subject',()=>{});\n");fs.writeFileSync(path.join(directory,second),'assert True\n');
 const base=executionInput(first);base.root=directory;base.protectedRoot=root;
 base.protectedStableTestIds=JSON.parse(fs.readFileSync(path.join(root,'tools/verification/protected-scenario-inventory.json'))).stableTestIds;
 Object.assign(base,createPublicationProofFixtures());
 function input(extra=[]){const value={...base,candidate:{...base.candidate,changedFiles:[{path:first,status:'added'},...extra].sort((a,b)=>a.path.localeCompare(b.path))}};value.planInput={...base.planInput,changedFiles:value.candidate.changedFiles};return value;}
 for(const [extra,count] of [[[],1],[[{path:'docs/example.md',status:'added'}],1],[[{path:second,status:'added'}],2],[[{path:'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs',status:'modified'}],2]]) {
  const value=input(extra),contract=resolveExecutionContract(value);
  assert.equal(contract.commands.length,count);
  assert.ok(!contract.groups.some(group=>group.id==='deterministic.core'));
  assert.equal(contract.candidateTestSubjects.length,extra.some(row=>row.path===second)?2:1);
  for(const subject of contract.candidateTestSubjects)assert.deepEqual(contract.commands.find(command=>command.id===subject.commandId).expectedTestIds,[subject.spec]);
 }
 const actualCore=resolveExecutionContract(input([{path:'tests/verification/artifacts.test.mjs',status:'modified'}]));
 assert.equal(actualCore.commands.filter(command=>command.groupIds.includes('deterministic.core')).length,140);
 assert.equal(actualCore.commands.length,141);
 assert.equal(actualCore.candidateTestSubjects.length,1);
 const subjectOnly=resolveExecutionContract(input());
 const forged=structuredClone(subjectOnly);forged.candidateTestSubjects[0].spec='tests/../outside.mjs';assert.throws(()=>sealExecutionContract(forged),/subject/);
 const traversal=structuredClone(subjectOnly);traversal.candidateTestSubjects[0].spec='tests/../outside.mjs';traversal.commands[0].expectedTestIds=['tests/../outside.mjs'];traversal.commands[0].argv=['node','--test','tests/../outside.mjs'];assert.throws(()=>sealExecutionContract(traversal),/subject shape/);
 const unknownScope=structuredClone(subjectOnly);unknownScope.commands[0].executionScope='candidate-approved';assert.throws(()=>sealExecutionContract(unknownScope),/execution scope/);
 const hidden=structuredClone(subjectOnly);hidden.candidateTestSubjects=[];assert.throws(()=>sealExecutionContract(hidden),/conservation/);
 const grouped=structuredClone(subjectOnly);grouped.commands[0].groupIds=['deterministic.core'];assert.throws(()=>sealExecutionContract(grouped),/subject/);
 const claimed=planShadow({candidate:input().candidate,root:directory,protectedRoot:root}).plan;
 assert.deepEqual(claimed.groups,[]);assert.deepEqual(claimed.candidateTestSubjects,[first]);
 const malicious=structuredClone(claimed);malicious.candidateTestSubjects=[];assert.throws(()=>resolveExecutionContract({...input(),claimedPlan:malicious}),/recomputed plan/);
 const ignored=input();ignored.planInput.candidateTestSubjects=[];assert.equal(resolveExecutionContract(ignored).commands.length,1);
 const planInput={...base.planInput,changedFiles:[{path:first,status:'added'}],trustedVerificationCatalog:base.protectedCatalog,candidateVerificationCatalog:base.protectedCatalog,trustedImpactManifest:base.protectedImpactManifest,candidateImpactManifest:base.protectedImpactManifest,unprivilegedDeterministicSubjects:[first],protectedStableTestIds:base.protectedStableTestIds};
 const floor=buildVerificationPlan({...planInput,requiredGroupFloor:['deterministic.core']});assert.ok(floor.requiredGroupIds.includes('deterministic.core'));assert.deepEqual(floor.candidateTestSubjects,[first]);
 const samePathManifest=structuredClone(base.protectedImpactManifest);
 samePathManifest.entries.push({pathPrefix:first,exactMatch:true,domains:['subject-semantic'],minimumProfile:'focused',requiredGroups:['deterministic.core']});
 const samePath=buildVerificationPlan({...planInput,trustedImpactManifest:samePathManifest,candidateImpactManifest:base.protectedImpactManifest});
 assert.ok(samePath.requiredGroupIds.includes('deterministic.core'));assert.deepEqual(samePath.candidateTestSubjects,[first]);
 assert.equal(resolveExecutionContract({...input(),protectedImpactManifest:samePathManifest}).commands.length,141);
 const escalatedManifest=structuredClone(base.protectedImpactManifest);
 escalatedManifest.entries.push({pathPrefix:first,exactMatch:true,domains:['subject-semantic'],minimumProfile:'focused',requiredGroups:[]});
 escalatedManifest.crossDomainEscalations.push({id:'subject-core-proof',whenDomains:['subject-semantic','documentation'],minimumProfile:'focused',requiredGroups:['deterministic.core']});
 const escalated=buildVerificationPlan({...planInput,changedFiles:[{path:first,status:'added'},{path:'docs/example.md',status:'added'}],trustedImpactManifest:escalatedManifest,candidateImpactManifest:escalatedManifest});
 assert.ok(escalated.requiredGroupIds.includes('deterministic.core'));assert.deepEqual(escalated.candidateTestSubjects,[first]);
 assert.equal(resolveExecutionContract({...input([{path:'docs/example.md',status:'added'}]),protectedImpactManifest:escalatedManifest}).commands.length,141);
 const renamed=input();renamed.candidate.changedFiles=[{path:first,previousPath:'tests/old-unowned.mjs',status:'renamed'}];renamed.planInput.changedFiles=renamed.candidate.changedFiles;assert.equal(resolveExecutionContract(renamed).commands.length,1);
});

test('real protected shadow plan CLI schedules subject-only work and keeps docs-only S0 empty',t=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-shadow-plan-cli-'));t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
 const control=path.join(temporary,'control'),candidateRoot=path.join(temporary,'candidate');
 const git=(directory,...args)=>{const safeDirectory=path.resolve(directory);const env={...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:safeDirectory};const result=spawnSync('git',['-C',safeDirectory,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8',env});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
 git(root,'-c','core.autocrlf=false','clone','--quiet','--shared',path.resolve(root),control);
 git(control,'config','core.autocrlf','false');git(control,'reset','--hard','HEAD');
 for(const file of ['browser-execution.mjs','build-verification-plan.mjs','deterministic-execution.mjs','verification-execution-contract.mjs','run-verification-shadow.mjs'])fs.copyFileSync(path.join(root,'tools/verification',file),path.join(control,'tools/verification',file));
 const commit=directory=>{git(directory,'add','.');git(directory,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','--allow-empty','-m','Fixture');return git(directory,'rev-parse','HEAD');};
 const base=commit(control);git(control,'clone','--quiet','--shared',control,candidateRoot);
 // Only the external GitHub transport is replaced; real CLI parsing, checkout,
 // diff authentication, planner, output routing and Git checks execute unchanged.
 const preload=path.join(temporary,'github-fixture.mjs');
 fs.writeFileSync(preload,"import cp from 'node:child_process';import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';const original=cp.execFileSync;cp.execFileSync=function(file,args,options){if(file!=='gh')return original(file,args,options);const rows=JSON.parse(fs.readFileSync(process.env.ATLAS_TEST_GITHUB_RESPONSES));if(args[0]!=='api'||!Object.hasOwn(rows,args[1]))throw Error('unexpected GitHub fixture endpoint');return JSON.stringify(rows[args[1]]);};syncBuiltinESMExports();\n");
 for(const [subject,expected] of [['tests/cli-added-subject.mjs',true],['docs/cli-docs-only.md',false]]){
  git(candidateRoot,'reset','--hard',base);fs.writeFileSync(path.join(candidateRoot,subject),'// fixture\n');const head=commit(candidateRoot),tree=git(candidateRoot,'rev-parse','HEAD^{tree}');
  const repository={full_name:'Oteryn/Oteryn-Atlas',default_branch:'main'};
  const pr={number:7,state:'open',merged:false,changed_files:1,base:{sha:base,ref:'main',repo:repository},head:{sha:head,repo:repository}};
  const prefix='/repos/Oteryn/Oteryn-Atlas';
  const responses={ [prefix]:repository,[`${prefix}/git/ref/heads/main`]:{object:{sha:base}},[`${prefix}/pulls/7`]:pr,[`${prefix}/pulls/7/files?per_page=100&page=1`]:[{filename:subject,status:'added'}],[`${prefix}/git/commits/${head}`]:{sha:head,tree:{sha:tree}},[`${prefix}/actions/runs/19`]:{id:19,repository,path:'.github/workflows/verification-shadow.yml',event:'pull_request_target',run_attempt:1,status:'in_progress',head_sha:head}};
  const responseFile=path.join(temporary,'responses.json'),eventFile=path.join(temporary,'event.json'),output=path.join(temporary,expected?'subject-output':'docs-output');
  fs.writeFileSync(responseFile,JSON.stringify(responses));fs.writeFileSync(eventFile,JSON.stringify({repository,action:'synchronize',pull_request:pr}));
  const result=spawnSync(process.execPath,['--import',pathToFileURL(preload).href,path.join(control,'tools/verification/run-verification-shadow.mjs'),'plan',candidateRoot],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:os.tmpdir(),GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'pull_request_target',GITHUB_EVENT_PATH:eventFile,GITHUB_SHA:base,GITHUB_RUN_ID:'19',GITHUB_OUTPUT:output,ATLAS_TEST_GITHUB_RESPONSES:responseFile}});
  assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(output,'utf8'),`has_commands=${expected}\n`);
  const summary=JSON.parse(result.stdout);assert.deepEqual(summary.groups,[]);assert.deepEqual(summary.candidateTestSubjects,expected?[subject]:[]);
  assert.equal(summary.status,expected?'UNRESOLVED':'NO_PRODUCT_WORK');if(!expected)assert.deepEqual(summary.commands,[]);
 }
});
