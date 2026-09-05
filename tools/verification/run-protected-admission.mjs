import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { stableTestId } from './stable-id.mjs';
import { validateStableIdCensus } from './stable-id-census.mjs';

export const CANDIDATE_IMAGE = 'mcr.microsoft.com/playwright:v1.62.0-noble@sha256:baed2032d533817f3dbe6425de795788430ba345e819a1201337009ba17c9d07';
export async function classifyAdmission(validate) {
  try { return await validate(); }
  catch (error) {
    if (error?.code === 'ADMISSION_SCOPE_INELIGIBLE') return { eligible: false };
    throw error;
  }
}
export function assertSameCandidate(expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new TypeError('candidate changed before publication');
}
export function validateBrowserSummary(summary, requiredIds, headSha) {
  if (summary.status !== 'passed' || summary.metadata?.expectedRevision !== headSha || summary.metadata?.workers !== 1) throw new TypeError('browser proof identity or execution mismatch');
  const rows = summary.scenarios;
  if (!Array.isArray(rows) || rows.length !== requiredIds.length || new Set(requiredIds).size !== requiredIds.length) throw new TypeError('browser census incomplete');
  const ids = rows.map(row => { const id = stableTestId(row.project, row.specPath, row.scenario); if (id !== row.stableTestId) throw new TypeError('browser stable identity mismatch'); return id; });
  if (new Set(ids).size !== ids.length || JSON.stringify([...ids].sort()) !== JSON.stringify([...requiredIds].sort())) throw new TypeError('browser census drift');
  if (rows.some(row => row.status !== 'passed' || row.retry !== 0)) throw new TypeError('browser proof contains failed, retried or skipped scenario');
  return rows.map(row => ({ id: row.stableTestId, result: 'PASS' }));
}
export function resolveProtectedDeterministicPatterns(ciSource) {
  const arrays = [...ciSource.matchAll(/\bfiles=\(([^)]*)\)/g)];
  if (arrays.length !== 1) throw new TypeError('protected deterministic selection must be unambiguous');
  const patterns = arrays[0][1].trim().split(/\s+/);
  if (!patterns.length || new Set(patterns).size !== patterns.length || patterns.some(value => !/^tests\/(?:[A-Za-z0-9_-]+\/)*(?:[A-Za-z0-9_.-]+\.mjs|\*\.test\.mjs)$/.test(value) || value.split('/').some(part => part === '.' || part === '..'))) throw new TypeError('protected deterministic selection contains nonliteral path');
  return Object.freeze(patterns);
}
export function validateDeterministicProduct(first, second) {
  if (!/^sha256:[a-f0-9]{64}$/.test(first ?? '') || first !== second) throw new TypeError('independent product determinism proof mismatch');
}
export function validateProductIdentityMirror(protectedSource, candidateSource, oldDigest, newDigest) {
  if (!/^sha256:[a-f0-9]{64}$/.test(oldDigest ?? '') || !/^sha256:[a-f0-9]{64}$/.test(newDigest ?? '') || protectedSource.split(oldDigest).length !== 2 || candidateSource !== protectedSource.replace(oldDigest, newDigest)) throw new TypeError('product identity mirror changed beyond exact verified repin');
}
// This parent-owned census detects early exit and missing registrations. It is
// not an out-of-process semantic oracle for arbitrary hostile Node modules.
export async function collectDeterministicCensus(files, root='/candidate') {
  const {run}=await import('node:test');const rows=[];
  for await(const event of run({files,isolation:'process',concurrency:1})) {
    if(event.type==='test:fail'||event.data?.skip||event.data?.todo)throw new TypeError('deterministic proof failed, skipped or incomplete');
    if(event.type==='test:pass') {
      const data=event.data;
      rows.push({file:String(data.file??'').replace(root+'/',''),name:String(data.name).replace(root+'/',''),nesting:data.nesting,type:data.details?.type??'test'});
    }
  }
  if(!rows.length)throw new TypeError('deterministic census empty');
  return rows.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
export function validateDeterministicCensus(expected, actual) {
  if(!Array.isArray(expected)||!expected.length||JSON.stringify(expected)!==JSON.stringify(actual))throw new TypeError('protected deterministic census drift');
}
export function candidateSandboxArgs({ source, output, script, protectedTests }) {
  return ['run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '256', '--memory', '1536m', '--cpus', '2', '--user', '1000:1000', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m', '--mount', `type=bind,src=${source},dst=/candidate,readonly`, '--mount', `type=bind,src=${output},dst=/out`, '--mount', `type=bind,src=${script},dst=/run-proof.mjs,readonly`, ...(protectedTests ? ['--mount', `type=bind,src=${protectedTests},dst=/candidate/tests,readonly`] : []), CANDIDATE_IMAGE, 'node', '/run-proof.mjs', ...(protectedTests ? ['protected-tests'] : [])];
}
export function resolveProtectedBrowserCensus(listText, catalog) {
  const specs = new Set(catalog.groups?.['e2e.full']?.specs ?? []);
  if (!specs.size) throw new TypeError('protected browser catalog empty');
  const lines = [], scenarioIds = [];
  for (const line of listText.split(/\r?\n/)) {
    const match = line.match(/^\s*\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+)$/);
    if (match && specs.has(`e2e/tests/${match[2]}`)) { lines.push(line.trim()); scenarioIds.push(stableTestId(match[1], `e2e/tests/${match[2]}`, match[3])); }
  }
  if (!lines.length || new Set(scenarioIds).size !== scenarioIds.length) throw new TypeError('protected census empty or duplicate');
  return { testList: lines.join('\n') + '\n', scenarioIds };
}
export function selectProtectedBrowserCensus(census, selectedIds) {
  const lines = census.testList.trimEnd().split('\n');
  if (!Array.isArray(selectedIds) || new Set(selectedIds).size !== selectedIds.length || lines.length !== census.scenarioIds.length || selectedIds.some(id => !census.scenarioIds.includes(id))) throw new TypeError('protected browser selection invalid');
  const selected = new Set(selectedIds), indices = census.scenarioIds.flatMap((id,index)=>selected.has(id)?[index]:[]);
  return {scenarioIds:indices.map(index=>census.scenarioIds[index]),testList:indices.length?indices.map(index=>lines[index]).join('\n')+'\n':''};
}
export function resolveProtectedBrowserInventory(listText, catalog) {
  const groups=Object.values(catalog.groups??{}), lines=[],scenarioIds=[];
  for(const line of listText.split(/\r?\n/)) {
    const match=line.match(/^\s*\[([^\]]+)\]\s+›\s+([^:]+):\d+:\d+\s+›\s+(.+)$/);
    if(match&&groups.some(group=>group.projects?.includes(match[1])&&group.specs?.includes(`e2e/tests/${match[2]}`))){lines.push(line.trim());scenarioIds.push(stableTestId(match[1],`e2e/tests/${match[2]}`,match[3]));}
  }
  if(!lines.length||new Set(scenarioIds).size!==scenarioIds.length)throw new TypeError('protected inventory empty or duplicate');
  return {testList:lines.join('\n')+'\n',scenarioIds};
}
export function validateExecutionPlan(plan) {
  if(plan.workers!==1||plan.retries!==0)throw new TypeError('protected execution lower bounds invalid');
  if(!Array.isArray(plan.scenarioIds)||!Array.isArray(plan.capabilities)||plan.capabilities.some(capability=>!['qualification_fixture','bounded_real_world'].includes(capability)))throw new TypeError('required data capability unavailable to protected executor');
  if(!Array.isArray(plan.specialist)||!Array.isArray(plan.review)||plan.specialist.length||plan.review.length)throw new TypeError('independent specialist or review evidence required');
  if(!Array.isArray(plan.hostedPartitions))throw new TypeError('protected execution partitions missing');
  const caps=new Set(),ids=[];
  for(const partition of plan.hostedPartitions){
    if(!['qualification_fixture','bounded_real_world'].includes(partition.dataCapability)||caps.has(partition.dataCapability)||!Array.isArray(partition.scenarioIds)||!partition.scenarioIds.length)throw new TypeError('protected execution partition invalid');
    caps.add(partition.dataCapability);ids.push(...partition.scenarioIds);
  }
  if(new Set(ids).size!==ids.length||JSON.stringify([...ids].sort())!==JSON.stringify([...plan.scenarioIds].sort()))throw new TypeError('protected execution partition census mismatch');
}
export function protectedOracleDigest(root) {
  const hash = crypto.createHash('sha256');
  function walk(relative) {
    for (const name of fs.readdirSync(path.join(root, relative)).sort()) {
      if (name === 'node_modules' || name === '.git') continue;
      const child = path.posix.join(relative, name), stat = fs.lstatSync(path.join(root, child));
      if (stat.isSymbolicLink()) throw new TypeError('protected oracle symlink');
      if (stat.isDirectory()) walk(child);
      else if (stat.isFile()) hash.update(child + '\0').update(fs.readFileSync(path.join(root, child))).update('\0');
      else throw new TypeError('protected oracle special file');
    }
  }
  walk('e2e');
  return 'sha256:' + hash.digest('hex');
}
const read = target => JSON.parse(fs.readFileSync(target, 'utf8'));
const write = (target, value) => fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', timeout: 600_000, ...options });
const text = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 60_000, ...options }).trim();

