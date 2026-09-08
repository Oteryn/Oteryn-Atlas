import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {assertCandidateReadback, resolveExecutionContract, sealExecutionContract} from '../../tools/verification/verification-execution-contract.mjs';
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

test('unknown paths, candidate command widening and stale claimed plans fail closed',()=>{
 assert.throws(()=>resolveExecutionContract(executionInput('unknown/product.mjs')),/unresolved obligations/);
 const input=executionInput();input.planInput.candidateVerificationCatalog=structuredClone(input.protectedCatalog);
 input.planInput.candidateVerificationCatalog.groups['deterministic.search'].specs.push('tests/creature-gameplay-model.mjs');
 assert.throws(()=>resolveExecutionContract(input),/protected execution group/);
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
test('candidate-only owner cannot become protected execution authority',()=>{
 const input=executionInput('tests/new-candidate.mjs');
 input.planInput.candidateVerificationCatalog=structuredClone(input.protectedCatalog);
 input.planInput.candidateVerificationCatalog.groups['deterministic.search'].specs.push('tests/new-candidate.mjs');
 assert.throws(()=>resolveExecutionContract(input),/unresolved obligations/);
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
