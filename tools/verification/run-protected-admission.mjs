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

export async function runProtectedAdmission({ protectedRoot, candidateRoot, outputRoot, env = process.env }) {
  protectedRoot = path.resolve(protectedRoot); candidateRoot = path.resolve(candidateRoot); outputRoot = path.resolve(outputRoot);
  if (fs.existsSync(outputRoot)) throw new TypeError('proof output must be fresh');
  fs.mkdirSync(outputRoot, { recursive: true });
  const repository = env.GITHUB_REPOSITORY, prNumber = Number(env.ATLAS_PR_NUMBER);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !Number.isSafeInteger(prNumber) || prNumber < 1 || env.GITHUB_RUN_ATTEMPT !== '1') throw new TypeError('invalid producer identity');
  const api = async endpoint => {
    const response = await fetch(`${env.GITHUB_API_URL || 'https://api.github.com'}/repos/${repository}/${endpoint}`, { headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    if (!response.ok) throw new Error(`GitHub read failed ${response.status}: ${endpoint}`);
    return response.json();
  };
  async function snapshot() {
    const pr = await api(`pulls/${prNumber}`), repo = await api('');
    if (pr.state !== 'open' || pr.head.repo?.full_name !== repository || pr.base.repo?.full_name !== repository || pr.base.ref !== repo.default_branch) throw new TypeError('PR association invalid');
    const base = await api(`git/ref/heads/${encodeURIComponent(repo.default_branch)}`);
    if (pr.base.sha !== base.object.sha) throw new TypeError('protected base stale');
    const commit = await api(`git/commits/${pr.head.sha}`);
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
  const { validateProtectedAdmissionCandidate } = await import(pathToFileURL(path.join(protectedRoot, 'tools/verification/protected-admission-policy.mjs')));
  const admission = await classifyAdmission(() => validateProtectedAdmissionCandidate({ protectedRoot, candidateRoot, currentCandidate: candidate }));
  if (admission.eligible === false) {
    if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, 'admission_eligible=false\n');
    return admission;
  }
  if (admission.eligible !== true) throw new TypeError('protected admission rejected candidate');
  const module = relative => pathToFileURL(path.join(protectedRoot, relative)).href;
  const { resolveQualificationScenarioBindings, validateQualificationHarnessBindings } = await import(module('tools/verification/qualification-scenario-bindings.mjs'));
  const buildScript = path.join(outputRoot, 'build.mjs');
  fs.writeFileSync(buildScript, "import { buildQualificationWorld } from '/candidate/tools/verification/qualification-world.mjs'; await buildQualificationWorld('/out/product');\n");
  const verifier = path.join(outputRoot, 'verify.mjs');
  fs.writeFileSync(verifier, `import fs from 'node:fs';
import { resolveQualificationScenarioBindings } from '/candidate/tools/verification/qualification-scenario-bindings.mjs';
import { verifyQualificationWorld, qualificationTrustDescriptor } from '/candidate/tools/verification/qualification-world.mjs';
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
execFileSync('node',['--test',...files],{stdio:'inherit',cwd:'/candidate',env:{PATH:'/tmp/bin:'+process.env.PATH,PYTHONPYCACHEPREFIX:'/tmp/pycache'}});
`);
  const deterministicOutput=path.join(outputRoot,'deterministic');fs.mkdirSync(deterministicOutput,{mode:0o777});fs.chmodSync(deterministicOutput,0o777);
  run('docker',candidateSandboxArgs({source:candidateRoot,output:deterministicOutput,script:deterministicScript}));
  run('docker',candidateSandboxArgs({source:candidateRoot,output:deterministicOutput,script:deterministicScript,protectedTests:path.join(protectedRoot,'tests')}));
  // Only the protected package/config is ever evaluated on the host.
  run('npm',['ci','--prefix',path.join(protectedRoot,'e2e'),'--ignore-scripts','--no-audit','--no-fund']);
  const list=text('npm',['exec','--prefix','e2e','--','playwright','test','--config=e2e/playwright.config.mjs','--list'],{cwd:protectedRoot,env:{...env,ATLAS_ARTIFACTS_DIR:path.join(outputRoot,'list-artifacts')}});
  const census=resolveProtectedBrowserCensus(list,read(path.join(protectedRoot,'tools/verification/verification-catalog.json')));
  const protectedCensus=validateStableIdCensus(read(path.join(protectedRoot,'tools/verification/full-safety-net-stable-ids.json')));
  if(JSON.stringify([...census.scenarioIds].sort())!==JSON.stringify(protectedCensus.stableTestIds))throw new TypeError('runtime browser list differs from protected stable census');
  const listPath=path.join(outputRoot,'test-list.txt');fs.writeFileSync(listPath,census.testList);
  const {buildVerificationAuthorityIdentity}=await import(module('tools/verification/verification-authority.mjs'));
  const {buildProtectedExecutionEnvironmentIdentity}=await import(module('tools/verification/protected-execution-environment.mjs'));
  const {canonicalDigest}=await import(module('tools/verification/anti-loop-common.mjs'));
  const authority=await buildVerificationAuthorityIdentity({manifest:read(path.join(protectedRoot,'tools/verification/verification-authority-manifest.json')),readFile:async relative=>fs.readFileSync(path.join(protectedRoot,relative))});
  const environment=buildProtectedExecutionEnvironmentIdentity(read(path.join(protectedRoot,'tools/verification/protected-execution-environment.json')));
  const oracleDigest=protectedOracleDigest(protectedRoot),semantic=canonicalDigest({candidate,oracleDigest,scenarioIds:census.scenarioIds,productDigest:trust.productDigest});
  const browserArtifacts=path.join(outputRoot,'browser');fs.mkdirSync(browserArtifacts,{mode:0o777});fs.chmodSync(browserArtifacts,0o777);
  const composeEnv={...env,COMPOSE_PROJECT_NAME:`atlas-admission-${env.GITHUB_RUN_ID}`,ATLAS_CODE_REVISION:candidate.headSha,ATLAS_PLAN_SEMANTIC_DIGEST:semantic,ATLAS_PLAN_INSTANCE_DIGEST:canonicalDigest({semantic,runId:env.GITHUB_RUN_ID,attempt:1}),ATLAS_AUTHORITY_DIGEST:authority.authorityDigest,ATLAS_ENVIRONMENT_DIGEST:environment.environmentDigest,ATLAS_E2E_SHARD:'1/1',ATLAS_E2E_WORKERS:'1',ATLAS_E2E_DATA_CAPABILITY:'qualification_fixture',ATLAS_QUALIFICATION_PUBLICATION_HOST:productRoot,ATLAS_QUALIFICATION_TRUST_JSON:JSON.stringify(trust),ATLAS_EXECUTION_CONTEXT:candidateRoot,ATLAS_E2E_ARTIFACTS_HOST:browserArtifacts,ATLAS_PROTECTED_TEST_LIST:listPath};
  const compose=['compose','-f',path.join(protectedRoot,'e2e/compose.protected-hosted-executor.yml'),'-f',path.join(protectedRoot,'e2e/compose.github-hosted.yml')];
  try {
    run('docker',[...compose,'up','-d','--wait','atlas-publication','atlas-web'],{env:composeEnv});
    run('docker',[...compose,'build','e2e'],{env:composeEnv});
    run('docker',[...compose,'run','--rm','e2e','bash','-lc','exec ./node_modules/.bin/playwright test --config=playwright.config.mjs --test-list=/run/atlas-protected-test-list.txt --workers=1 --retries=0'],{env:composeEnv,timeout:3_600_000});
  } finally { run('docker',[...compose,'down','-v','--remove-orphans'],{env:composeEnv}); }
  const scenarioResults=validateBrowserSummary(read(path.join(browserArtifacts,'summary.json')),census.scenarioIds,candidate.headSha);
  const jobs=await api(`actions/runs/${env.GITHUB_RUN_ID}/attempts/1/jobs?per_page=100`);
  const matches=jobs.jobs.filter(job=>job.name==='Protected admission proof'&&job.status==='in_progress');
  if(matches.length!==1||jobs.total_count>100)throw new TypeError('producer job association invalid');
  const finalCandidate=await snapshot();assertSameCandidate(candidate,finalCandidate);
  const envelope={schemaVersion:1,kind:'protected-admission',candidate,producer:{workflowPath:'.github/workflows/protected-admission.yml',event:'pull_request_target',runId:Number(env.GITHUB_RUN_ID),jobId:matches[0].id,runAttempt:1,sourceSha:candidate.baseSha},createdAt:new Date().toISOString(),proof:{deterministic:{groups:admission.requiredGroups.filter(group=>group.startsWith('deterministic.')),result:'PASS'},browser:{scenarioResults,workers:1,retries:0,dataCapability:'qualification_fixture',oracleDigest,productDigest:trust.productDigest}}};
  write(path.join(outputRoot,'protected-admission-evidence.json'),envelope);
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, 'admission_eligible=true\n');
  return envelope;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [protectedRoot,candidateRoot,outputRoot]=process.argv.slice(2);
  if(!protectedRoot||!candidateRoot||!outputRoot)throw new TypeError('usage: run-protected-admission.mjs protectedRoot candidateRoot outputRoot');
  await runProtectedAdmission({protectedRoot,candidateRoot,outputRoot});
}
