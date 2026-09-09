import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync, spawnSync} from 'node:child_process';
import {buildVerificationPlan, assertPlanExecutable} from './build-verification-plan.mjs';
import {R5_SEMANTIC_BUILDER_ORACLE, R5_SEMANTIC_BUILDER_ORACLE_DIGEST, R5_SEMANTIC_SOURCE, resolveExecutionContract, assertCandidateReadback, verifyR5SemanticProduct} from './verification-execution-contract.mjs';
import {readCandidateSnapshot, gitChangedFiles, githubRequest, resolveDirectMergeGroup} from './protected-candidate-snapshot.mjs';
import {buildProtectedExecutionEnvironmentIdentity} from './protected-execution-environment.mjs';
import {canonicalJson} from './verification-plan-schema.mjs';
import {buildQualificationWorld, verifyQualificationWorld, qualificationTrustDescriptor} from './qualification-world.mjs';
import {buildBoundedRealWorld, verifyBoundedRealWorld, boundedRealTrustDescriptor} from './bounded-real-world.mjs';
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

// pull_request_target and merge_group both load protected workflow authority.
// Candidate content is inert input and never supplies executable control metadata.
export async function resolveShadowEvent({eventName,event,githubSha,githubRef,request=githubRequest}) {
  if(event?.repository?.full_name!==REPOSITORY||event.repository.default_branch!=='main') fail('event repository');
  if(eventName==='pull_request_target') {
    const base=(await request(`/repos/${REPOSITORY}/git/ref/heads/main`)).object?.sha;
    if(!sha(base)) fail('protected main revision');
    const pr=event.pull_request;
    if(!['opened','reopened','synchronize','edited','ready_for_review'].includes(event.action)
      ||pr?.base?.ref!=='main'||pr.base.sha!==base||pr.base.repo?.full_name!==REPOSITORY
      ||pr.head?.repo?.full_name!==REPOSITORY||!sha(pr.head.sha)||githubSha!==base
      ||!Number.isSafeInteger(pr.number)||pr.number<1) fail('PR event identity');
    return {repository:REPOSITORY,baseSha:base,headSha:pr.head.sha,prNumber:pr.number,parentRunId:null,event:'pull_request_target'};
  }
  if(eventName!=='merge_group') fail('protected workflow event');
  const group=await resolveDirectMergeGroup({request,repository:REPOSITORY,defaultBranch:'main',event,githubSha,githubRef});
  return {repository:REPOSITORY,baseSha:group.baseSha,headSha:group.headSha,prNumber:null,parentRunId:null,event:'merge_group',treeSha:group.treeSha,headRef:group.headRef};
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
  const unprivilegedDeterministicSubjects=[...new Set(candidate.changedFiles.flatMap(row=>row.status==='removed'?[]:[row.path,...(row.status==='renamed'?[row.previousPath]:[])].filter(name=>typeof name==='string'&&/^tests\/[A-Za-z0-9_./-]+\.(mjs|py)$/.test(name))))].sort();
  const plan=buildVerificationPlan({...planInput,trustedVerificationCatalog:protectedCatalog,candidateVerificationCatalog:protectedCatalog,
    trustedImpactManifest:protectedImpactManifest,candidateImpactManifest:protectedImpactManifest,
    protectedStableTestIds,unprivilegedDeterministicSubjects});
  assertPlanExecutable(plan);
  const supported=new Set(['e2e.layer-availability','e2e.farm-explorer','e2e.search-navigation','integration.source-contract-browser','integration.source-contract-http']);
  for(const group of plan.groups) if(group.executionEngine!=='deterministic'&&!supported.has(group.id)) fail(`R5 bounded executor unavailable for ${group.id}`);
  return {plan,input:{root,protectedRoot,candidate,planInput,protectedCatalog,protectedImpactManifest,protectedStableTestIds}};
}