export async function executeProtectedCandidateProof({ protectedRoot, candidateRoot, outputRoot, candidate, admission, proofPurpose = 'candidate', env = process.env }) {
  protectedRoot=path.resolve(protectedRoot);candidateRoot=path.resolve(candidateRoot);outputRoot=path.resolve(outputRoot);
  if (!fs.existsSync(outputRoot)) fs.mkdirSync(outputRoot,{recursive:true});
  else if (fs.readdirSync(outputRoot).length) throw new TypeError('proof output must be fresh');
  const module = relative => pathToFileURL(path.join(protectedRoot, relative)).href;
  const {evaluateProtectedRouting}=await import(module('tools/verification/protected-semantic-routing.mjs'));
  const {canonicalDigest}=await import(module('tools/verification/anti-loop-common.mjs'));
  if (admission?.eligible !== true || typeof admission.forceFull !== 'boolean') throw new TypeError('protected execution admission incomplete');
  if(!['candidate','depth'].includes(proofPurpose))throw new TypeError('invalid protected proof purpose');
  const plan=evaluateProtectedRouting({candidate,proofPurpose,manifest:read(path.join(protectedRoot,'tools/verification/impact-manifest.json')),catalog:read(path.join(protectedRoot,'tools/verification/verification-catalog.json')),census:read(path.join(protectedRoot,'tools/verification/full-safety-net-stable-ids.json')),inventory:read(path.join(protectedRoot,'tools/verification/protected-scenario-inventory.json')),routing:read(path.join(protectedRoot,'tools/verification/protected-routing.json')),forceFull:admission.forceFull===true});
  validateExecutionPlan(plan);
  const oracleDigest=protectedOracleDigest(protectedRoot);
  const proof={plan:{semanticDigest:plan.semanticDigest,requiredGroups:plan.requiredGroups,scenarioIds:plan.scenarioIds,dataCapabilities:plan.capabilities,profile:plan.profile,proofPurpose:plan.proofPurpose,evidenceKind:plan.evidenceKind,propertyObligations:plan.propertyObligations,hostedPartitions:plan.hostedPartitions,specialist:plan.specialist,review:plan.review},deterministic:{groups:plan.requiredGroups.filter(group=>group.startsWith('deterministic.')),result:'PASS'},browser:{scenarioResults:[],workers:1,retries:0,dataCapability:null,oracleDigest,productDigest:null,partitions:[]}};
  // Candidate test code has no credentials, network, authority writes or writable checkout.
  const deterministicScript = path.join(outputRoot,'deterministic.mjs');
  const deterministicPatterns=resolveProtectedDeterministicPatterns(fs.readFileSync(path.join(protectedRoot,'.github/workflows/ci.yml'),'utf8'));
  fs.writeFileSync(deterministicScript, `import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
fs.mkdirSync('/tmp/bin');fs.symlinkSync('/usr/bin/python3','/tmp/bin/python');
const patterns=${JSON.stringify(deterministicPatterns)};
const files=[];
for(const pattern of patterns){
  const directory=path.dirname(pattern),basename=path.basename(pattern);
  const selected=basename==='*.test.mjs'?fs.readdirSync('/candidate/'+directory).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>directory+'/'+name):[pattern];
  if(!selected.length)throw new Error('protected deterministic pattern has no files: '+pattern);
  for(const relative of selected){
    const stat=fs.lstatSync('/candidate/'+relative);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('protected deterministic test is not regular: '+relative);
    if(process.argv[2]==='protected-tests'&&['tests/verification/qualification-world.test.mjs','tests/verification/protected-hosted-product-identities.test.mjs'].includes(relative))continue;
    files.push('/candidate/'+relative);
  }
}
if(!files.length||new Set(files).size!==files.length)throw new Error('deterministic census empty or duplicate');
if(process.argv[2]==='protected-tests') {
 process.chdir('/candidate');process.env.PATH='/tmp/bin:'+process.env.PATH;process.env.PYTHONPYCACHEPREFIX='/tmp/pycache';
 const collect=${collectDeterministicCensus.toString()};
 process.stdout.write(JSON.stringify(await collect(files)));
} else {
 execFileSync('node',['--test',...files],{stdio:'inherit',cwd:'/candidate',env:{PATH:'/tmp/bin:'+process.env.PATH,PYTHONPYCACHEPREFIX:'/tmp/pycache'}});
}
`);
  const deterministicOutput=path.join(outputRoot,'deterministic');fs.mkdirSync(deterministicOutput,{mode:0o777});fs.chmodSync(deterministicOutput,0o777);
  // Baseline is produced before candidate execution in a separate sandbox and
  // stays in this protected parent memory; neither candidate mount exposes it.
  const baselineOutput=path.join(outputRoot,'deterministic-baseline');fs.mkdirSync(baselineOutput,{mode:0o777});fs.chmodSync(baselineOutput,0o777);
  const captureCensus=(source,output)=>JSON.parse(text('docker',candidateSandboxArgs({source,output,script:deterministicScript,protectedTests:path.join(protectedRoot,'tests')}),{timeout:600_000,maxBuffer:32*1024*1024}));
  const expectedCensus=captureCensus(protectedRoot,baselineOutput);
  run('docker',candidateSandboxArgs({source:candidateRoot,output:deterministicOutput,script:deterministicScript}));
  const candidateCensus=captureCensus(candidateRoot,deterministicOutput);
  validateDeterministicCensus(expectedCensus,candidateCensus);
  if (!plan.scenarioIds.length) return proof;
  const products={};
  if(plan.hostedPartitions.some(partition=>partition.dataCapability==='qualification_fixture')){
  const { resolveQualificationScenarioBindings, validateQualificationHarnessBindings } = await import(module('tools/verification/qualification-scenario-bindings.mjs'));
  const buildScript = path.join(outputRoot, 'build.mjs');
  fs.writeFileSync(buildScript, "import { buildQualificationWorld } from '/candidate/tools/verification/qualification-world.mjs'; await buildQualificationWorld('/out/product');\n");
  const verifier = path.join(outputRoot, 'verify.mjs');
  fs.writeFileSync(verifier, `import fs from 'node:fs';
import { resolveQualificationScenarioBindings } from '/candidate/tools/verification/qualification-scenario-bindings.mjs';
import { verifyQualificationWorld, qualificationTrustDescriptor } from '/candidate/tools/verification/protected-qualification-oracle.mjs';
function inertTree(root){for(const name of fs.readdirSync(root)){const entry=root+'/'+name,stat=fs.lstatSync(entry);if(stat.isSymbolicLink()||(!stat.isFile()&&!stat.isDirectory()))throw new Error('publication contains nonregular input');if(stat.isDirectory())inertTree(entry);}}
inertTree('/product');
const manifest=await verifyQualificationWorld('/product');
const bindings=resolveQualificationScenarioBindings({productRoot:'/product',expectedProductDigest:manifest.productDigest});
const trust=qualificationTrustDescriptor(manifest);
if(trust.dataCapability!=='qualification_fixture'||trust.productDigest!==bindings.productDigest)throw new Error('independent product proof mismatch');
fs.writeFileSync('/out/trust.json',JSON.stringify(trust),{flag:'wx'});
`);
  const builds=[];
  for (let ordinal=0;ordinal<2;ordinal++) {
    const productDir=path.join(outputRoot,`build-${ordinal}`), trustedProofDir=path.join(outputRoot,`verified-${ordinal}`);
    for (const dir of [productDir,trustedProofDir]) {fs.mkdirSync(dir,{mode:0o777});fs.chmodSync(dir,0o777);}
    run('docker',candidateSandboxArgs({source:candidateRoot,output:productDir,script:buildScript}),{timeout:180_000});
    // Each candidate builder has terminated before the separate protected verifier starts.
    const productRoot=path.join(productDir,'product');
    if(!fs.lstatSync(productRoot).isDirectory() || fs.lstatSync(productRoot).isSymbolicLink() || !fs.lstatSync(path.join(productRoot,'fixture-manifest.json')).isFile() || fs.lstatSync(path.join(productRoot,'fixture-manifest.json')).isSymbolicLink())throw new TypeError('product root or manifest is not an inert regular input');
    const verifierArgs=candidateSandboxArgs({source:protectedRoot,output:trustedProofDir,script:verifier});
    verifierArgs.splice(verifierArgs.indexOf(CANDIDATE_IMAGE),0,'--mount',`type=bind,src=${productRoot},dst=/product,readonly`);
    run('docker',verifierArgs,{timeout:180_000});
    builds.push({productRoot,trust:read(path.join(trustedProofDir,'trust.json'))});
  }
  validateDeterministicProduct(builds[0].trust.productDigest,builds[1].trust.productDigest);
  const {productRoot,trust}=builds[0];
  const bindings = resolveQualificationScenarioBindings({productRoot,expectedProductDigest:trust.productDigest});
  const protectedIdentities = read(path.join(protectedRoot,'tools/verification/protected-hosted-product-identities.json'));
  const candidateIdentities = read(path.join(candidateRoot,'tools/verification/protected-hosted-product-identities.json'));
  const expectedIdentities = structuredClone(protectedIdentities); expectedIdentities.qualification_fixture.digest = trust.productDigest;
  if (JSON.stringify(candidateIdentities)!==JSON.stringify(expectedIdentities)) throw new TypeError('candidate product repin not exact verified product');
  const mirrorPath='tests/verification/protected-hosted-product-identities.test.mjs';
  validateProductIdentityMirror(fs.readFileSync(path.join(protectedRoot,mirrorPath),'utf8'),fs.readFileSync(path.join(candidateRoot,mirrorPath),'utf8'),protectedIdentities.qualification_fixture.digest,trust.productDigest);
  function sources(root) {
    const result={};
    function walk(relative='') { for(const name of fs.readdirSync(path.join(root,'e2e',relative)).sort()) {if(name==='node_modules')continue;const key=path.posix.join(relative,name);const stat=fs.lstatSync(path.join(root,'e2e',key));if(stat.isSymbolicLink())throw new TypeError('harness symlink');if(stat.isDirectory())walk(key);else if(stat.isFile()){const bytes=fs.readFileSync(path.join(root,'e2e',key));result[key]=key.endsWith('.mjs')?bytes.toString('utf8'):bytes.toString('base64');}else throw new TypeError('harness specialfile');} }
    walk();return result;
  }
  validateQualificationHarnessBindings({protectedSources:sources(protectedRoot),candidateSources:sources(candidateRoot),bindings});
  products.qualification_fixture={productRoot,trust};
  }
  if(plan.hostedPartitions.some(partition=>partition.dataCapability==='bounded_real_world')){
    const {buildBoundedRealWorld,verifyBoundedRealWorld,boundedTrustDescriptor}=await import(module('tools/verification/protected-bounded-oracle.mjs'));
    const productRoot=path.join(outputRoot,'bounded-product');
    const built=await buildBoundedRealWorld(productRoot,{sourceRoot:protectedRoot});
    const manifest=await verifyBoundedRealWorld(productRoot);
    const expected=read(path.join(protectedRoot,'tools/verification/protected-hosted-product-identities.json')).bounded_real_world;
    if(built.fixtureId!==expected.id||manifest.fixtureId!==expected.id||built.productDigest!==expected.digest||manifest.productDigest!==expected.digest)throw new TypeError('bounded protected product identity mismatch');
    products.bounded_real_world={productRoot,trust:boundedTrustDescriptor(manifest)};
  }
  // Only the protected package/config is ever evaluated on the host.
  run('npm',['ci','--prefix',path.join(protectedRoot,'e2e'),'--ignore-scripts','--no-audit','--no-fund']);
  const list=text('npm',['exec','--prefix','e2e','--','playwright','test','--config=e2e/playwright.config.mjs','--list'],{cwd:protectedRoot,env:{...env,ATLAS_ARTIFACTS_DIR:path.join(outputRoot,'list-artifacts')}});
  const fullCensus=resolveProtectedBrowserCensus(list,read(path.join(protectedRoot,'tools/verification/verification-catalog.json')));
  const protectedCensus=validateStableIdCensus(read(path.join(protectedRoot,'tools/verification/full-safety-net-stable-ids.json')));
  if(JSON.stringify([...fullCensus.scenarioIds].sort())!==JSON.stringify(protectedCensus.stableTestIds))throw new TypeError('runtime browser list differs from protected stable census');
  const inventory=resolveProtectedBrowserInventory(list,read(path.join(protectedRoot,'tools/verification/verification-catalog.json')));
  const pinnedInventory=read(path.join(protectedRoot,'tools/verification/protected-scenario-inventory.json'));
  if(JSON.stringify([...inventory.scenarioIds].sort())!==JSON.stringify([...pinnedInventory.stableTestIds].sort()))throw new TypeError('runtime browser inventory differs from protected inventory');
  const {buildVerificationAuthorityIdentity}=await import(module('tools/verification/verification-authority.mjs'));
  const {buildProtectedExecutionEnvironmentIdentity}=await import(module('tools/verification/protected-execution-environment.mjs'));
  const authority=await buildVerificationAuthorityIdentity({manifest:read(path.join(protectedRoot,'tools/verification/verification-authority-manifest.json')),readFile:async relative=>fs.readFileSync(path.join(protectedRoot,relative))});
  const environment=buildProtectedExecutionEnvironmentIdentity(read(path.join(protectedRoot,'tools/verification/protected-execution-environment.json')));
  const semantic=plan.semanticDigest;
  for(const partition of plan.hostedPartitions){
    const {productRoot,trust}=products[partition.dataCapability];
    const census=selectProtectedBrowserCensus(inventory,partition.scenarioIds);
    const listPath=path.join(outputRoot,`test-list-${partition.dataCapability}.txt`);fs.writeFileSync(listPath,census.testList);
  const browserArtifacts=path.join(outputRoot,`browser-${partition.dataCapability}`);fs.mkdirSync(browserArtifacts,{mode:0o777});fs.chmodSync(browserArtifacts,0o777);
  const composeEnv={...env,COMPOSE_PROJECT_NAME:`atlas-admission-${env.GITHUB_RUN_ID}-${partition.dataCapability.replaceAll('_','-')}`,ATLAS_CODE_REVISION:candidate.headSha,ATLAS_PLAN_SEMANTIC_DIGEST:semantic,ATLAS_PLAN_INSTANCE_DIGEST:canonicalDigest({semantic,runId:env.GITHUB_RUN_ID,attempt:1}),ATLAS_AUTHORITY_DIGEST:authority.authorityDigest,ATLAS_ENVIRONMENT_DIGEST:environment.environmentDigest,ATLAS_E2E_SHARD:'1/1',ATLAS_E2E_WORKERS:'1',ATLAS_E2E_DATA_CAPABILITY:partition.dataCapability,ATLAS_QUALIFICATION_PUBLICATION_HOST:productRoot,ATLAS_QUALIFICATION_TRUST_JSON:JSON.stringify(trust),ATLAS_EXECUTION_CONTEXT:candidateRoot,ATLAS_E2E_ARTIFACTS_HOST:browserArtifacts,ATLAS_PROTECTED_TEST_LIST:listPath};
  const compose=['compose','-f',path.join(protectedRoot,'e2e/compose.protected-hosted-executor.yml'),'-f',path.join(protectedRoot,'e2e/compose.github-hosted.yml')];
  try {
    run('docker',[...compose,'up','-d','--wait','atlas-publication','atlas-web'],{env:composeEnv});
    run('docker',[...compose,'build','e2e'],{env:composeEnv});
    run('docker',[...compose,'run','--rm','e2e','bash','-lc','exec ./node_modules/.bin/playwright test --config=playwright.config.mjs --test-list=/run/atlas-protected-test-list.txt --workers=1 --retries=0'],{env:composeEnv,timeout:3_600_000});
  } finally { run('docker',[...compose,'down','-v','--remove-orphans'],{env:composeEnv}); }
  const scenarioResults=validateBrowserSummary(read(path.join(browserArtifacts,'summary.json')),census.scenarioIds,candidate.headSha);
  const result={scenarioResults,workers:1,retries:0,dataCapability:partition.dataCapability,oracleDigest,productDigest:trust.productDigest};
  proof.browser.partitions.push(result);
  if(partition.dataCapability==='qualification_fixture')Object.assign(proof.browser,result);
  }
  return proof;
}

