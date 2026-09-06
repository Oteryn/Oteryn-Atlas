import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as producer from '../../tools/verification/run-protected-admission.mjs';

const root=path.resolve(new URL('../..',import.meta.url).pathname);
const context=()=>({plan:{review:[{}]},proofPurpose:'candidate',producerJobId:43,freshSnapshot:async()=>{},env:{GITHUB_EVENT_NAME:'pull_request_target',GITHUB_RUN_ID:'42',GITHUB_RUN_ATTEMPT:'1'}});
test('PR capture requires current independently resolved job and fresh snapshot',()=>{
  assert.equal(typeof producer.requiresProtectedVisualCapture,'function');
  assert.equal(producer.requiresProtectedVisualCapture(context()),true);
  for(const mutate of [c=>delete c.producerJobId,c=>delete c.freshSnapshot,c=>c.env.GITHUB_RUN_ATTEMPT='2',c=>c.env.GITHUB_RUN_ID='invalid']){
    const c=context();mutate(c);assert.throws(()=>producer.requiresProtectedVisualCapture(c));
  }
});
test('standalone bound diagnostic may capture without pretending to be a PR event',()=>{
  const c=context();c.env.GITHUB_EVENT_NAME='push';assert.equal(producer.requiresProtectedVisualCapture(c),true);
});
test('nonreview candidate and depth execution need no visual producer context',()=>{
  for(const proofPurpose of ['candidate','depth'])assert.equal(producer.requiresProtectedVisualCapture({plan:{review:[]},proofPurpose}),false);
});
test('review-bearing MQ fallback cannot mint replacement independent review even with job metadata',()=>{
  const c=context();c.env.GITHUB_EVENT_NAME='merge_group';assert.throws(()=>producer.requiresProtectedVisualCapture(c),/independent PR/);
});
test('actual shared executor rejects review-bearing MQ before Docker or proof generation',async t=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-proof-callers-'));t.after(()=>fs.rmSync(output,{recursive:true,force:true}));
  await assert.rejects(producer.executeProtectedCandidateProof({protectedRoot:root,candidateRoot:root,outputRoot:output,candidate:{repository:'Example/Atlas',prNumber:null,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'web/fullworld-app.mjs',status:'modified'}]},admission:{eligible:true,forceFull:true},env:{GITHUB_EVENT_NAME:'merge_group'}}),/independent PR/);
  assert.deepEqual(fs.readdirSync(output),[],'context rejection must precede generated executable proof files');
});

// Execute the actual depth and MQ entrypoint sources, replacing only external
// process/GitHub/filesystem boundaries and the expensive proof execution boundary.
// Their real argument objects are checked by the production capture guard.
const harness=String.raw`
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {pathToFileURL} from 'node:url';
const {root,kind,review}=JSON.parse(fs.readFileSync(0,'utf8'));
const {requiresProtectedVisualCapture}=await import(pathToFileURL(path.join(root,'tools/verification/run-protected-admission.mjs')));
const sha='a'.repeat(40),tree='b'.repeat(40),candidate={repository:'Example/Atlas',prNumber:null,headSha:sha,baseSha:sha,treeSha:tree,changedFiles:[{path:'README.md',status:'modified'}]},calls=[];
const filename=kind==='depth'?'run-protected-main-depth.mjs':'run-protected-merge-group.mjs',file=path.join(root,'tools/verification',filename);
const env={GITHUB_REPOSITORY:candidate.repository,GITHUB_EVENT_NAME:kind==='depth'?'schedule':'merge_group',GITHUB_REF:'refs/heads/main',GITHUB_SHA:sha,GITHUB_RUN_ID:'42',GITHUB_RUN_ATTEMPT:'1',GITHUB_JOB:'protected-depth',ATLAS_CODE_REVISION:sha,ATLAS_PROTECTED_BASE_SHA:sha};
const processValue={env,argv:kind==='depth'?['node',file,root,'/out']:['node',file,root,root,'/out']};
const execute=async options=>{calls.push({purpose:options.proofPurpose??'candidate',capture:requiresProtectedVisualCapture({...options,plan:{review:review?[{}]:[]},env})});return {plan:{proofPurpose:options.proofPurpose,evidenceKind:'protected-main-depth-v1'}};};
const modules={
 'node:fs':{default:{writeFileSync:()=>calls.push('write')}},'node:path':{default:path},'node:url':{pathToFileURL},
 'node:child_process':{execFileSync:(command,args)=>{if(command!=='git')return '';if(args.includes('status'))return '';return args.includes('HEAD^{tree}')?tree:sha;}},
 './protected-candidate-snapshot.mjs':{githubRequest:async endpoint=>endpoint.includes('/git/ref/')?{object:{sha}}:{full_name:candidate.repository,default_branch:'main'},readCandidateSnapshot:async()=>candidate,gitChangedFiles:()=>candidate.changedFiles},
 './protected-admission-policy.mjs':{validateProtectedExecutionCandidate:()=>({eligible:true,forceFull:false})},
 './run-protected-admission.mjs':{executeProtectedCandidateProof:execute,assertSameCandidate:()=>{}}
};
const context=vm.createContext({process:processValue,console:{log:()=>{}}});
const entry=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,initializeImportMeta:meta=>meta.url=pathToFileURL(file).href});
await entry.link(specifier=>{const exports=modules[specifier];if(!exports)throw Error('unmocked dependency '+specifier);return new vm.SyntheticModule(Object.keys(exports),function(){for(const key of Object.keys(exports))this.setExport(key,exports[key]);},{context});});
try{await entry.evaluate();process.stdout.write(JSON.stringify({calls}));}catch(error){process.stdout.write(JSON.stringify({calls,error:error.message}));}
`;
for(const kind of ['depth','MQ'])test(`actual ${kind} caller remains valid without PR capture metadata for a nonreview plan`,()=>{
  const result=JSON.parse(execFileSync(process.execPath,['--experimental-vm-modules','--no-warnings','--input-type=module','-e',harness],{input:JSON.stringify({root,kind,review:false}),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
  assert.equal(result.error,undefined);assert.equal(result.calls[0].capture,false);
});
test('actual review-bearing MQ fallback refuses publication and requires the existing shared PR consumer',()=>{
  const result=JSON.parse(execFileSync(process.execPath,['--experimental-vm-modules','--no-warnings','--input-type=module','-e',harness],{input:JSON.stringify({root,kind:'MQ',review:true}),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
  assert.match(result.error,/independent PR/);assert.equal(result.calls.includes('write'),false);
});