// No language-owned reporter is accepted as evidence that a candidate assertion
// ran. This census attests exact processes/spec files and their external exits.
export function deterministicDockerArgs({command,candidateRoot,dependencyRoot,shimRoot,protectedHarnessFile,protectedInputFile,image,containerName}) {
  if(command.engine!=='deterministic'||command.cwd!=='.'||!['node','python','python3'].includes(command.argv?.[0])
    ||!command.argv.slice(1).every(value=>typeof value==='string')||!/^sha256:[a-f0-9]{64}$/.test(command.id)) fail('deterministic command');
  if(!/^[a-z0-9-]+$/.test(containerName)||!/@sha256:[a-f0-9]{64}$/.test(image)) fail('container identity');
  const protectedHarness=command.executionScope==='protected-harness';
  if(protectedHarness&&(!path.isAbsolute(protectedHarnessFile??'')||!path.isAbsolute(protectedInputFile??'')
    ||bytesDigest(fs.readFileSync(protectedHarnessFile))!==command.protectedHarnessDigest
    ||bytesDigest(fs.readFileSync(protectedInputFile))!==command.protectedInputDigest)) fail('protected harness inputs');
  return ['run','--name',containerName,'--network=none','--read-only','--user=1000:1000','--cap-drop=ALL',
    '--security-opt=no-new-privileges','--pids-limit=192','--memory=1610612736','--cpus=2',
    '--tmpfs=/tmp:rw,nodev,nosuid,size=256m','--mount',`type=bind,src=${candidateRoot},dst=/candidate,readonly`,
    '--mount',`type=bind,src=${dependencyRoot},dst=/candidate/e2e/node_modules,readonly`,
    '--mount',`type=bind,src=${shimRoot},dst=/tmp/atlas-python-bin,readonly`,
    ...(protectedHarness?['--mount',`type=bind,src=${protectedHarnessFile},dst=/protected-harness/r5-semantic-builder-oracle.mjs,readonly`,
      '--mount',`type=bind,src=${protectedInputFile},dst=/protected-input/game-semantic-search-source.jsonl,readonly`]:[]),
    '--workdir=/candidate','--env=PATH=/tmp/atlas-python-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin','--env=HOME=/tmp','--env=PYTHONPYCACHEPREFIX=/tmp/atlas-python-pycache',image,
    command.argv[0]==='python'?'/usr/bin/python3':command.argv[0],...command.argv.slice(1)];
}

export function assertDeterministicContainer(container,{command,candidateRoot,dependencyRoot,shimRoot,protectedHarnessFile,protectedInputFile,image}) {
  const host=container?.HostConfig,config=container?.Config,state=container?.State;
  if(!host||!config||!state||config.Image!==image||host.NetworkMode!=='none'||!host.ReadonlyRootfs
    ||config.User!=='1000:1000'||config.WorkingDir!=='/candidate'||state.Running||state.OOMKilled
    ||host.Privileged||canonicalJson(host.CapDrop)!==canonicalJson(['ALL'])
    ||!host.SecurityOpt?.some(x=>x==='no-new-privileges'||x==='no-new-privileges:true')
    ||host.PidsLimit!==192||host.Memory!==1610612736||host.NanoCpus!==2000000000
    ||host.Tmpfs?.['/tmp']!=='rw,nodev,nosuid,size=256m') fail('actual container isolation/completion');
  const expected=[{Source:candidateRoot,Destination:'/candidate'},
    {Source:dependencyRoot,Destination:'/candidate/e2e/node_modules'},
    {Source:shimRoot,Destination:'/tmp/atlas-python-bin'},
    ...(command.executionScope==='protected-harness'?[{Source:protectedHarnessFile,Destination:'/protected-harness/r5-semantic-builder-oracle.mjs'},
      {Source:protectedInputFile,Destination:'/protected-input/game-semantic-search-source.json'}]:[])].sort((a,b)=>a.Destination.localeCompare(b.Destination));
  const mounts=(container.Mounts??[]).filter(x=>x.Type!=='tmpfs');
  if(mounts.some(x=>x.Type!=='bind'||x.RW!==false)
    ||canonicalJson(mounts.map(({Source,Destination})=>({Source,Destination})).sort((a,b)=>a.Destination.localeCompare(b.Destination)))!==canonicalJson(expected)) fail('actual readonly mount census');
  const executable=command.argv[0]==='python'?'/usr/bin/python3':command.argv[0];
  if(container.Path!==executable||canonicalJson(container.Args)!==canonicalJson(command.argv.slice(1))
    ||config.Env?.some(x=>/^(?:GH_TOKEN|GITHUB_TOKEN|ACTIONS_|.*SECRET|.*PASSWORD|.*CREDENTIAL)/i.test(x))) fail('actual command or credential environment');
  return true;
}