export function validateProducerEvent(event) {
  if(!['pull_request_target','workflow_dispatch'].includes(event))throw new TypeError('invalid protected producer event');
  return event;
}
export function validateProducerSnapshotAssociation({repository,prNumber,pr,repo,base,commit}) {
  const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
  if(repo?.full_name!==repository||pr?.number!==prNumber||pr?.state!=='open'||pr.head?.repo?.full_name!==repository||pr.base?.repo?.full_name!==repository||pr.base?.ref!==repo.default_branch||base?.ref!==`refs/heads/${repo.default_branch}`||!sha(pr.head?.sha)||!sha(pr.base?.sha)||base?.object?.sha!==pr.base.sha||commit?.sha!==pr.head.sha||!sha(commit?.tree?.sha))throw new TypeError('producer snapshot association invalid');
}
export async function runProtectedAdmission({ protectedRoot, candidateRoot, outputRoot, env = process.env }) {
  protectedRoot = path.resolve(protectedRoot); candidateRoot = path.resolve(candidateRoot); outputRoot = path.resolve(outputRoot);
  if (fs.existsSync(outputRoot)) throw new TypeError('proof output must be fresh');
  fs.mkdirSync(outputRoot, { recursive: true });
  const repository = env.GITHUB_REPOSITORY, prNumber = Number(env.ATLAS_PR_NUMBER);
  const producerEvent=validateProducerEvent(env.GITHUB_EVENT_NAME);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !Number.isSafeInteger(prNumber) || prNumber < 1 || env.GITHUB_RUN_ATTEMPT !== '1') throw new TypeError('invalid producer identity');
  const api = async endpoint => {
    const response = await fetch(`${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repository}/${endpoint}`, { headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (!response.ok) throw new Error(`GitHub read failed ${response.status}: ${endpoint}`);
    return response.json();
  };
  async function snapshot() {
    const pr = await api(`pulls/${prNumber}`), repo = await api('');
    if (pr.number!==prNumber||repo.full_name!==repository||!/^([a-f0-9]{40})$/.test(pr.head?.sha??'')||pr.state !== 'open' || pr.head.repo?.full_name !== repository || pr.base.repo?.full_name !== repository || pr.base.ref !== repo.default_branch) throw new TypeError('PR association invalid');
    const base = await api(`git/ref/heads/${encodeURIComponent(repo.default_branch)}`);
    if (pr.base.sha !== base.object.sha) throw new TypeError('protected base stale');
    const commit = await api(`git/commits/${pr.head.sha}`);
    validateProducerSnapshotAssociation({repository,prNumber,pr,repo,base,commit});
    const changedFiles = [];
    for (let page = 1; ; page++) {
      const rows = await api(`pulls/${prNumber}/files?per_page=100&page=${page}`);
      changedFiles.push(...rows.map(row => ({ path: row.filename, status: row.status, ...(row.previous_filename ? { previousPath: row.previous_filename } : {}) })));
      if (rows.length < 100) break;
      if (page >= 30) throw new TypeError('changed file enumeration truncated');
    }
    if (changedFiles.length !== pr.changed_files) throw new TypeError('changed file count drift');
    changedFiles.sort((a,b)=>a.path.localeCompare(b.path));
    return { repository, prNumber, headSha: pr.head.sha, baseSha: pr.base.sha, treeSha: commit.tree.sha, changedFiles };
  }
  const candidate = await snapshot();
  if (candidate.headSha !== env.ATLAS_CODE_REVISION || candidate.baseSha !== env.ATLAS_BASE_SHA) throw new TypeError('event snapshot stale');
  const { validateProtectedExecutionCandidate } = await import(pathToFileURL(path.join(protectedRoot, 'tools/verification/protected-admission-policy.mjs')));
  const admission = await classifyAdmission(() => validateProtectedExecutionCandidate({ protectedRoot, candidateRoot, currentCandidate: candidate }));
  if (admission.eligible === false) {
    if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, 'admission_eligible=false\n');
    return admission;
  }
  if (admission.eligible !== true) throw new TypeError('protected admission rejected candidate');
  const proof=await executeProtectedCandidateProof({protectedRoot,candidateRoot,outputRoot,candidate,admission,env});
  const jobs=await api(`actions/runs/${env.GITHUB_RUN_ID}/attempts/1/jobs?per_page=100`);
  const matches=jobs.jobs.filter(job=>job.name==='Protected admission proof'&&job.status==='in_progress');
  if(matches.length!==1||jobs.total_count>100)throw new TypeError('producer job association invalid');
  const finalAdmission=await validateProtectedExecutionCandidate({protectedRoot,candidateRoot,currentCandidate:candidate});
  if(JSON.stringify(finalAdmission)!==JSON.stringify(admission))throw new TypeError('local execution admission drift before publication');
  const finalCandidate=await snapshot();assertSameCandidate(candidate,finalCandidate);
  const envelope={schemaVersion:1,kind:'protected-admission',candidate,producer:{workflowPath:'.github/workflows/protected-admission.yml',event:producerEvent,runId:Number(env.GITHUB_RUN_ID),jobId:matches[0].id,runAttempt:1,sourceSha:candidate.baseSha},createdAt:new Date().toISOString(),proof};
  write(path.join(outputRoot,'protected-admission-evidence.json'),envelope);
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, 'admission_eligible=true\n');
  return envelope;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [protectedRoot,candidateRoot,outputRoot]=process.argv.slice(2);
  if(!protectedRoot||!candidateRoot||!outputRoot)throw new TypeError('usage: run-protected-admission.mjs protectedRoot candidateRoot outputRoot');
  await runProtectedAdmission({protectedRoot,candidateRoot,outputRoot});
}
