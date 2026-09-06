import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {evaluateProtectedRouting} from '../../tools/verification/protected-semantic-routing.mjs';
import {canonicalJson} from '../../tools/verification/verification-plan-schema.mjs';
import {protectedReviewDigest} from '../../tools/verification/protected-review-evidence.mjs';
import {protectedOracleDigest,CANDIDATE_IMAGE} from '../../tools/verification/run-protected-admission.mjs';

const root=fileURLToPath(new URL('../..',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,'tools/verification',p),'utf8'));
const hash='sha256:'+'a'.repeat(64), workflow='.github/workflows/protected-admission.yml';

// Exercise the real CLI, file loader, planner, artifact decoder and PR/MQ fan-in.
// Only the external GitHub API is replaced with deterministic fixture responses.
function fixture(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-cli-census-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 // The mounted source tree may be owned by another UID or lack Git metadata.
 // Build a real, current-user-owned repository for the CLI's protected checkout.
 const protectedRoot=path.join(dir,'protected');
 fs.mkdirSync(path.join(protectedRoot,'tools/verification'),{recursive:true});
 for(const name of ['verification-catalog.json','full-safety-net-stable-ids.json','impact-manifest.json','protected-scenario-inventory.json','protected-routing.json','protected-visual-capture-contract.json']) {
  fs.copyFileSync(path.join(root,'tools/verification',name),path.join(protectedRoot,'tools/verification',name));
 }
 fs.mkdirSync(path.join(protectedRoot,'e2e/support'),{recursive:true});
 fs.copyFileSync(path.join(root,'e2e/support/visual-oracle.mjs'),path.join(protectedRoot,'e2e/support/visual-oracle.mjs'));
 const git=(...args)=>execFileSync('git',['-C',protectedRoot,'-c','core.hooksPath=/dev/null',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 git('init','--quiet');git('add','.');
 git('-c','user.name=Contract fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m','Protected contract inputs');
 const c={repository:'Example/Atlas',prNumber:7,headSha:'a'.repeat(40),baseSha:git('rev-parse','HEAD'),treeSha:'c'.repeat(40),changedFiles:[{path:'tools/verification/qualification-world.mjs',status:'modified'}]};
 const census=read('full-safety-net-stable-ids.json');
 const p=evaluateProtectedRouting({candidate:c,manifest:read('impact-manifest.json'),catalog:read('verification-catalog.json'),census,inventory:read('protected-scenario-inventory.json'),routing:read('protected-routing.json'),forceFull:true});
 const plan={semanticDigest:p.semanticDigest,requiredGroups:p.requiredGroups,scenarioIds:p.scenarioIds,dataCapabilities:p.capabilities,profile:p.profile,proofPurpose:p.proofPurpose,evidenceKind:p.evidenceKind,propertyObligations:p.propertyObligations,hostedPartitions:p.hostedPartitions,specialist:p.specialist,review:p.review};
 const oracleDigest=protectedOracleDigest(protectedRoot), now=Date.now(),time=n=>new Date(now+n*1000).toISOString();
 const producer={workflowPath:workflow,sourceSha:c.baseSha,runId:42,jobId:43,runAttempt:1};
 const partitions=plan.hostedPartitions.map(part=>({dataCapability:part.dataCapability,scenarioResults:part.scenarioIds.map(id=>({id,result:'PASS'})),productDigest:hash,oracleDigest,workers:1,retries:0}));
 const frames=read('protected-visual-capture-contract.json').requiredFrames;
 const captures=plan.hostedPartitions.flatMap(part=>{
  const required=frames.filter(f=>part.scenarioIds.includes(f.stableTestId));if(!required.length)return [];
  const ids=[...new Set([...plan.review.filter(r=>r.dataCapability===part.dataCapability).flatMap(r=>r.scenarioIds),...required.map(f=>f.stableTestId)])].sort();
  return [{schemaVersion:1,kind:'protected-visual-capture',candidate:c,producer,planDigest:plan.semanticDigest,oracleDigest,productDigest:hash,dataCapability:part.dataCapability,scenarioIds:ids,summary:{path:'summary.json',digest:hash},frames:required.map(f=>({frameId:f.frameId,scenarioId:f.stableTestId,path:`frames/${f.frameId}.png`,digest:hash}))}];
 });
 const reviewer={id:5,login:'maintainer'};
 const review={id:44,user:reviewer,state:'COMMENTED',commit_id:c.headSha,pull_request_url:`https://api.github.com/repos/${c.repository}/pulls/${c.prNumber}`,submitted_at:time(-10),body:JSON.stringify({schemaVersion:1,kind:'protected-visual-review-bundle',candidate:c,captures:captures.map(cap=>({schemaVersion:1,kind:'protected-visual-review',candidate:c,captureDigest:protectedReviewDigest(canonicalJson(cap)),planDigest:cap.planDigest,summaryDigest:cap.summary.digest,reviewer,reviewedAllFrames:true,result:'PASS',frames:cap.frames.map(f=>({...f,result:'PASS'}))}))})};
 const qualification=partitions.find(p=>p.dataCapability==='qualification_fixture');
 const reference={schemaVersion:1,identity:{repository:c.repository,pr:c.prNumber,headSha:c.headSha,baseSha:c.baseSha,candidateTree:c.treeSha,referenceTree:git('rev-parse','HEAD^{tree}'),productDigest:hash,workflow,runId:42,jobId:43,attempt:1,browserImage:CANDIDATE_IMAGE},contractDigest:hash,images:[['desktop-chromium','desktop-inspector.png'],['mobile-chromium','mobile-inspector-panel.png']].map(([project,name])=>({project,name,bytes:100,width:50,height:40,sha256:hash}))};
 const evidence={schemaVersion:1,kind:'protected-admission',candidate:c,producer:{...producer,event:'workflow_dispatch'},createdAt:time(-40),proof:{plan,deterministic:{groups:plan.requiredGroups.filter(g=>g.startsWith('deterministic.')),result:'PASS'},browser:{scenarioResults:qualification.scenarioResults,workers:1,retries:0,dataCapability:'qualification_fixture',oracleDigest,productDigest:hash,partitions},reviewCaptures:captures,visualReferences:[reference]}};
 const pr={number:c.prNumber,state:'open',merged:false,changed_files:1,head:{sha:c.headSha,repo:{id:99,full_name:c.repository}},base:{sha:c.baseSha,ref:'main',repo:{id:99,full_name:c.repository}}};
 const run={id:42,run_attempt:1,path:workflow,event:'workflow_dispatch',head_sha:c.baseSha,status:'completed',conclusion:'success',repository:{id:99,full_name:c.repository},created_at:time(-60),updated_at:time(-20),display_title:`protected-admission:${c.repository}:${c.prNumber}:${c.headSha}:${c.baseSha}`};
 const job={id:43,run_id:42,run_attempt:1,head_sha:c.baseSha,name:'Protected admission proof',status:'completed',conclusion:'success',runner_group_id:0,labels:['ubuntu-24.04'],started_at:time(-50),completed_at:time(-30)};
 const artifact={id:45,name:'protected-admission-evidence-42-1',expired:false,workflow_run:{id:42,repository_id:99,head_repository_id:99,head_sha:c.baseSha}};
 const prefix=`/repos/${c.repository}`,queue='9'.repeat(40);
 const responses={
  [prefix]:{full_name:c.repository,default_branch:'main'},
  [`${prefix}/git/ref/heads/main`]:{object:{sha:c.baseSha}},
  [`${prefix}/pulls/7`]:pr,[`${prefix}/pulls/7/files`]:[{filename:c.changedFiles[0].path,status:'modified'}],
  [`${prefix}/commits/${c.headSha}`]:{commit:{tree:{sha:c.treeSha}}},
  [`${prefix}/commits/${queue}`]:{commit:{tree:{sha:c.treeSha}}},[`${prefix}/commits/${queue}/pulls`]:[pr],
  [`${prefix}/actions/workflows/protected-admission.yml/runs`]:{workflow_runs:[run]},
  [`${prefix}/actions/runs/42`]:run,[`${prefix}/actions/runs/42/attempts/1/jobs`]:{jobs:[job]},
  [`${prefix}/actions/runs/42/artifacts`]:{artifacts:[artifact]},
  [`${prefix}/pulls/7/reviews`]:[review],[`${prefix}/collaborators/maintainer/permission`]:{permission:'admin',role_name:'admin',user:reviewer},
 };
 fs.writeFileSync(path.join(dir,'responses.json'),JSON.stringify(responses));
 fs.writeFileSync(path.join(dir,'evidence.json'),JSON.stringify(evidence));
 execFileSync('python3',['-c','import sys,zipfile\nwith zipfile.ZipFile(sys.argv[2],"w") as z: z.write(sys.argv[1],"protected-admission-evidence.json")',path.join(dir,'evidence.json'),path.join(dir,'evidence.zip')]);
 fs.writeFileSync(path.join(dir,'gh'),`#!${process.execPath}\nconst fs=require('fs'),path=require('path');const route=process.argv[3].split('?')[0];fs.appendFileSync(path.join(__dirname,'requests'),route+'\\n');if(route.endsWith('/artifacts/45/zip'))process.stdout.write(fs.readFileSync(path.join(__dirname,'evidence.zip')));else{const data=JSON.parse(fs.readFileSync(path.join(__dirname,'responses.json')));if(!(route in data))throw Error('unexpected API '+route);process.stdout.write(JSON.stringify(data[route]));}\n`,{mode:0o755});
 return {dir,c,responses,invoke(mode='PR',checkoutRoot=protectedRoot){const env={...process.env,PATH:`${dir}:${process.env.PATH}`,GITHUB_REPOSITORY:c.repository,ATLAS_CODE_REVISION:mode==='PR'?c.headSha:queue,ATLAS_PROTECTED_BASE_SHA:c.baseSha,GITHUB_OUTPUT:path.join(dir,'outputs')};delete env.ATLAS_PR_NUMBER;if(mode==='PR')env.ATLAS_PR_NUMBER=String(c.prNumber);return spawnSync(process.execPath,[path.join(root,'tools/verification/consume-protected-admission.mjs'),'--protected-root',checkoutRoot,'--output',path.join(dir,'result.json')],{env,encoding:'utf8'});}};
}
for(const mode of ['PR','MQ'])test(`actual ${mode} CLI consumes producer raw-census semantic proof with independent complete review`,t=>{
 const f=fixture(t),result=f.invoke(mode);assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).accepted,true);
 const requests=fs.readFileSync(path.join(f.dir,'requests'),'utf8').trim().split('\n');
 assert.equal(requests.filter(p=>p.endsWith('/pulls/7/reviews')).length,2,'review timeline must be reread');
 assert.equal(requests.filter(p=>p.endsWith('/collaborators/maintainer/permission')).length,2,'reviewer authority must be reread');
});
test('actual CLI still rejects malformed protected census before API or publication',t=>{
 const f=fixture(t),copy=path.join(f.dir,'invalid');fs.mkdirSync(path.join(copy,'tools/verification'),{recursive:true});
 for(const name of ['verification-catalog.json','full-safety-net-stable-ids.json'])fs.copyFileSync(path.join(root,'tools/verification',name),path.join(copy,'tools/verification',name));
 const census=read('full-safety-net-stable-ids.json');census.stableTestIds.push(census.stableTestIds[0]);fs.writeFileSync(path.join(copy,'tools/verification/full-safety-net-stable-ids.json'),JSON.stringify(census));
 const result=f.invoke('PR',copy);assert.equal(result.status,1);assert.match(result.stderr,/stable census contains duplicates/);assert.equal(fs.existsSync(path.join(f.dir,'requests')),false);assert.equal(fs.existsSync(path.join(f.dir,'outputs')),false);
});

