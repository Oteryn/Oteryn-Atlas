import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {buildVerificationPlan, assertPlanExecutable} from './build-verification-plan.mjs';
import {resolveExecutionContract, assertCandidateReadback} from './verification-execution-contract.mjs';
import {readCandidateSnapshot, gitChangedFiles, githubRequest} from './protected-candidate-snapshot.mjs';
import {buildProtectedExecutionEnvironmentIdentity} from './protected-execution-environment.mjs';
import {canonicalJson} from './verification-plan-schema.mjs';
import {buildQualificationWorld, verifyQualificationWorld, qualificationTrustDescriptor} from './qualification-world.mjs';
import {buildProtectedExpectedAuthority, PUBLICATION_AUTHORITY_ID} from './proof-provenance.mjs';
import {SELECTED_GAMEPLAY_INPUTS, buildSelectedGameplaySource} from './shadow-gameplay-source.mjs';
import {runSelectedGameplayHttp} from './shadow-gameplay-http.mjs';

const REPOSITORY='Oteryn/Oteryn-Atlas';
const TEMPLATE='tools/maintenance/verification-shadow.yml';
const ACTIVE='.github/workflows/verification-shadow.yml';
const sha=value=>/^[a-f0-9]{40}$/.test(value??'');
const fail=message=>{throw new TypeError(`verification shadow: ${message}`);};
const bytesDigest=bytes=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const digest=value=>bytesDigest(canonicalJson(value));
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const git=(root,...args)=>execFileSync('git',['--no-replace-objects','-C',root,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const gitBlob=(root,revision,name)=>execFileSync('git',['--no-replace-objects','-C',root,'-c','core.hooksPath=/dev/null','show',`${revision}:${name}`],{maxBuffer:2*1024*1024});
const controlRoot=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));

// workflow_run loads this workflow from protected main, after the existing MQ
// gate. A merge-group candidate never supplies executable workflow or control.
export async function resolveShadowEvent({eventName,event,githubSha,request=githubRequest}) {
  if(event?.repository?.full_name!==REPOSITORY||event.repository.default_branch!=='main') fail('event repository');
  const base=(await request(`/repos/${REPOSITORY}/git/ref/heads/main`)).object?.sha;
  if(!sha(base)) fail('protected main revision');
  if(eventName==='pull_request_target') {
    const pr=event.pull_request;
    if(!['opened','reopened','synchronize','edited','ready_for_review'].includes(event.action)
      ||pr?.base?.ref!=='main'||pr.base.sha!==base||pr.base.repo?.full_name!==REPOSITORY
      ||pr.head?.repo?.full_name!==REPOSITORY||!sha(pr.head.sha)||githubSha!==base
      ||!Number.isSafeInteger(pr.number)||pr.number<1) fail('PR event identity');
    return {repository:REPOSITORY,baseSha:base,headSha:pr.head.sha,prNumber:pr.number,parentRunId:null,event:'pull_request_target'};
  }
  if(eventName!=='workflow_run'||event.action!=='completed'||!sha(githubSha)) fail('protected workflow event');
  const supplied=event.workflow_run;
  if(!Number.isSafeInteger(supplied?.id)||supplied.id<1) fail('parent run id');
  const run=await request(`/repos/${REPOSITORY}/actions/runs/${supplied.id}`);
  if(run.id!==supplied.id||run.repository?.full_name!==REPOSITORY||run.event!=='merge_group'
    ||run.path!=='.github/workflows/merge-group-gate.yml'||run.conclusion!=='success'
    ||run.status!=='completed'||run.run_attempt!==1||!sha(run.head_sha)
    ||!run.head_branch?.startsWith('gh-readonly-queue/main/')||run.head_sha!==supplied.head_sha) fail('successful exact MQ parent');
  const commit=await request(`/repos/${REPOSITORY}/git/commits/${run.head_sha}`);
  const mqBase=commit.parents?.[0]?.sha;
  if(commit.sha!==run.head_sha||!sha(mqBase)||![mqBase,run.head_sha].includes(base)||![mqBase,run.head_sha].includes(githubSha)||(base===mqBase&&githubSha===run.head_sha)) fail('MQ base moved');
  return {repository:REPOSITORY,baseSha:mqBase,headSha:run.head_sha,prNumber:null,parentRunId:run.id,event:'workflow_run'};
}

