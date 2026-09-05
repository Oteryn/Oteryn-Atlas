import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const source=fs.readFileSync(new URL('../../tools/verification/run-protected-authority-audit.mjs',import.meta.url),'utf8');
const driver=`
import fs from 'node:fs';import vm from 'node:vm';
const {source,fault}=JSON.parse(fs.readFileSync(0,'utf8')),calls=[];
const env={GITHUB_EVENT_NAME:'merge_group',GITHUB_REPOSITORY:'Example/Atlas',ATLAS_EVENT_REPOSITORY:'Example/Atlas',ATLAS_DEFAULT_BRANCH:'stable/next',ATLAS_BASE_REF:'refs/heads/stable/next',ATLAS_EVENT_ACTION:'checks_requested',ATLAS_CODE_REVISION:'b'.repeat(40),ATLAS_PROTECTED_BASE_SHA:'a'.repeat(40),GITHUB_SHA:'b'.repeat(40)};
if(fault==='event')env.GITHUB_EVENT_NAME='push';if(fault==='repository')env.ATLAS_EVENT_REPOSITORY='Other/Atlas';if(fault==='baseRef')env.ATLAS_BASE_REF='refs/heads/other';if(fault==='head')env.GITHUB_SHA='d'.repeat(40);if(fault==='action')env.ATLAS_EVENT_ACTION='destroyed';
let snapshots=0,diffs=0;
const deps={
 './protected-candidate-snapshot.mjs':{gitChangedFiles:()=>{calls.push('files');diffs++;return [{path:fault==='fileDrift'&&diffs>1?'changed':'web/a.js',status:'modified'}];},readCandidateSnapshot:async options=>{calls.push('snapshot');snapshots++;if(options.prNumber!==null)throw Error('MQ must not invent PR association');return {...options,treeSha:fault==='treeDrift'&&snapshots>1?'d'.repeat(40):'c'.repeat(40)};}},
 './protected-admission-policy.mjs':{validateProtectedExecutionCandidate:()=>{calls.push('validate');if(fault==='validation')throw Error('denied');return {eligible:true};}},
 './run-protected-admission.mjs':{assertSameCandidate:(a,b)=>{calls.push('compare');if(JSON.stringify(a)!==JSON.stringify(b))throw Error('drift');}},
 'node:child_process':{execFileSync:(cmd,args)=>{calls.push('python');if(cmd!=='python3'||args[0]!=='-I')throw Error('isolation missing');}},
 'node:path':{default:{join:(...p)=>p.join('/')}}
};
const context=vm.createContext({process:{argv:['node','audit','/protected','/candidate'],env},console:{log:()=>calls.push('publish')},Number,TypeError});
const module=new vm.SourceTextModule(source,{context});await module.link(specifier=>{const d=deps[specifier];if(!d)throw Error(specifier);return new vm.SyntheticModule(Object.keys(d),function(){for(const[k,v]of Object.entries(d))this.setExport(k,v);},{context});});let error=null;try{await module.evaluate();}catch(e){error=e.message;}process.stdout.write(JSON.stringify({calls,error}));
`;
function execute(fault='none'){return JSON.parse(execFileSync(process.execPath,['--experimental-vm-modules','--no-warnings','--input-type=module','-e',driver],{input:JSON.stringify({source,fault}),encoding:'utf8'}));}
test('MQ audit validates exact synthetic candidate before Python and rereads complete files before publication',()=>{
 const {calls,error}=execute();assert.equal(error,null);assert.equal(calls.filter(x=>x==='files').length,2);assert.ok(calls.indexOf('validate')<calls.indexOf('python'));assert.ok(calls.lastIndexOf('snapshot')<calls.indexOf('publish'));
});
for(const fault of ['event','repository','baseRef','head','action','validation','fileDrift','treeDrift'])test(`MQ audit rejects ${fault} without publication`,()=>{
 const {calls,error}=execute(fault);assert.ok(error);assert.ok(!calls.includes('publish'));if(!fault.endsWith('Drift'))assert.ok(!calls.includes('python'));
});

test('mandatory audit never treats rejected identities as skipped or supersedes an in-flight required run',()=>{
 const workflow=fs.readFileSync(new URL('../../.github/workflows/merge-authority-audit.yml',import.meta.url),'utf8');
 assert.doesNotMatch(workflow,/^    if:/m);
 assert.match(workflow,/cancel-in-progress: false/);
});
