import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// Execute the unchanged entrypoint source with inert dependencies. This proves
// execution ordering and failure propagation without trusting candidate code or
// requiring live GitHub, Docker, or mutations to protected runner modules.
const harness = `
import vm from 'node:vm';
import fs from 'node:fs';
const {source,kind,fault}=JSON.parse(fs.readFileSync(0,'utf8'));
const calls=[];let snapshots=0,validations=0;
const candidate={repository:'Example/Atlas',prNumber:kind==='audit'?7:null,baseSha:'a'.repeat(40),headSha:'b'.repeat(40),treeSha:'c'.repeat(40),changedFiles:[{path:'web/a.js',status:'modified'}]};
const context=vm.createContext({process:{argv:['node','runner','/protected','/candidate','/output'],env:{GITHUB_EVENT_NAME:fault==='event'?'pull_request':kind==='audit'?'pull_request_target':'merge_group',ATLAS_EVENT_REPOSITORY:'Example/Atlas',ATLAS_DEFAULT_BRANCH:'main',ATLAS_BASE_REF:kind==='audit'?'main':'refs/heads/main',ATLAS_EVENT_ACTION:'checks_requested',GITHUB_SHA:candidate.headSha,GITHUB_REPOSITORY:candidate.repository,ATLAS_PROTECTED_BASE_SHA:candidate.baseSha,ATLAS_CODE_REVISION:candidate.headSha,ATLAS_PR_NUMBER:'7'}},console:{log:()=>calls.push('publish')},JSON,Number,TypeError});
const deps={
 './protected-candidate-snapshot.mjs':{
  readCandidateSnapshot:async()=>{calls.push('snapshot');snapshots++;if(fault==='snapshot')throw Error('snapshot denied');return {...candidate,treeSha:fault==='drift'&&snapshots>1?'d'.repeat(40):candidate.treeSha};},
  gitChangedFiles:()=>{calls.push('files');return candidate.changedFiles;}
 },
 './protected-admission-policy.mjs':{validateProtectedExecutionCandidate:()=>{calls.push('validate');validations++;if(fault==='validation'||fault==='finalValidation'&&validations>1)throw Error('candidate denied');return {eligible:true};}},
 './run-protected-admission.mjs':{
  executeProtectedCandidateProof:async()=>{calls.push('proof');if(fault==='proof')throw Error('proof denied');return {plan:{}};},
  assertSameCandidate:(a,b)=>{calls.push('compare');if(JSON.stringify(a)!==JSON.stringify(b))throw Error('candidate drift');}
 },
 'node:child_process':{execFileSync:(command,args)=>{calls.push('provenance');if(command!=='python3'||args[0]!=='-I'||args[1]!=='/candidate/tools/governance/verify_extraction_provenance.py')throw Error('unsafe command');if(fault==='provenance')throw Error('provenance denied');}},
 'node:path':{default:{join:(...parts)=>parts.join('/')}},
 'node:fs':{default:{writeFileSync:(p,bytes,options)=>{if(options.flag!=='wx')throw Error('evidence overwrite');calls.push('write');}}}
};
const module=new vm.SourceTextModule(source,{context});
await module.link(async specifier=>{if(!deps[specifier])throw Error('unexpected dependency '+specifier);const entries=deps[specifier];return new vm.SyntheticModule(Object.keys(entries),function(){for(const [key,value] of Object.entries(entries))this.setExport(key,value);},{context});});
let error=null;try{await module.evaluate();}catch(e){error=e.message;}
process.stdout.write(JSON.stringify({calls,error}));
`;
function execute(kind,fault='none') {
  const filename=kind==='audit'?'run-protected-authority-audit.mjs':'run-protected-merge-group.mjs';
  const source=fs.readFileSync(new URL(`../../tools/verification/${filename}`,import.meta.url),'utf8');
  return JSON.parse(execFileSync(process.execPath,['--experimental-vm-modules','--no-warnings','--input-type=module','-e',harness],{input:JSON.stringify({source,kind,fault}),encoding:'utf8'}));
}
for(const kind of ['audit','merge']) {
 test(`${kind}: exact candidate validation precedes isolated provenance and publication follows final reread`,()=>{
  const {calls,error}=execute(kind);assert.equal(error,null);
  assert.ok(calls.indexOf('validate')<calls.indexOf('provenance'));
  assert.ok(calls.lastIndexOf('snapshot')>calls.indexOf('provenance'));
  assert.ok(calls.indexOf('compare')<calls.indexOf('publish'));
  if(kind==='merge'){assert.ok(calls.indexOf('provenance')<calls.indexOf('proof'));assert.ok(calls.lastIndexOf('validate')<calls.indexOf('write'));}
 });
 for(const fault of ['snapshot','validation','provenance','drift'])test(`${kind}: ${fault} rejection cannot publish accepted evidence`,()=>{
  const {calls,error}=execute(kind,fault);assert.ok(error);
  assert.ok(!calls.includes('publish'));assert.ok(!calls.includes('write'));
  if(['snapshot','validation'].includes(fault))assert.ok(!calls.includes('provenance'));
  if(['snapshot','validation','provenance'].includes(fault))assert.ok(!calls.includes('proof'));
 });
}
for(const fault of ['proof','finalValidation','event'])test(`merge: ${fault} cannot publish proof`,()=>{
 const {calls,error}=execute('merge',fault);assert.ok(error);assert.ok(!calls.includes('write'));assert.ok(!calls.includes('publish'));
 if(fault==='event')assert.deepEqual(calls,[]);
});