function assertCheckout(root,revision) {
  for(const record of git(root,'ls-tree','-r','--full-tree',revision).split('\n')) {
    const match=/^(100644|100755) blob [a-f0-9]{40}\t([A-Za-z0-9._/-]+)$/.exec(record);
    if(!match||match[2].split('/').some(part=>!part||part==='.'||part==='..')) fail('candidate contains unsafe path, symlink or nonregular entry');
  }
  if(git(root,'rev-parse','HEAD')!==revision||git(root,'status','--porcelain','--untracked-files=all')) fail('checkout identity or cleanliness');
}

function executionEntries(root,revision) {
  if(!sha(revision)) fail('execution view revision');
  return git(root,'ls-tree','-r','--full-tree',revision).split('\n').map(record=>{
    const match=/^(100644|100755) blob ([a-f0-9]{40})\t([A-Za-z0-9._/-]+)$/.exec(record);
    if(!match||match[3].split('/').some(part=>!part||part==='.'||part==='..')||match[3]==='e2e/node_modules'||match[3].startsWith('e2e/node_modules/')) fail('unsafe execution view tree');
    return {mode:match[1],blob:match[2],name:match[3]};
  });
}
export function verifyExecutionView({viewRoot,sourceRoot,revision}) {
  const entries=executionEntries(sourceRoot,revision), expected=new Map(entries.map(row=>[row.name,row]));
  const directories=new Set(['e2e','e2e/node_modules']);
  for(const row of entries){let parent=path.posix.dirname(row.name);while(parent!=='.'){directories.add(parent);parent=path.posix.dirname(parent);}}
  const seen=new Set();
  const walk=(directory,prefix='')=>{
    for(const name of fs.readdirSync(directory)) {
      if(!prefix&&name==='.git'){if(!fs.lstatSync(path.join(directory,name)).isDirectory())fail('execution view git metadata');continue;}
      const relative=prefix+name,absolute=path.join(directory,name),stat=fs.lstatSync(absolute);
      if(stat.isDirectory()){if(!directories.has(relative))fail('unexpected execution view directory');walk(absolute,relative+'/');continue;}
      const row=expected.get(relative);
      if(!stat.isFile()||!row)fail('unexpected execution view path or symlink');
      const bytes=fs.readFileSync(absolute),blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
      if(blob!==row.blob||(stat.mode&0o777)!==(row.mode==='100755'?0o755:0o644))fail('execution view tracked bytes or mode changed');
      seen.add(relative);
    }
  };
  walk(viewRoot);
  if(seen.size!==expected.size||!fs.existsSync(path.join(viewRoot,'e2e/node_modules'))||fs.readdirSync(path.join(viewRoot,'e2e/node_modules')).length)fail('execution view census');
  return true;
}
export function prepareExecutionView({sourceRoot,revision,destination}) {
  assertCheckout(sourceRoot,revision);executionEntries(sourceRoot,revision);
  if(fs.existsSync(destination)||path.resolve(destination).startsWith(path.resolve(sourceRoot)+path.sep))fail('execution view destination');
  // A fresh local clone preserves exact Git history for tests without copying
  // checkout credentials/configuration or sharing writable object hardlinks.
  const env={PATH:process.env.PATH,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'};
  execFileSync('git',['-c','core.hooksPath=/dev/null','clone','--quiet','--no-hardlinks','--no-checkout','--',sourceRoot,destination],{stdio:'pipe',env});
  const viewGit=(...args)=>execFileSync('git',['--no-replace-objects','-C',destination,'-c','core.hooksPath=/dev/null',...args],{stdio:'pipe',env});
  viewGit('checkout','--quiet','--detach',revision);
  viewGit('remote','remove','origin');
  fs.mkdirSync(path.join(destination,'e2e/node_modules'),{recursive:true});
  verifyExecutionView({viewRoot:destination,sourceRoot,revision});
  assertCheckout(sourceRoot,revision);
  return destination;
}
export function assertContainerStarted(container,result={}) {
  const state=container?.State;
  if(!state||state.Error||!state.StartedAt||/^0001-/.test(state.StartedAt)||!Number.isFinite(Date.parse(state.StartedAt))||result.status===125) {
    const diagnostic={state:state??null,exitCode:result.status??null,signal:result.signal??null,stderrTail:String(result.stderr??'').slice(-4096)};
    fail(`container never started; no specs executed: ${JSON.stringify(diagnostic)}`);
  }
  return true;
}

export function planShadow({candidate,root,protectedRoot}) {
  const protectedCatalog=readJson(path.join(protectedRoot,'tools/verification/verification-catalog.json'));
  const protectedImpactManifest=readJson(path.join(protectedRoot,'tools/verification/impact-manifest.json'));
  const protectedStableTestIds=readJson(path.join(protectedRoot,'tools/verification/protected-scenario-inventory.json')).stableTestIds;
  const planInput={repository:REPOSITORY,headSha:candidate.headSha,integrationBaseSha:candidate.baseSha,
    mergeBaseSha:candidate.baseSha,changedFiles:candidate.changedFiles};
  const unprivilegedDeterministicSubjects=[...new Set(candidate.changedFiles.flatMap(row=>[row.path,row.previousPath].filter(name=>typeof name==='string'&&/^tests\/[A-Za-z0-9_./-]+\.(mjs|py)$/.test(name))))];
  const plan=buildVerificationPlan({...planInput,trustedVerificationCatalog:protectedCatalog,candidateVerificationCatalog:protectedCatalog,
    trustedImpactManifest:protectedImpactManifest,candidateImpactManifest:protectedImpactManifest,
    protectedStableTestIds,unprivilegedDeterministicSubjects});
  assertPlanExecutable(plan);
  const supported=new Set(['e2e.layer-availability','integration.source-contract-http']);
  for(const group of plan.groups) if(group.executionEngine!=='deterministic'&&!supported.has(group.id)) fail(`R4 bounded executor unavailable for ${group.id}`);
  return {plan,input:{root,protectedRoot,candidate,planInput,protectedCatalog,protectedImpactManifest,protectedStableTestIds}};
}

// No language-owned reporter is accepted as evidence that a candidate assertion
// ran. This census attests exact processes/spec files and their external exits.
export function deterministicDockerArgs({command,candidateRoot,dependencyRoot,shimRoot,image,containerName}) {
  if(command.engine!=='deterministic'||command.cwd!=='.'||!['node','python','python3'].includes(command.argv?.[0])
    ||!command.argv.slice(1).every(value=>typeof value==='string')||!/^sha256:[a-f0-9]{64}$/.test(command.id)) fail('deterministic command');
  if(!/^[a-z0-9-]+$/.test(containerName)||!/@sha256:[a-f0-9]{64}$/.test(image)) fail('container identity');
  return ['run','--name',containerName,'--network=none','--read-only','--user=1000:1000','--cap-drop=ALL',
    '--security-opt=no-new-privileges','--pids-limit=192','--memory=1610612736','--cpus=2',
    '--tmpfs=/tmp:rw,nodev,nosuid,size=256m','--mount',`type=bind,src=${candidateRoot},dst=/candidate,readonly`,
    '--mount',`type=bind,src=${dependencyRoot},dst=/candidate/e2e/node_modules,readonly`,
    '--mount',`type=bind,src=${shimRoot},dst=/tmp/atlas-python-bin,readonly`,
    '--workdir=/candidate','--env=PATH=/tmp/atlas-python-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin','--env=HOME=/tmp','--env=PYTHONPYCACHEPREFIX=/tmp/atlas-python-pycache',image,
    command.argv[0]==='python'?'/usr/bin/python3':command.argv[0],...command.argv.slice(1)];
}

export function assertDeterministicContainer(container,{command,candidateRoot,dependencyRoot,shimRoot,image}) {
  const host=container?.HostConfig,config=container?.Config,state=container?.State;
  if(!host||!config||!state||config.Image!==image||host.NetworkMode!=='none'||!host.ReadonlyRootfs
    ||config.User!=='1000:1000'||config.WorkingDir!=='/candidate'||state.Running||state.OOMKilled
    ||host.Privileged||canonicalJson(host.CapDrop)!==canonicalJson(['ALL'])
    ||!host.SecurityOpt?.some(x=>x==='no-new-privileges'||x==='no-new-privileges:true')
    ||host.PidsLimit!==192||host.Memory!==1610612736||host.NanoCpus!==2000000000
    ||host.Tmpfs?.['/tmp']!=='rw,nodev,nosuid,size=256m') fail('actual container isolation/completion');
  const expected=[{Source:candidateRoot,Destination:'/candidate'},
    {Source:dependencyRoot,Destination:'/candidate/e2e/node_modules'},
    {Source:shimRoot,Destination:'/tmp/atlas-python-bin'}].sort((a,b)=>a.Destination.localeCompare(b.Destination));
  const mounts=(container.Mounts??[]).filter(x=>x.Type!=='tmpfs');
  if(mounts.some(x=>x.Type!=='bind'||x.RW!==false)
    ||canonicalJson(mounts.map(({Source,Destination})=>({Source,Destination})).sort((a,b)=>a.Destination.localeCompare(b.Destination)))!==canonicalJson(expected)) fail('actual readonly mount census');
  const executable=command.argv[0]==='python'?'/usr/bin/python3':command.argv[0];
  if(container.Path!==executable||canonicalJson(container.Args)!==canonicalJson(command.argv.slice(1))
    ||config.Env?.some(x=>/^(?:GH_TOKEN|GITHUB_TOKEN|ACTIONS_|.*SECRET|.*PASSWORD|.*CREDENTIAL)/i.test(x))) fail('actual command or credential environment');
  return true;
}

function executeDeterministic(command,root,image,dependencyRoot,shimRoot) {
  const name=`atlas-r4-${randomUUID()}`;
  const argv=deterministicDockerArgs({command,candidateRoot:root,dependencyRoot,shimRoot,image,containerName:name});
  const startedAt=new Date().toISOString();
  let result,container;
  try {
    result=spawnSync('docker',argv,{encoding:'utf8',timeout:command.timeoutSeconds*1000,maxBuffer:16*1024*1024,env:{PATH:process.env.PATH,HOME:process.env.HOME}});
    // Inspect the actual container, even for timeout/nonzero/daemon failures.
    try {container=JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8'}))[0];} catch {assertContainerStarted(null,result);}
    assertContainerStarted(container,result);
    assertDeterministicContainer(container,{command,candidateRoot:root,dependencyRoot,shimRoot,image});
    return {commandId:command.id,argv:command.argv,cwd:command.cwd,groupIds:command.groupIds,
      expectedTestIds:command.expectedTestIds,...(command.executionScope?{executionScope:command.executionScope}:{}),censusKind:'external-command-and-spec',retry:0,
      containerId:container.Id,imageId:container.Image,image,executedArgv:[container.Path,...container.Args],
      isolationDigest:digest({config:container.Config,host:container.HostConfig,mounts:container.Mounts}),startedAt,finishedAt:new Date().toISOString(),
      exitCode:result.status,signal:result.signal,timeout:result.error?.code==='ETIMEDOUT',
      outputDigest:bytesDigest((result.stdout??'')+(result.stderr??'')),
      failureOutput:result.error||result.status!==0||result.signal||container.State.ExitCode!==0
        ? {stdoutTail:String(result.stdout??'').slice(-12288),stderrTail:String(result.stderr??'').slice(-4096)} : null,
      passed:!result.error&&result.status===0&&!result.signal&&container.State.ExitCode===0};
  } finally {spawnSync('docker',['rm','-f',name],{stdio:'ignore'});}
}

async function fixtureProof(destination) {
  await buildQualificationWorld(destination);
  await verifyQualificationWorld(destination);
  const manifest=readJson(path.join(destination,'fixture-manifest.json'));
  const publicationManifestBytes=fs.readFileSync(path.join(destination,'publication/publication.json'));
  const productFiles=manifest.files.map(row=>({path:row.path,bytes:fs.readFileSync(path.join(destination,row.path))}));
  const authority=buildProtectedExpectedAuthority({schemaVersion:1,authorityId:PUBLICATION_AUTHORITY_ID,
    dataCapability:'qualification_fixture',product:{id:manifest.fixtureId,manifestPath:'fixture-manifest.json',digest:manifest.productDigest},
    publication:{manifestPath:'publication/publication.json',digest:bytesDigest(publicationManifestBytes)},
    source:{kind:'atlas-owned-fixture',repository:null,revision:null,selectedBytes:[]},completeProductContractDigest:null});
  return {manifest,authority,proof:{dataCapability:'qualification_fixture',productManifestBytes:fs.readFileSync(path.join(destination,'fixture-manifest.json')),
    publicationManifestBytes,productFiles,source:null,completeProduct:null}};
}

async function selectedSource() {
  const inputs={};
  for(const pin of SELECTED_GAMEPLAY_INPUTS) {
    const row=await githubRequest(`/repos/${pin.repository}/git/blobs/${pin.blob}`);
    if(row.sha!==pin.blob||row.encoding!=='base64'||row.size!==pin.bytes) fail('source API blob identity');
    inputs[pin.id]=Buffer.from(row.content,'base64');
  }
  return buildSelectedGameplaySource(inputs);
}

function runFixture(command,{candidate,contract,fixture,directory,root}) {
  const context=path.join(directory,'fixture-context');fs.mkdirSync(context);
  for(const relative of ['web','src']) fs.cpSync(path.join(root,relative),path.join(context,relative),{recursive:true});
  // Candidate web/source bytes are inert inputs. Every executable harness byte
  // comes from the authenticated protected checkout.
  fs.cpSync(path.join(controlRoot,'e2e'),path.join(context,'e2e'),{recursive:true,filter:p=>!p.split(path.sep).includes('node_modules')});
  fs.mkdirSync(path.join(context,'tools','verification'),{recursive:true});
  fs.copyFileSync(path.join(controlRoot,'tools/verification/stable-id.mjs'),path.join(context,'tools/verification/stable-id.mjs'));
  const list=path.join(directory,'test-list.txt');
  fs.writeFileSync(list,command.expectedTestIds.map(id=>{const [project,spec,...title]=id.split('::');return `[${project}] › ${spec.replace('e2e/tests/','')} › ${title.join('::')}`;}).join('\n')+'\n');
  const artifacts=path.join(directory,'artifacts');fs.mkdirSync(artifacts);fs.chmodSync(artifacts,0o777);
  const project=`atlas-r4-${randomUUID()}`;
  const args=['compose','-p',project,'-f',path.join(controlRoot,'e2e/compose.protected-hosted-executor.yml'),'-f',path.join(controlRoot,'e2e/compose.github-hosted.yml')];
  const env={PATH:process.env.PATH,HOME:process.env.HOME,ATLAS_EXECUTION_CONTEXT:context,ATLAS_CODE_REVISION:candidate.headSha,
    ATLAS_QUALIFICATION_PUBLICATION_HOST:path.join(directory,'fixture'),ATLAS_QUALIFICATION_TRUST_JSON:JSON.stringify(qualificationTrustDescriptor(fixture.manifest)),
    ATLAS_PROTECTED_TEST_LIST:list,ATLAS_E2E_ARTIFACTS_HOST:artifacts,ATLAS_E2E_SHARD:'1/1',ATLAS_E2E_WORKERS:'1',
    ATLAS_E2E_DATA_CAPABILITY:'qualification_fixture',ATLAS_PLAN_SEMANTIC_DIGEST:contract.identity.planDigest,
    ATLAS_PLAN_INSTANCE_DIGEST:contract.contractDigest,ATLAS_AUTHORITY_DIGEST:fixture.authority.authorityDigest,
    ATLAS_ENVIRONMENT_DIGEST:contract.identity.environmentDigest,GITHUB_RUN_ID:process.env.GITHUB_RUN_ID,GITHUB_REPOSITORY:REPOSITORY};
  try {
    for(const setup of [['build','e2e'],['up','-d','--wait','--wait-timeout','180','atlas-web']]) {
      const result=spawnSync('docker',[...args,...setup],{env,encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024});
      if(result.error||result.status!==0||result.signal) {
        console.error(JSON.stringify({phase:'fixture-setup',operation:setup,exitCode:result.status,signal:result.signal,error:result.error?.message??null,stdout:String(result.stdout??'').slice(-12288),stderr:String(result.stderr??'').slice(-4096)}));
        if(setup[0]==='up') {
          const logs=spawnSync('docker',[...args,'logs','--no-color','--tail','40'],{env,encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
          console.error(JSON.stringify({phase:'fixture-service-logs',exitCode:logs.status,stdout:String(logs.stdout??'').slice(-16384),stderr:String(logs.stderr??'').slice(-4096)}));
        }
        fail('fixture protected service setup failed');
      }
    }
    const result=spawnSync('docker',[...args,'run','--rm','--no-deps','e2e'],{env,encoding:'utf8',timeout:command.timeoutSeconds*1000,maxBuffer:16*1024*1024});
    if(result.error||result.status!==0||result.signal) {console.error(JSON.stringify({phase:'fixture-browser',exitCode:result.status,signal:result.signal,error:result.error?.message??null,stdout:String(result.stdout??'').slice(-12288),stderr:String(result.stderr??'').slice(-4096)}));fail('fixture browser execution failed');}
    const report=readJson(path.join(artifacts,'results.json'));
    const observed=[];
    const walk=suites=>{for(const suite of suites??[]){for(const spec of suite.specs??[]){for(const test of spec.tests??[]){if(test.status!=='expected'||test.results?.length!==1||test.results[0].status!=='passed'||test.results[0].retry!==0)fail('fixture nonpass/retry');observed.push(`${test.projectName}::e2e/tests/${spec.file.replace(/^.*\/tests\//,'')}::${spec.title}`);}}walk(suite.suites);}};
    walk(report.suites);
    if(report.errors?.length||canonicalJson(observed.sort())!==canonicalJson([...command.expectedTestIds].sort())) fail('fixture actual test census');
    return {commandId:command.id,passed:true,retry:0,workers:1,expectedTestIds:command.expectedTestIds,observedTestIds:observed,reportDigest:digest(report)};
  } finally {spawnSync('docker',[...args,'down','--volumes','--remove-orphans'],{env,stdio:'ignore'});}
}

export async function runShadow(mode,root) {
  if(!['plan','execute'].includes(mode)) fail('mode');
  root=path.resolve(root);
  if(process.env.GITHUB_RUN_ATTEMPT!=='1') fail('reruns are not shadow evidence');
  const event=await resolveShadowEvent({eventName:process.env.GITHUB_EVENT_NAME,event:readJson(process.env.GITHUB_EVENT_PATH),githubSha:process.env.GITHUB_SHA});
  assertCheckout(controlRoot,event.baseSha);assertCheckout(root,event.headSha);
  if(git(root,'merge-base',event.baseSha,event.headSha)!==event.baseSha) fail('candidate base ancestry');
  if(!git(controlRoot,'ls-tree',process.env.GITHUB_SHA,'--',ACTIVE).startsWith('100644 blob ')
    ||!gitBlob(controlRoot,process.env.GITHUB_SHA,ACTIVE).equals(fs.readFileSync(path.join(controlRoot,TEMPLATE)))) fail('protected workflow/template bytes');
  if(event.event==='workflow_run') {
    const gate='.github/workflows/merge-group-gate.yml';
    if(!git(controlRoot,'ls-tree',event.baseSha,'--',gate).startsWith('100644 blob ')
      ||!git(root,'ls-tree',event.headSha,'--',gate).startsWith('100644 blob ')
      ||!gitBlob(root,event.headSha,gate).equals(gitBlob(controlRoot,event.baseSha,gate))) fail('parent MQ gate workflow differs from protected source');
  }
  const candidate=await readCandidateSnapshot({...event,allowJustIntegratedHead:event.event==='workflow_run',changedFiles:gitChangedFiles(root,event.baseSha,event.headSha)});
  if(git(root,'rev-parse','HEAD^{tree}')!==candidate.treeSha) fail('API tree differs from checkout');
  const currentRunId=Number(process.env.GITHUB_RUN_ID);
  if(!Number.isSafeInteger(currentRunId)||currentRunId<1) fail('current run id');
  const currentRun=await githubRequest(`/repos/${REPOSITORY}/actions/runs/${currentRunId}`);
  if(currentRun.id!==currentRunId||currentRun.repository?.full_name!==REPOSITORY||currentRun.path!==ACTIVE
    ||currentRun.event!==event.event||currentRun.run_attempt!==1||currentRun.status!=='in_progress'
    ||currentRun.head_sha!==(event.event==='pull_request_target'?event.headSha:process.env.GITHUB_SHA)) fail('current run API identity');
  const {plan,input}=planShadow({candidate,root,protectedRoot:controlRoot});
  const summary={schemaVersion:1,mode:'nonblocking-shadow',candidate,event: event.event,parentRunId:event.parentRunId,
    runId:currentRunId,runAttempt:1,workflowSourceRevision:process.env.GITHUB_SHA,apiRunHeadSha:currentRun.head_sha,planDigest:digest(plan),groups:plan.groups.map(g=>g.id),
    parentWorkflowDigest:event.parentRunId?bytesDigest(fs.readFileSync(path.join(controlRoot,'.github/workflows/merge-group-gate.yml'))):null,
    workflowDigest:bytesDigest(fs.readFileSync(path.join(controlRoot,TEMPLATE))),results:[],status:'UNRESOLVED'};
  const hasWork=plan.groups.length>0||plan.candidateTestSubjects.length>0;
  summary.candidateTestSubjects=plan.candidateTestSubjects;
  if(!hasWork) {summary.status='NO_PRODUCT_WORK';summary.commands=[];}
  if(mode==='plan') {
    if(process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,`has_commands=${hasWork}\n`);
    return summary;
  }
  if(!hasWork) fail('S0 must not start product job');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-r4-'));
  try {
    const config=readJson(path.join(controlRoot,'tools/verification/protected-execution-environment.json'));
    const shimRoot=path.join(directory,'python-bin');fs.mkdirSync(shimRoot);fs.symlinkSync('/usr/bin/python3',path.join(shimRoot,'python'));
    const environmentDigest=buildProtectedExecutionEnvironmentIdentity(config).environmentDigest.slice('sha256:'.length);
    const fixture=plan.groups.some(g=>g.id==='e2e.layer-availability')?await fixtureProof(path.join(directory,'fixture')):null;
    const selected=plan.groups.some(g=>g.id==='integration.source-contract-http')?await selectedSource():null;
    const contract=resolveExecutionContract({...input,environmentDigest,
      publicationProofs:fixture?{qualification_fixture:fixture.proof}:undefined,
      protectedExpectedAuthorities:fixture?{qualification_fixture:fixture.authority}:undefined,
      selectedGameplayFiles:selected?.productFiles});
    summary.contractDigest=contract.contractDigest;summary.environmentDigest=environmentDigest;summary.commands=contract.commands;
    const executionRoot=contract.commands.some(command=>command.engine==='deterministic')?prepareExecutionView({sourceRoot:root,revision:candidate.headSha,destination:path.join(directory,'candidate-view')}):null;
    for(const command of contract.commands) {
      if(command.engine==='deterministic') {verifyExecutionView({viewRoot:executionRoot,sourceRoot:root,revision:candidate.headSha});summary.results.push(executeDeterministic(command,executionRoot,config.container.image,path.join(controlRoot,'e2e/node_modules'),shimRoot));}
      else if(command.groupIds[0]==='e2e.layer-availability') summary.results.push(runFixture(command,{candidate,contract,fixture,directory,root}));
      else if(command.groupIds[0]==='integration.source-contract-http') {
        const result=await runSelectedGameplayHttp(selected.productFiles);
        if(canonicalJson([...result.observedStableIds].sort())!==canonicalJson([...command.expectedTestIds].sort())) fail('selected HTTP actual test census');
        summary.results.push({commandId:command.id,passed:true,retry:0,workers:1,observedTestIds:result.observedStableIds,
          sourceProof:selected.proof,candidateProductEvidence:false,requests:result.observedRequests,reportDigest:bytesDigest(result.resultsBytes)});
      } else fail('unsupported command');
    }
    const current=await readCandidateSnapshot({...event,allowJustIntegratedHead:event.event==='workflow_run',changedFiles:gitChangedFiles(root,event.baseSha,event.headSha)});
    assertCandidateReadback({planned:candidate,current,sourceRepository:REPOSITORY,sourceRef:'refs/heads/main',sourceRevision:event.baseSha});
    assertCheckout(root,event.headSha);
    summary.status=summary.results.length===contract.commands.length&&summary.results.every(row=>row.passed)?'PASS':'FAIL';
    return summary;
  } finally {
    fs.rmSync(directory,{recursive:true,force:true});
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const result=await runShadow(process.argv[2],process.argv[3]);
    const serialized=JSON.stringify(result);process.stdout.write(serialized+'\n');
    if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'```json\n'+serialized+'\n```\n');
    if(result.status==='FAIL') process.exitCode=1;
  } catch(error) {process.stderr.write(`${error.stack}\n`);process.exitCode=1;}
}
