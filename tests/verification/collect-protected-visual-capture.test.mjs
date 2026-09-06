import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fixture} from './fixtures/protected-review-fixture.mjs';
const api=await import('../../tools/verification/collect-protected-visual-capture.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function setup(t){
 const f=fixture(),root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-capture-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'summary.json'),f.files[0].bytes);
 const dir=path.join(root,'user-visual-evidence/desktop-chromium/full-frame');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'viewport.png'),f.files[1].bytes);
 const capture=JSON.parse(f.captureBytes);const manifest={version:1,scenarioId:'full-frame',atlasRevision:f.currentCandidate.headSha,targetMode:'checkout-overlay',browserProfile:'desktop-chromium',browserName:'chromium',viewport:{width:1440,height:900},deviceScaleFactor:1,screenshot:'viewport.png',screenshotSha256:capture.frames[0].digest};
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest));
 return {root,dir,manifest,input:{artifactRoot:root,currentCandidate:f.currentCandidate,authority:f.authority,producer:capture.producer}};
}
test('collects actual complete protected capture bytes without asserting visual approval',t=>{const f=setup(t);assert.equal(typeof api.collectProtectedVisualCapture,'function');const result=api.collectProtectedVisualCapture(f.input);assert.equal(result.capture.frames.length,1);assert.equal(result.capture.frames[0].frameId,'full-frame');assert.equal(result.capture.kind,'protected-visual-capture');assert.equal(result.capture.reviewedAllFrames,undefined);});
for(const [name,mutate]of Object.entries({
 'missing frame':f=>fs.rmSync(path.join(f.dir,'viewport.png')),
 'changed pixels':f=>fs.writeFileSync(path.join(f.dir,'viewport.png'),'drift'),
 'wrong revision':f=>{f.manifest.atlasRevision='d'.repeat(40);fs.writeFileSync(path.join(f.dir,'manifest.json'),JSON.stringify(f.manifest));},
 'wrong project':f=>{f.manifest.browserProfile='mobile-chromium';fs.writeFileSync(path.join(f.dir,'manifest.json'),JSON.stringify(f.manifest));},
 'escaping screenshot':f=>{f.manifest.screenshot='../../outside.png';fs.writeFileSync(path.join(f.dir,'manifest.json'),JSON.stringify(f.manifest));},
 'symlink frame':f=>{fs.renameSync(path.join(f.dir,'viewport.png'),path.join(f.root,'outside.png'));fs.symlinkSync(path.join(f.root,'outside.png'),path.join(f.dir,'viewport.png'));},
 'duplicate frame':f=>{fs.cpSync(f.dir,path.join(f.root,'user-visual-evidence/duplicate'),{recursive:true});},
 'failed summary':f=>{const p=path.join(f.root,'summary.json'),s=JSON.parse(fs.readFileSync(p));s.status='failed';fs.writeFileSync(p,JSON.stringify(s));},
 'retried summary':f=>{const p=path.join(f.root,'summary.json'),s=JSON.parse(fs.readFileSync(p));s.scenarios[0].retry=1;fs.writeFileSync(p,JSON.stringify(s));}
}))test(`capture rejects ${name}`,t=>{assert.equal(typeof api.collectProtectedVisualCapture,'function');const f=setup(t);mutate(f);assert.throws(()=>api.collectProtectedVisualCapture(f.input));});