function executeDeterministic(command,root,image,dependencyRoot,shimRoot,protectedHarnessFile,protectedInputFile) {
  const name=`atlas-r4-${randomUUID()}`;
  const argv=deterministicDockerArgs({command,candidateRoot:root,dependencyRoot,shimRoot,protectedHarnessFile,protectedInputFile,image,containerName:name});
  const startedAt=new Date().toISOString();
  let result,container;
  try {
    result=spawnSync('docker',argv,{encoding:'utf8',timeout:command.timeoutSeconds*1000,maxBuffer:16*1024*1024,env:{PATH:process.env.PATH,HOME:process.env.HOME}});
    // Inspect the actual container, even for timeout/nonzero/daemon failures.
    try {container=JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8'}))[0];} catch {assertContainerStarted(null,result);}
    assertContainerStarted(container,result);
    assertDeterministicContainer(container,{command,candidateRoot:root,dependencyRoot,shimRoot,protectedHarnessFile,protectedInputFile,image});
    return {commandId:command.id,argv:command.argv,cwd:command.cwd,groupIds:command.groupIds,
      expectedTestIds:command.expectedTestIds,...(command.executionScope?{executionScope:command.executionScope}:{}),
      censusKind:command.executionScope==='protected-harness'?'protected-harness-and-candidate-subprocess':'external-command-and-spec',retry:0,
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

export async function buildR5SemanticPublication(destination, sourceBytes) {
  if (!(Buffer.isBuffer(sourceBytes)||sourceBytes instanceof Uint8Array)||bytesDigest(sourceBytes)!==R5_SEMANTIC_SOURCE.digest) fail('R5 semantic source bytes');
  await buildBoundedRealWorld(destination,{sourceRoot:controlRoot});
  await verifyBoundedRealWorld(destination);
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-r5-semantic-build-'));
  try {
    const source=path.join(scratch,'source.json'),output=path.join(destination,'web/semantic-search/index.json');
    fs.writeFileSync(source,Buffer.from(sourceBytes),{flag:'wx',mode:0o400});
    const execution=spawnSync('/usr/bin/python3',['-I','-B',path.join(controlRoot,'tools/build-semantic-search-index.py'),source,output,'--game-revision',R5_SEMANTIC_SOURCE.revision],
      {cwd:controlRoot,env:{LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:scratch},encoding:'utf8',shell:false,timeout:30000,maxBuffer:1024*1024});
    if(execution.error||execution.status!==0||execution.signal)fail(`R5 semantic protected build failed: ${String(execution.stderr??'').slice(-1024)}`);
  } finally {fs.rmSync(scratch,{recursive:true,force:true});}
  const selectedFiles={sourceBytes:Buffer.from(sourceBytes),
    'web/semantic-search/index.json':fs.readFileSync(path.join(destination,'web/semantic-search/index.json')),
    'web/semantic-search/creatures.json':fs.readFileSync(path.join(destination,'web/semantic-search/creatures.json'))};
  const selected=verifyR5SemanticProduct(selectedFiles);
  const entries=[];
  const walk=(directory)=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {const absolute=path.join(directory,entry.name),relative=path.relative(destination,absolute).replaceAll(path.sep,'/');if(entry.isDirectory())walk(absolute);else if(relative!=='bounded-real-manifest.json'){const bytes=fs.readFileSync(absolute);entries.push({path:relative,bytes:bytes.length,digest:bytesDigest(bytes)});}}};
  walk(destination);entries.sort((a,b)=>a.path.localeCompare(b.path));
  const manifest={...readJson(path.join(destination,'bounded-real-manifest.json')),sourceDigests:{...readJson(path.join(destination,'bounded-real-manifest.json')).sourceDigests,
    semanticSearch:bytesDigest(selectedFiles['web/semantic-search/index.json']),semanticSearchSource:R5_SEMANTIC_SOURCE.digest},files:entries,productDigest:bytesDigest(Buffer.from(canonicalJson(entries)+'\n'))};
  fs.writeFileSync(path.join(destination,'bounded-real-manifest.json'),canonicalJson(manifest)+'\n');
  await verifyBoundedRealWorld(destination);
  return {manifest,selectedFiles,selected,authority:{authorityDigest:selected.authorityDigest}};
}

export function authenticateR5SemanticSource({commit,file}={}) {
  if(commit?.sha!==R5_SEMANTIC_SOURCE.revision||!sha(commit.tree?.sha)) fail('R5 semantic source commit identity');
  if(file?.type!=='file'||file.path!==R5_SEMANTIC_SOURCE.path||file.name!==path.posix.basename(R5_SEMANTIC_SOURCE.path)
    ||file.sha!==R5_SEMANTIC_SOURCE.blob||file.size!==R5_SEMANTIC_SOURCE.bytes||file.encoding!=='base64'
    ||typeof file.content!=='string') fail('R5 semantic revision:path identity');
  const encoded=file.content.replaceAll('\n','');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length%4!==0) fail('R5 semantic source API encoding');
  const bytes=Buffer.from(encoded,'base64');
  const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if(bytes.toString('base64')!==encoded||bytes.length!==R5_SEMANTIC_SOURCE.bytes
    ||blob!==R5_SEMANTIC_SOURCE.blob||bytesDigest(bytes)!==R5_SEMANTIC_SOURCE.digest) fail('R5 semantic source API bytes');
  return bytes;
}

async function r5SemanticPublication(destination) {
  const revision=R5_SEMANTIC_SOURCE.revision;
  const sourcePath=R5_SEMANTIC_SOURCE.path.split('/').map(encodeURIComponent).join('/');
  const [commit,file]=await Promise.all([
    githubRequest(`/repos/${R5_SEMANTIC_SOURCE.repository}/git/commits/${revision}`),
    githubRequest(`/repos/${R5_SEMANTIC_SOURCE.repository}/contents/${sourcePath}?ref=${revision}`),
  ]);
  return buildR5SemanticPublication(destination,authenticateR5SemanticSource({commit,file}));
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

export function fixtureReadinessEnvironment(contract) {
  return {ATLAS_PLAN_SEMANTIC_DIGEST:contract.identity.planDigest,
    ATLAS_PLAN_INSTANCE_DIGEST:contract.contractDigest,
    ATLAS_ENVIRONMENT_DIGEST:`sha256:${contract.identity.environmentDigest}`};
}

export function fixtureBrowserArgs(composeArgs,{uid=process.getuid(),gid=process.getgid()}={}) {
  if(!Number.isSafeInteger(uid)||uid<0||!Number.isSafeInteger(gid)||gid<0) fail('fixture host identity');
  return [...composeArgs,'run','--user',`${uid}:${gid}`,'--rm','--no-deps','e2e'];
}

function runPublicationBrowser(command,{candidate,contract,publication,directory,root}) {
  const suffix=command.id.slice('sha256:'.length,'sha256:'.length+12);
  const context=path.join(directory,`browser-context-${suffix}`);fs.mkdirSync(context);
  for(const relative of ['web','src']) fs.cpSync(path.join(root,relative),path.join(context,relative),{recursive:true});
  // Candidate web/source bytes are inert inputs. Every executable harness byte
  // comes from the authenticated protected checkout.
  fs.cpSync(path.join(controlRoot,'e2e'),path.join(context,'e2e'),{recursive:true,filter:p=>!p.split(path.sep).includes('node_modules')});
  fs.mkdirSync(path.join(context,'tools','verification'),{recursive:true});
  fs.copyFileSync(path.join(controlRoot,'tools/verification/stable-id.mjs'),path.join(context,'tools/verification/stable-id.mjs'));
  const list=path.join(directory,`test-list-${suffix}.txt`);
  fs.writeFileSync(list,command.expectedTestIds.map(id=>{const [project,spec,...title]=id.split('::');return `[${project}] › ${spec.replace('e2e/tests/','')} › ${title.join('::')}`;}).join('\n')+'\n');
  const artifacts=path.join(directory,`artifacts-${suffix}`);fs.mkdirSync(artifacts);fs.chmodSync(artifacts,0o777);
  const project=`atlas-r5-${randomUUID()}`;
  const args=['compose','-p',project,'-f',path.join(controlRoot,'e2e/compose.protected-hosted-executor.yml'),'-f',path.join(controlRoot,'e2e/compose.github-hosted.yml')];
  const env={PATH:process.env.PATH,HOME:process.env.HOME,ATLAS_EXECUTION_CONTEXT:context,ATLAS_CODE_REVISION:candidate.headSha,
    ATLAS_QUALIFICATION_PUBLICATION_HOST:publication.root,ATLAS_QUALIFICATION_TRUST_JSON:JSON.stringify(publication.trustDescriptor),
    ATLAS_PROTECTED_TEST_LIST:list,ATLAS_E2E_ARTIFACTS_HOST:artifacts,ATLAS_E2E_SHARD:'1/1',ATLAS_E2E_WORKERS:'1',
    ATLAS_E2E_DATA_CAPABILITY:command.dataCapability,...fixtureReadinessEnvironment(contract),
    ATLAS_AUTHORITY_DIGEST:publication.authority.authorityDigest,
    GITHUB_RUN_ID:process.env.GITHUB_RUN_ID,GITHUB_REPOSITORY:REPOSITORY};
  try {
    for(const setup of [['build','e2e'],['up','-d','--wait','--wait-timeout','180','atlas-web']]) {
      const result=spawnSync('docker',[...args,...setup],{env,encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024});
      if(result.error||result.status!==0||result.signal) {
        console.error(JSON.stringify({phase:'browser-setup',dataCapability:command.dataCapability,operation:setup,exitCode:result.status,signal:result.signal,error:result.error?.message??null,stdout:String(result.stdout??'').slice(-12288),stderr:String(result.stderr??'').slice(-4096)}));
        if(setup[0]==='up') {
          const logs=spawnSync('docker',[...args,'logs','--no-color','--tail','40'],{env,encoding:'utf8',timeout:10000,maxBuffer:1024*1024});
          console.error(JSON.stringify({phase:'browser-service-logs',dataCapability:command.dataCapability,exitCode:logs.status,stdout:String(logs.stdout??'').slice(-16384),stderr:String(logs.stderr??'').slice(-4096)}));
        }
        fail('protected browser service setup failed');
      }
    }
    const result=spawnSync('docker',fixtureBrowserArgs(args),{env,encoding:'utf8',timeout:command.timeoutSeconds*1000,maxBuffer:16*1024*1024});
    if(result.error||result.status!==0||result.signal) {console.error(JSON.stringify({phase:'browser-execution',dataCapability:command.dataCapability,exitCode:result.status,signal:result.signal,error:result.error?.message??null,stdout:String(result.stdout??'').slice(-12288),stderr:String(result.stderr??'').slice(-4096)}));fail('protected browser execution failed');}
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
  const event=await resolveShadowEvent({eventName:process.env.GITHUB_EVENT_NAME,event:readJson(process.env.GITHUB_EVENT_PATH),githubSha:process.env.GITHUB_SHA,githubRef:process.env.GITHUB_REF});
  assertCheckout(controlRoot,event.baseSha);assertCheckout(root,event.headSha);
  if(git(root,'merge-base',event.baseSha,event.headSha)!==event.baseSha) fail('candidate base ancestry');
  if(!git(controlRoot,'ls-tree',event.baseSha,'--',ACTIVE).startsWith('100644 blob ')
    ||!gitBlob(controlRoot,event.baseSha,ACTIVE).equals(fs.readFileSync(path.join(controlRoot,TEMPLATE)))) fail('protected workflow/template bytes');
  const candidate=await readCandidateSnapshot({...event,changedFiles:gitChangedFiles(root,event.baseSha,event.headSha)});
  if(event.treeSha&&candidate.treeSha!==event.treeSha) fail('event candidate tree differs from API tree');
  if(git(root,'rev-parse','HEAD^{tree}')!==candidate.treeSha) fail('API tree differs from checkout');
  const currentRunId=Number(process.env.GITHUB_RUN_ID);
  if(!Number.isSafeInteger(currentRunId)||currentRunId<1) fail('current run id');
  const currentRun=await githubRequest(`/repos/${REPOSITORY}/actions/runs/${currentRunId}`);
  if(currentRun.id!==currentRunId||currentRun.repository?.full_name!==REPOSITORY||currentRun.path!==ACTIVE
    ||currentRun.event!==event.event||currentRun.run_attempt!==1||currentRun.status!=='in_progress'
    ||currentRun.head_sha!==event.headSha) fail('current run API identity');
  const {plan,input}=planShadow({candidate,root,protectedRoot:controlRoot});
  const summary={schemaVersion:1,mode:'nonblocking-shadow',candidate,event:event.event,parentRunId:null,
    runId:currentRunId,runAttempt:1,workflowSourceRevision:event.baseSha,apiRunHeadSha:currentRun.head_sha,planDigest:digest(plan),groups:plan.groups.map(g=>g.id),
    parentWorkflowDigest:null,workflowDigest:bytesDigest(fs.readFileSync(path.join(controlRoot,TEMPLATE))),results:[],status:'UNRESOLVED'};
  const hasWork=plan.groups.length>0||plan.candidateTestSubjects.length>0;
  summary.candidateTestSubjects=plan.candidateTestSubjects;
  if(!hasWork) {summary.status='NO_PRODUCT_WORK';summary.commands=[];}
  if(mode==='plan') {
    if(process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,`has_commands=${hasWork}\n`);
    return summary;
  }
  if(!hasWork) fail('S0 must not start product job');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-r5-'));
  try {
    const config=readJson(path.join(controlRoot,'tools/verification/protected-execution-environment.json'));
    const shimRoot=path.join(directory,'python-bin');fs.mkdirSync(shimRoot);fs.symlinkSync('/usr/bin/python3',path.join(shimRoot,'python'));
    const environmentDigest=buildProtectedExecutionEnvironmentIdentity(config).environmentDigest.slice('sha256:'.length);
    const fixture=plan.groups.some(g=>g.executionEngine==='playwright'&&g.capabilities.dataCapability==='qualification_fixture')?await fixtureProof(path.join(directory,'fixture')):null;
    const bounded=plan.groups.some(g=>g.executionEngine==='playwright'&&g.id==='integration.source-contract-browser')?await r5SemanticPublication(path.join(directory,'bounded')):null;
    const selected=plan.groups.some(g=>g.id==='integration.source-contract-http')?await selectedSource():null;
    const publications=[fixture&&['qualification_fixture',fixture]].filter(Boolean);
    const contract=resolveExecutionContract({...input,environmentDigest,
      publicationProofs:publications.length?Object.fromEntries(publications.map(([id,value])=>[id,value.proof])):undefined,
      protectedExpectedAuthorities:publications.length?Object.fromEntries(publications.map(([id,value])=>[id,value.authority])):undefined,
      selectedGameplayFiles:selected?.productFiles,selectedSemanticFiles:bounded?.selectedFiles});
    summary.contractDigest=contract.contractDigest;summary.environmentDigest=environmentDigest;summary.commands=contract.commands;
    const executionRoot=contract.commands.some(command=>command.engine==='deterministic')?prepareExecutionView({sourceRoot:root,revision:candidate.headSha,destination:path.join(directory,'candidate-view')}):null;
    const hasSemanticOracle=contract.commands.some(command=>command.executionScope==='protected-harness');
    const protectedHarnessFile=hasSemanticOracle?path.join(directory,'r5-semantic-builder-oracle.mjs'):null;
    const protectedInputFile=hasSemanticOracle?path.join(controlRoot,'tests/fixtures/game-semantic-search-source.json'):null;
    if(hasSemanticOracle) {
      fs.writeFileSync(protectedHarnessFile,R5_SEMANTIC_BUILDER_ORACLE,{flag:'wx',mode:0o444});
      if(bytesDigest(fs.readFileSync(protectedHarnessFile))!==R5_SEMANTIC_BUILDER_ORACLE_DIGEST) fail('protected semantic harness materialization');
    }
    for(const command of contract.commands) {
      if(command.engine==='deterministic') {verifyExecutionView({viewRoot:executionRoot,sourceRoot:root,revision:candidate.headSha});summary.results.push(executeDeterministic(command,executionRoot,config.container.image,path.join(controlRoot,'e2e/node_modules'),shimRoot,protectedHarnessFile,protectedInputFile));}
      else if(command.groupIds[0]==='integration.source-contract-http') {
        const result=await runSelectedGameplayHttp(selected.productFiles);
        if(canonicalJson([...result.observedStableIds].sort())!==canonicalJson([...command.expectedTestIds].sort())) fail('selected HTTP actual test census');
        summary.results.push({commandId:command.id,passed:true,retry:0,workers:1,observedTestIds:result.observedStableIds,
          sourceProof:selected.proof,candidateProductEvidence:false,requests:result.observedRequests,reportDigest:bytesDigest(result.resultsBytes)});
      } else if(command.engine==='playwright') {
        const product=command.dataCapability==='qualification_fixture'?fixture:command.dataCapability==='bounded_real_world'?bounded:null;
        if(!product)fail(`missing ${command.dataCapability} browser publication`);
        summary.results.push(runPublicationBrowser(command,{candidate,contract,publication:{...product,root:command.dataCapability==='qualification_fixture'?path.join(directory,'fixture'):path.join(directory,'bounded'),trustDescriptor:command.dataCapability==='qualification_fixture'?qualificationTrustDescriptor(product.manifest):boundedRealTrustDescriptor(product.manifest)},directory,root}));
      } else fail('unsupported command');
    }
    const current=await readCandidateSnapshot({...event,changedFiles:gitChangedFiles(root,event.baseSha,event.headSha)});
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