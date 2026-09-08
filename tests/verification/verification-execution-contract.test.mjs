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

import {resolveShadowEvent,planShadow,deterministicDockerArgs} from '../../tools/verification/run-verification-shadow.mjs';
import {assertDeterministicContainer} from '../../tools/verification/run-verification-shadow.mjs';
{
const repository='Oteryn/Oteryn-Atlas',base='a'.repeat(40),head='b'.repeat(40),tree='c'.repeat(40);
const root=fileURLToPath(new URL('../../',import.meta.url));
function fixture(){
 const repo={full_name:repository,default_branch:'main'};
 const run={id:12,repository:repo,event:'merge_group',path:'.github/workflows/merge-group-gate.yml',conclusion:'success',status:'completed',run_attempt:1,head_sha:head,head_branch:'gh-readonly-queue/main/pr-7'};
 const responses={
  [`/repos/${repository}/git/ref/heads/main`]:{object:{sha:base}},
  [`/repos/${repository}/actions/runs/12`]:run,
  [`/repos/${repository}/git/commits/${head}`]:{sha:head,parents:[{sha:base}]},
 };
 const event={repository:repo,action:'completed',workflow_run:{id:12,head_sha:head}};
 return {run,responses,input:{eventName:'workflow_run',event,githubSha:base,request:async url=>{assert.ok(responses[url],url);return structuredClone(responses[url]);}}};
}
test('MQ source comes from protected workflow_run and binds successful exact parent before or just after integration',async()=>{
 const f=fixture();let result=await resolveShadowEvent(f.input);assert.equal(result.baseSha,base);assert.equal(result.headSha,head);assert.equal(result.parentRunId,12);
 f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha=head;
 assert.equal((await resolveShadowEvent(f.input)).baseSha,base);
 f.input.githubSha=head;
 result=await resolveShadowEvent(f.input);assert.equal(result.baseSha,base);
});
test('MQ rollback pair cannot impersonate a protected source',async()=>{const f=fixture();f.input.githubSha=head;await assert.rejects(resolveShadowEvent(f.input),/base moved/);});
test('MQ spoofed event, workflow path, failed or repeated parent, head and unrelated main drift reject',async()=>{
 const mutations=[f=>f.run.event='pull_request',f=>f.run.path='.github/workflows/other.yml',f=>f.run.conclusion='failure',f=>f.run.run_attempt=2,f=>f.run.head_sha='d'.repeat(40),f=>f.run.head_branch='feature/forged',f=>f.input.event.action='requested',f=>f.input.eventName='merge_group',f=>f.responses[`/repos/${repository}/git/ref/heads/main`].object.sha='d'.repeat(40),f=>f.input.githubSha='d'.repeat(40)];
 for(const mutate of mutations){const f=fixture();mutate(f);await assert.rejects(resolveShadowEvent(f.input));}
});
test('PR source rejects fork, stale base and candidate workflow revision',async()=>{
 const f=fixture();f.input.eventName='pull_request_target';f.input.event={repository:f.input.event.repository,action:'synchronize',pull_request:{number:7,base:{sha:base,ref:'main',repo:{full_name:repository}},head:{sha:head,repo:{full_name:repository}}}};
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
 assert.equal(actualCore.commands.filter(command=>command.groupIds.includes('deterministic.core')).length,149);
 assert.equal(actualCore.commands.length,150);
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
 assert.equal(resolveExecutionContract({...input(),protectedImpactManifest:samePathManifest}).commands.length,150);
 const escalatedManifest=structuredClone(base.protectedImpactManifest);
 escalatedManifest.entries.push({pathPrefix:first,exactMatch:true,domains:['subject-semantic'],minimumProfile:'focused',requiredGroups:[]});
 escalatedManifest.crossDomainEscalations.push({id:'subject-core-proof',whenDomains:['subject-semantic','documentation'],minimumProfile:'focused',requiredGroups:['deterministic.core']});
 const escalated=buildVerificationPlan({...planInput,changedFiles:[{path:first,status:'added'},{path:'docs/example.md',status:'added'}],trustedImpactManifest:escalatedManifest,candidateImpactManifest:escalatedManifest});
 assert.ok(escalated.requiredGroupIds.includes('deterministic.core'));assert.deepEqual(escalated.candidateTestSubjects,[first]);
 assert.equal(resolveExecutionContract({...input([{path:'docs/example.md',status:'added'}]),protectedImpactManifest:escalatedManifest}).commands.length,150);
 const renamed=input();renamed.candidate.changedFiles=[{path:first,previousPath:'tests/old-unowned.mjs',status:'renamed'}];renamed.planInput.changedFiles=renamed.candidate.changedFiles;assert.equal(resolveExecutionContract(renamed).commands.length,1);
});

test('real protected shadow plan CLI schedules subject-only work and keeps docs-only S0 empty',t=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-shadow-plan-cli-'));t.after(()=>fs.rmSync(temporary,{recursive:true,force:true}));
 const control=path.join(temporary,'control'),candidateRoot=path.join(temporary,'candidate');
 const git=(directory,...args)=>{const result=spawnSync('git',['-C',directory,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
 git(root,'clone','--quiet','--shared',root,control);
 for(const file of ['build-verification-plan.mjs','deterministic-execution.mjs','verification-execution-contract.mjs','run-verification-shadow.mjs'])fs.copyFileSync(path.join(root,'tools/verification',file),path.join(control,'tools/verification',file));
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
  const result=spawnSync(process.execPath,['--import',preload,path.join(control,'tools/verification/run-verification-shadow.mjs'),'plan',candidateRoot],{encoding:'utf8',env:{PATH:process.env.PATH,HOME:os.tmpdir(),GITHUB_RUN_ATTEMPT:'1',GITHUB_EVENT_NAME:'pull_request_target',GITHUB_EVENT_PATH:eventFile,GITHUB_SHA:base,GITHUB_RUN_ID:'19',GITHUB_OUTPUT:output,ATLAS_TEST_GITHUB_RESPONSES:responseFile}});
  assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(output,'utf8'),`has_commands=${expected}\n`);
  const summary=JSON.parse(result.stdout);assert.deepEqual(summary.groups,[]);assert.deepEqual(summary.candidateTestSubjects,expected?[subject]:[]);
  assert.equal(summary.status,expected?'UNRESOLVED':'NO_PRODUCT_WORK');if(!expected)assert.deepEqual(summary.commands,[]);
 }
});