test('CLI regression uses an owned fixture when source checkout is ownership-untrusted',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-untrusted-source-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const realGit=execFileSync('sh',['-c','command -v git'],{encoding:'utf8'}).trim();
 fs.writeFileSync(path.join(dir,'git'),`#!${process.execPath}\nconst {spawnSync}=require('node:child_process'),path=require('node:path');const args=process.argv.slice(2),i=args.indexOf('-C'),env={...process.env};if(i>=0&&path.resolve(args[i+1])===${JSON.stringify(path.resolve(root))})env.GIT_TEST_ASSUME_DIFFERENT_OWNER='1';const r=spawnSync(${JSON.stringify(realGit)},args,{env,stdio:'inherit'});if(r.error)throw r.error;process.exit(r.status);\n`,{mode:0o755});
 const originalPath=process.env.PATH;
 try {
  process.env.PATH=`${dir}:${originalPath}`;
  const source=spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'});
  assert.equal(source.status,128);assert.match(source.stderr,/dubious ownership/);
  const f=fixture(t),result=f.invoke();assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).accepted,true);
 } finally {process.env.PATH=originalPath;}
});
for(const field of ['head','base'])test(`actual CLI rejects wrong ${field} before evidence or publication`,t=>{
 const f=fixture(t);f.responses[`/repos/${f.c.repository}/pulls/7`][field].sha='f'.repeat(40);
 fs.writeFileSync(path.join(f.dir,'responses.json'),JSON.stringify(f.responses));
 const result=f.invoke();assert.equal(result.status,1);assert.match(result.stderr,field==='head'?/current PR head moved/:/live PR\/base association/);
 assert.equal(fs.existsSync(path.join(f.dir,'outputs')),false);
 assert.doesNotMatch(fs.readFileSync(path.join(f.dir,'requests'),'utf8'),/artifacts\/45\/zip/);
});
