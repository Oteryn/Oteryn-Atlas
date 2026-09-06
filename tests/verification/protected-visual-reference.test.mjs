import test from 'node:test';
import assert from 'node:assert/strict';
import * as reference from '../../tools/verification/protected-visual-reference.mjs';
const digest = c => `sha256:${c.repeat(64)}`;
const identity = () => ({repository:'example/repository',pr:7,headSha:'a'.repeat(40),baseSha:'b'.repeat(40),candidateTree:'c'.repeat(40),referenceTree:'d'.repeat(40),productDigest:digest('e'),workflow:'.github/workflows/protected-admission.yml',runId:1,jobId:2,attempt:1,browserImage:reference.PROTECTED_VISUAL_BROWSER});
const navigation = () => ({id:'semantic:independent-fixture',label:'Independent fixture',position:{x:10,y:20,floor:-7}});
const create = () => reference.createProtectedVisualReferenceContract({identity:identity(),navigation:navigation(),referenceOrigin:'http://reference:8080'});
test('valid exact reference contract retains independent source and complete pixel capture',()=>{
 const contract=create(); assert.equal(contract.identity.baseSha,'b'.repeat(40));
 assert.equal(contract.scenarios.length,2); assert.equal(contract.scenarios[0].selector,'#mobile-inspector-panel');
 assert.deepEqual(contract.scenarios[0].screenshot,{animations:'disabled',caret:'hide',scale:'css'});
 assert.match(contract.scenarios[0].entry,/semantic=semantic%3Aindependent-fixture/);
 assert.equal(contract.scenarios[1].context.deviceScaleFactor,2);
});
for(const key of ['repository','pr','headSha','baseSha','candidateTree','referenceTree','productDigest','workflow','runId','jobId','attempt','browserImage'])test(`missing identity ${key} rejects`,()=>{const value=identity();delete value[key];assert.throws(()=>reference.createProtectedVisualReferenceContract({identity:value,navigation:navigation(),referenceOrigin:'http://reference:8080'}));});
test('candidate may not select browser, screenshot policy, or reference URL credentials',()=>{
 assert.throws(()=>reference.createProtectedVisualReferenceContract({identity:{...identity(),browserImage:'candidate/image'},navigation:navigation(),referenceOrigin:'http://reference:8080'}));
 assert.throws(()=>reference.createProtectedVisualReferenceContract({identity:{...identity(),oracle:'weaker'},navigation:navigation(),referenceOrigin:'http://reference:8080'}));
 assert.throws(()=>reference.createProtectedVisualReferenceContract({identity:identity(),navigation:navigation(),referenceOrigin:'http://user:secret@reference:8080'}));
});
test('generic identity and navigation do not depend on PR, branch, or historical fixture',()=>{
 const changed=reference.createProtectedVisualReferenceContract({identity:{...identity(),repository:'other/repo',pr:931},navigation:{id:'town:next',label:'Next town',position:{x:93,y:82,floor:0}},referenceOrigin:'http://reference:8080'});
 assert.equal(changed.scenarios.length,create().scenarios.length);assert.equal(changed.scenarios[0].selector,create().scenarios[0].selector);
});
test('final readback rejects each exact identity drift',()=>{
 const contract=create();
 assert.doesNotThrow(()=>reference.validateProtectedVisualReferenceReadback(contract,identity()));
 for(const key of Object.keys(identity()))assert.throws(()=>reference.validateProtectedVisualReferenceReadback(contract,{...identity(),[key]:typeof identity()[key]==='number'?99:'wrong'}),key);
});
test('arbitrary candidate contract cannot become capture authority',()=>{
 assert.throws(()=>reference.validateProtectedVisualReferenceReadback(JSON.parse(JSON.stringify(create())),identity()),/protected contract/);
});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const images=()=>new Map([['desktop-chromium',png],['mobile-chromium',png]]);
test('reference manifest binds complete bytes to exact contract and rejects tamper',()=>{
 const contract=create(), bytes=images();
 const manifest=reference.sealProtectedVisualReferences(contract,bytes);
 assert.doesNotThrow(()=>reference.validateProtectedVisualReferences({contract,manifest,images:bytes}));
 for(const key of ['contractDigest','schemaVersion'])assert.throws(()=>reference.validateProtectedVisualReferences({contract,manifest:{...manifest,[key]:'wrong'},images:bytes}));
 const drift=images();drift.set('mobile-chromium',Buffer.concat([png,Buffer.from('drift')]));
 assert.throws(()=>reference.validateProtectedVisualReferences({contract,manifest,images:drift}));
 assert.throws(()=>reference.validateProtectedVisualReferences({contract,manifest:{...manifest,images:manifest.images.slice(0,1)},images:bytes}));
 assert.throws(()=>reference.sealProtectedVisualReferences(contract,new Map([['desktop-chromium',png]])));
 assert.throws(()=>reference.sealProtectedVisualReferences(contract,new Map([['desktop-chromium',Buffer.from('not png')],['mobile-chromium',png]])));
});
test('capture requires protected identity reread before it opens browser',async()=>{
 let opened=false;
 await assert.rejects(reference.captureProtectedVisualReferences({contract:create(),browser:{newContext(){opened=true;throw Error('must not open');}},readback:async()=>({...identity(),headSha:'f'.repeat(40)})}),/drift/);
 assert.equal(opened,false);
});
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('source snapshot rejects candidate bytes, extra files and symbolic links',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-reference-source-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 git('init','-q');git('config','user.email','test@example.invalid');git('config','user.name','Test');
 fs.mkdirSync(path.join(root,'web'));fs.mkdirSync(path.join(root,'src'));
 fs.writeFileSync(path.join(root,'web','index.html'),'protected');fs.writeFileSync(path.join(root,'src','runtime.mjs'),'export {};');git('add','.');git('commit','-qm','reference');
 const expected={root,baseSha:git('rev-parse','HEAD'),referenceTree:git('rev-parse','HEAD^{tree}')};
 assert.equal(reference.validateProtectedVisualReferenceSource(expected).referenceTree,expected.referenceTree);
 fs.writeFileSync(path.join(root,'web','index.html'),'candidate');assert.throws(()=>reference.validateProtectedVisualReferenceSource(expected),/source bytes/);
 git('checkout','--','web/index.html');fs.writeFileSync(path.join(root,'web','extra.js'),'candidate');assert.throws(()=>reference.validateProtectedVisualReferenceSource(expected),/file set/);
 fs.unlinkSync(path.join(root,'web','extra.js'));fs.unlinkSync(path.join(root,'web','index.html'));fs.symlinkSync('../src/runtime.mjs',path.join(root,'web','index.html'));assert.throws(()=>reference.validateProtectedVisualReferenceSource(expected),/regular/);
});
test('reference deep link preserves the protected search navigation destination state',()=>{
 for(const scenario of create().scenarios){
  const query=new URL(scenario.entry,'http://reference:8080').searchParams;
  assert.equal(query.get('zoom'),'2');assert.equal(query.get('selected'),'-7:10:20');
  assert.equal(query.get('q'),'Independent fixture');assert.equal(query.get('layers'),'minimap-overview');
 }
});
test('tree-only capture has explicitly absent PR association',()=>{
 const contract=reference.createProtectedVisualReferenceContract({identity:{...identity(),pr:null},navigation:navigation(),referenceOrigin:'http://reference:8080'});
 assert.equal(contract.identity.pr,null);
 assert.throws(()=>reference.validateProtectedVisualReferenceReadback(contract,identity()),/drift/);
});
test('reference paths cannot share any candidate writable ancestor or symlink alias',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-reference-mounts-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const artifacts=path.join(root,'artifacts'),privateRoot=path.join(root,'private');fs.mkdirSync(artifacts);fs.mkdirSync(privateRoot);
 assert.doesNotThrow(()=>reference.validateProtectedVisualReferenceMounts({referencePaths:[privateRoot],candidateWritablePaths:[artifacts]}));
 const exposed=path.join(artifacts,'snapshots');fs.mkdirSync(exposed);
 assert.throws(()=>reference.validateProtectedVisualReferenceMounts({referencePaths:[exposed],candidateWritablePaths:[artifacts]}),/writable/);
 fs.symlinkSync(privateRoot,path.join(artifacts,'alias'));
 assert.throws(()=>reference.validateProtectedVisualReferenceMounts({referencePaths:[privateRoot],candidateWritablePaths:[path.join(artifacts,'alias')]}),/writable/);
 assert.throws(()=>reference.validateProtectedVisualReferenceMounts({referencePaths:[privateRoot],candidateWritablePaths:[]}),/mount/);
});
test('post-browser reference readback rejects changed expected pixels and replacement symlinks',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-reference-files-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const contract=create(),manifest=reference.sealProtectedVisualReferences(contract,images());
 const imagePaths=new Map([...images()].map(([project,bytes])=>{const file=path.join(root,project+'.png');fs.writeFileSync(file,bytes);return [project,file];}));
 assert.doesNotThrow(()=>reference.validateProtectedVisualReferenceFiles({contract,manifest,imagePaths}));
 const file=imagePaths.get('mobile-chromium');fs.appendFileSync(file,'candidate mutation');
 assert.throws(()=>reference.validateProtectedVisualReferenceFiles({contract,manifest,imagePaths}),/drift/);
 fs.unlinkSync(file);fs.symlinkSync(imagePaths.get('desktop-chromium'),file);
 assert.throws(()=>reference.validateProtectedVisualReferenceFiles({contract,manifest,imagePaths}),/regular/);
});
import {runProtectedVisualReference} from '../../tools/verification/run-protected-visual-reference.mjs';
test('actual orchestration rejects artifact-contained reference output before starting any container',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-reference-orchestration-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const artifacts=path.join(root,'artifacts');fs.mkdirSync(artifacts);
 await assert.rejects(runProtectedVisualReference({outputRoot:path.join(artifacts,'private'),candidateWritablePaths:[artifacts],freshReadback:async()=>{throw Error('must reject mount graph before live reads');}}),/candidate writable mount/);
});

test('review artifact transports isolated reference images and manifest',()=>{
 const workflow=fs.readFileSync(new URL('../../.github/workflows/protected-admission.yml',import.meta.url),'utf8');
 const paths=workflow.split('name: protected-visual-frames-')[1]?.split('path: |')[1]?.split('retention-days:')[0];
 assert.ok(paths,'independent review artifact paths missing');
 assert.match(paths,/\/protected-admission\/private-visual-reference\/visual-reference\//);
 assert.match(paths,/browser-\*\/user-visual-evidence\//);
});
