import {createHash} from 'node:crypto';
import {canonicalJson, validateVerificationCatalog} from './verification-plan-schema.mjs';
import {buildVerificationPlan, assertPlanExecutable} from './build-verification-plan.mjs';
import {deriveVerificationMetadata} from './verification-metadata.mjs';
import {resolveDeterministicCommands} from './deterministic-execution.mjs';
import {R5_SEMANTIC_SOURCE, resolveBrowserExecution, verifyR5SemanticProduct} from './browser-execution.mjs';

export {R5_SEMANTIC_SOURCE, verifyR5SemanticProduct};

const fail = message => { throw new TypeError(`execution contract: ${message}`); };
const equal = (left,right,label) => { if(canonicalJson(left)!==canonicalJson(right)) fail(`${label} mismatch`); };
const hash = value => `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
const sha = value => /^[a-f0-9]{40}$/.test(value ?? '');
const digest = value => /^sha256:[a-f0-9]{64}$/.test(value ?? '');
const deterministicTest = value => typeof value==='string'&&/^tests\/[A-Za-z0-9_./-]+\.(mjs|py)$/.test(value)&&!value.split('/').some(part=>!part||part==='.'||part==='..');
const freeze = value => {if(value && typeof value==='object' && !Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

export const R5_SEMANTIC_BUILDER_ORACLE = `import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const source='/protected-input/game-semantic-search-source.json';
const output='/tmp/r5-semantic-index.json';
const sourceBytes=fs.readFileSync(source);
assert.equal(sourceBytes.length,2465);
assert.equal(sha256(sourceBytes),'3075f42ee1b5502a10d23ec2df9171f9ef829158d82c9bba8ab9bb91abc654bc');
const revision='54f19765c07e3b33ce2d9c10ad57df4818434a52';
const result=spawnSync('/usr/bin/python3',['-I','-B','/candidate/tools/build-semantic-search-index.py',source,output,'--game-revision',revision],{cwd:'/candidate',env:{LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:'/tmp'},encoding:'utf8',shell:false,timeout:30000,maxBuffer:1048576});
assert.equal(result.error,undefined);
assert.equal(result.signal,null);
assert.equal(result.status,0,result.stderr);
const bytes=fs.readFileSync(output);
assert.equal(bytes.length,3405);
assert.equal(sha256(bytes),'080518a6ef859b1e277f2305178faee8a76e22e247266f8950c1feb66d02a3e6');
const value=JSON.parse(bytes);
assert.equal(value.source.game_revision,revision);
assert.equal(value.source.semantic_digest,'sha256:a4a4703962bd6984d31ef1dafcd27bad475d6b61f570d013560c16a704989bf8');
assert.deepEqual(value.records.map(({id})=>id),['npc:726487438c8308abf291622a52d91b24','semantic-record:23716a35099a04179f7b9e3e6c9198ee']);
process.stdout.write(JSON.stringify({oracle:'r5-semantic-candidate-builder',passed:true,sourceSha256:sha256(sourceBytes),outputSha256:sha256(bytes)})+'\\n');
`;
export const R5_SEMANTIC_BUILDER_ORACLE_DIGEST = `sha256:${createHash('sha256').update(R5_SEMANTIC_BUILDER_ORACLE).digest('hex')}`;
export const R5_SEMANTIC_BUILDER_ORACLE_TEST_ID = 'protected-oracle::tools/build-semantic-search-index.py::selected semantic product';
const R5_SEMANTIC_BUILDER_PATH = 'tools/build-semantic-search-index.py';

function normalizedSnapshot(value) {
  if(!value || value.repository!=='Oteryn/Oteryn-Atlas' || !['headSha','baseSha','treeSha'].every(key=>sha(value[key]))) fail('candidate readback identity');
  if(value.prNumber!==null && (!Number.isSafeInteger(value.prNumber)||value.prNumber<1)) fail('candidate readback PR');
  if(!Array.isArray(value.changedFiles)||!value.changedFiles.length) fail('candidate readback changed-file census');
  const seen=new Set();
  const changedFiles=value.changedFiles.map(row=>{
    if(!row || !['added','modified','removed','renamed'].includes(row.status)) fail('candidate readback status');
    if((row.status==='renamed') !== (typeof row.previousPath==='string')) fail('candidate readback rename');
    for(const path of [row.path,row.previousPath].filter(path=>path!==undefined)) if(typeof path!=='string'||path.startsWith('/')||path.includes('\\')||path.split('/').some(x=>!x||x==='.'||x==='..')) fail('candidate readback path');
    if(seen.has(row.path)) fail('candidate readback duplicate path');seen.add(row.path);
    return {path:row.path,status:row.status,...(row.previousPath?{previousPath:row.previousPath}:{})};
  }).sort((a,b)=>a.path.localeCompare(b.path));
  return {repository:value.repository,prNumber:value.prNumber,headSha:value.headSha,baseSha:value.baseSha,treeSha:value.treeSha,changedFiles};
}

function unprivilegedDeterministicSubjects(changedFiles) {
  const result=new Set();
  for(const row of changedFiles) {
    if(['added','modified'].includes(row.status)&&deterministicTest(row.path)) result.add(row.path);
    if(row.status==='renamed') {
      const touches=deterministicTest(row.path)||deterministicTest(row.previousPath);
      if(!touches) continue;
      if(!deterministicTest(row.path)||!deterministicTest(row.previousPath)||row.path.slice(row.path.lastIndexOf('.'))!==row.previousPath.slice(row.previousPath.lastIndexOf('.'))) fail(`unsafe deterministic rename: ${row.previousPath} -> ${row.path}`);
      result.add(row.previousPath);result.add(row.path);
    }
  }
  return [...result].sort();
}

export function assertCandidateReadback({planned,current,sourceRepository,sourceRef,sourceRevision}) {
  const expected=normalizedSnapshot(planned),actual=normalizedSnapshot(current);
  if(sourceRepository!==expected.repository||sourceRef!=='refs/heads/main'||sourceRevision!==expected.baseSha) fail('protected source identity');
  equal(actual,expected,'candidate readback');return true;
}

export function sealExecutionContract(value) {
  if(!value || value.schemaVersion!==1 || !value.identity || !Array.isArray(value.commands)||!Array.isArray(value.reviews)||!Array.isArray(value.groups)||!Array.isArray(value.candidateTestSubjects)) fail('contract shape');
  if(Object.keys(value.identity).sort().join(',')!==['repository','headSha','protectedBaseSha','treeSha','candidateDigest','planDigest','policyDigest','environmentDigest'].sort().join(',')||value.identity.repository!=='Oteryn/Oteryn-Atlas'||!sha(value.identity.headSha)||!sha(value.identity.protectedBaseSha)||!sha(value.identity.treeSha)||!digest(value.identity.candidateDigest)||!digest(value.identity.planDigest)||!digest(value.identity.policyDigest)||!/^[a-f0-9]{64}$/.test(value.identity.environmentDigest??'')) fail('contract identity');
  if(Object.keys(value).some(key=>!['schemaVersion','identity','commands','groups','reviews','candidateTestSubjects','contractDigest'].includes(key))) fail('contract shape');

  if(new Set(value.commands.map(c=>c.id)).size!==value.commands.length || new Set(value.groups.map(g=>g.id)).size!==value.groups.length) fail('contract duplicate command/group');
  for(const command of value.commands) {
    if(command.executionScope!==undefined&&!['candidate-self-only','protected-harness'].includes(command.executionScope))fail('contract execution scope');
    if(!digest(command.id)||!Array.isArray(command.expectedTestIds)||!command.expectedTestIds.length||new Set(command.expectedTestIds).size!==command.expectedTestIds.length) fail('contract exact test census');
    if(!Array.isArray(command.argv)||!command.argv.length||!Number.isSafeInteger(command.timeoutSeconds)||command.timeoutSeconds<1) fail('contract executable command');
    if(command.executionScope==='protected-harness') {
      if(command.engine!=='deterministic'||canonicalJson(command.groupIds)!==canonicalJson(['deterministic.search'])
        ||canonicalJson(command.expectedTestIds)!==canonicalJson([R5_SEMANTIC_BUILDER_ORACLE_TEST_ID])
        ||canonicalJson(command.argv)!==canonicalJson(['node','/protected-harness/r5-semantic-builder-oracle.mjs'])
        ||command.protectedHarnessDigest!==R5_SEMANTIC_BUILDER_ORACLE_DIGEST
        ||command.protectedInputDigest!=='sha256:3075f42ee1b5502a10d23ec2df9171f9ef829158d82c9bba8ab9bb91abc654bc') fail('contract protected harness');
    }
  }
  for(const group of value.groups) {
    if(typeof group.id!=='string'||!group.id||!Array.isArray(group.commandIds)||!group.commandIds.length||new Set(group.commandIds).size!==group.commandIds.length||group.commandIds.some(id=>!value.commands.some(c=>c.id===id))) fail('contract group command conservation');
  }
  const subjects=value.candidateTestSubjects;
  if(new Set(subjects.map(row=>row.spec)).size!==subjects.length||new Set(subjects.map(row=>row.commandId)).size!==subjects.length)fail('contract subject census');
  for(const subject of subjects){
    if(Object.keys(subject).sort().join(',')!=='commandId,spec'||!deterministicTest(subject.spec))fail('contract subject shape');
    const command=value.commands.find(row=>row.id===subject.commandId);
    if(!command||command.engine!=='deterministic'||command.executionScope!=='candidate-self-only'||command.groupIds.length||canonicalJson(command.expectedTestIds)!==canonicalJson([subject.spec])||canonicalJson(command.argv)!==canonicalJson(subject.spec.endsWith('.py')?['python3',subject.spec]:['node','--test',subject.spec]))fail('contract subject execution conservation');
  }
  if(value.commands.some(command=>command.executionScope==='candidate-self-only'?value.groups.some(group=>group.commandIds.includes(command.id))||!subjects.some(row=>row.commandId===command.id):!value.groups.some(group=>group.commandIds.includes(command.id)))) fail('contract group command conservation');
  if(new Set(value.reviews.map(review=>review.groupId)).size!==value.reviews.length) fail('contract duplicate review group');
  for(const review of value.reviews) {
    const group=value.groups.find(group=>group.id===review.groupId);
    if(!group) fail('contract visual group conservation');
    if(!Array.isArray(review.frames)||!review.frames.length||!Array.isArray(review.commandIds)||!review.commandIds.length||review.commandIds.some(id=>!value.commands.some(c=>c.id===id))) fail('contract visual conservation');
    if(new Set(review.frames.map(frame=>frame.frameId)).size!==review.frames.length||review.frames.some(frame=>typeof frame.frameId!=='string'||!frame.frameId||typeof frame.stableTestId!=='string'||!frame.stableTestId)) fail('contract visual frame census');
    equal([...review.commandIds].sort(),[...group.commandIds].sort(),'contract visual command conservation');
  }
  const copy=structuredClone(value);delete copy.contractDigest;
  return freeze({...copy,contractDigest:hash(copy)});
}

// Only a protected-base caller may supply policy, census and source authority.
// Candidate metadata is not current execution authority; authenticated candidate
// test paths may only widen execution as unprivileged test subjects.
export function resolveExecutionContract({root, protectedRoot, candidate, planInput, claimedPlan,
  protectedCatalog, protectedImpactManifest, protectedStableTestIds,
  environmentDigest, publicationProofs, protectedExpectedAuthorities, selectedGameplayFiles, selectedSemanticFiles}) {
  const snapshot=normalizedSnapshot(candidate);
  if(!/^[a-f0-9]{64}$/.test(environmentDigest??'')) fail('environment digest');
  if(planInput?.repository!==snapshot.repository || planInput.headSha!==snapshot.headSha || planInput.integrationBaseSha!==snapshot.baseSha) fail('plan candidate identity');
  equal(planInput.changedFiles,snapshot.changedFiles,'plan candidate changed files');
  const subjects=unprivilegedDeterministicSubjects(snapshot.changedFiles);
  const plan=buildVerificationPlan({...planInput,trustedVerificationCatalog:protectedCatalog,candidateVerificationCatalog:protectedCatalog,
    trustedImpactManifest:protectedImpactManifest,candidateImpactManifest:protectedImpactManifest,
    unprivilegedDeterministicSubjects:subjects,protectedStableTestIds,stableTestIds:undefined});
  if(claimedPlan) equal(claimedPlan,plan,'recomputed plan');
  assertPlanExecutable(plan);
  const metadata=deriveVerificationMetadata(protectedCatalog);
  const protectedGroups=validateVerificationCatalog(protectedCatalog).groups;
  for(const {id,...group} of plan.groups) {
    if(!protectedGroups[id]) fail(`unprotected execution group ${id}`);
    const semantic=value=>Object.fromEntries(Object.entries(value).map(([key,field])=>[key,Array.isArray(field)?[...field].sort():field]));
    equal(semantic(group),semantic(protectedGroups[id]),`protected execution group ${id}`);
  }
  const identity={repository:snapshot.repository,headSha:snapshot.headSha,protectedBaseSha:snapshot.baseSha,
    treeSha:snapshot.treeSha,candidateDigest:hash(snapshot),planDigest:hash(plan),policyDigest:hash({protectedCatalog,protectedImpactManifest,protectedStableTestIds:protectedStableTestIds??[]}),environmentDigest};
  const commands=[],reviews=[],groups=[],candidateTestSubjects=[];
  const deterministic=plan.groups.filter(group=>group.executionEngine==='deterministic').map(group=>group.id);
  if(deterministic.length||plan.candidateTestSubjects.length) {
    const resolved=resolveDeterministicCommands({root,protectedRoot,catalog:metadata.deterministic.proposedCatalog,ownership:metadata.deterministic,groupIds:deterministic,changedFiles:snapshot.changedFiles});
    for(const command of resolved) {
      const entry={...(command.executionScope?{executionScope:command.executionScope}:{}),argv:[command.interpreter,...command.argv],cwd:'.',engine:'deterministic',groupIds:command.groupIds,
        expectedTestIds:command.coveredSpecs,resourceClass:'cpu-light',dataCapability:'qualification_fixture',timeoutSeconds:900};
      const id=hash({identity,...entry});commands.push({...entry,id});
      if(command.executionScope==='candidate-self-only')candidateTestSubjects.push({spec:command.executionPath,commandId:id});
    }
  }
  if(snapshot.changedFiles.some(row=>row.path===R5_SEMANTIC_BUILDER_PATH||row.previousPath===R5_SEMANTIC_BUILDER_PATH)) {
    if(!deterministic.includes('deterministic.search')) fail('semantic builder oracle lost protected group');
    const entry={executionScope:'protected-harness',argv:['node','/protected-harness/r5-semantic-builder-oracle.mjs'],cwd:'.',engine:'deterministic',
      groupIds:['deterministic.search'],expectedTestIds:[R5_SEMANTIC_BUILDER_ORACLE_TEST_ID],resourceClass:'cpu-light',dataCapability:'qualification_fixture',timeoutSeconds:900,
      protectedHarnessDigest:R5_SEMANTIC_BUILDER_ORACLE_DIGEST,protectedInputDigest:'sha256:3075f42ee1b5502a10d23ec2df9171f9ef829158d82c9bba8ab9bb91abc654bc'};
    commands.push({...entry,id:hash({identity,...entry})});
  }
  equal(candidateTestSubjects.map(row=>row.spec).sort(),plan.candidateTestSubjects,'recomputed candidate subject scope');
  const browserIds=plan.groups.filter(group=>group.executionEngine==='playwright').map(group=>group.id);
  if(browserIds.length) {
    if(!Array.isArray(protectedStableTestIds)||!protectedStableTestIds.length) fail('missing protected test census for Playwright execution');
    const resolved=resolveBrowserExecution({protectedRegistry:metadata.browser,requiredGroups:browserIds,
      atlasRevision:snapshot.headSha,protectedBaseSha:snapshot.baseSha,environmentDigest,policyResolved:true,
      publicationProofs,protectedExpectedAuthorities,selectedGameplayFiles,selectedSemanticFiles});
    const keys=new Map();
    for(const command of resolved.commands) {
      const prefix=`${command.project}::${command.spec}::`;
      const expectedTestIds=plan.stableTestIds.filter(id=>id.startsWith(prefix));
      if(!expectedTestIds.length) fail(`missing protected test census: ${command.spec}`);
      const entry={argv:command.argv,cwd:command.cwd,engine:'playwright',groupIds:[command.groupId],
        expectedTestIds,resourceClass:command.resourceClass,dataCapability:command.dataCapability,
        publication:command.identity.publication,timeoutSeconds:command.resourceClass==='soak'?14400:3600};
      const id=hash({identity,...entry});keys.set(command.executionKey,id);commands.push({...entry,id});
    }
    for(const review of resolved.reviews) reviews.push({groupId:review.groupId,frames:review.requiredFrames,commandIds:review.machineExecutionKeys.map(key=>keys.get(key))});
  }
  for(const group of plan.groups) {
    const commandIds=group.evidence==='restricted-visual-review'
      ? reviews.find(review=>review.groupId===group.id)?.commandIds
      : commands.filter(command=>command.groupIds.includes(group.id)).map(command=>command.id);
    if(!commandIds?.length) fail(`unresolved execution engine: ${group.id}`);
    groups.push({id:group.id,commandIds});
  }
  return sealExecutionContract({schemaVersion:1,identity,commands,groups,reviews,candidateTestSubjects});
}
