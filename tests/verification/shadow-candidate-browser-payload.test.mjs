import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {buildQualificationWorld,verifyQualificationWorld} from '../../tools/verification/qualification-world.mjs';
import {resolveQualificationScenarioBindings} from '../../tools/verification/qualification-scenario-bindings.mjs';
import {prepareProtectedBrowserHarness} from '../../tools/verification/run-verification-shadow.mjs';

const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));

function copyCandidate(t) {
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-shadow-candidate-payload-'));
  t.after(()=>fs.rmSync(scratch,{recursive:true,force:true}));
  const candidateRoot=path.join(scratch,'candidate');
  fs.mkdirSync(candidateRoot,{recursive:true});
  fs.cpSync(path.join(root,'e2e'),path.join(candidateRoot,'e2e'),{recursive:true,filter:source=>!source.split(path.sep).includes('node_modules')});
  return {scratch,candidateRoot};
}

function firstSnapshot(e2eRoot) {
  for(const directory of ['tests/visual-desktop.spec.mjs-snapshots','tests/visual-mobile.spec.mjs-snapshots']) {
    const rootPath=path.join(e2eRoot,directory);
    if(!fs.existsSync(rootPath)) continue;
    const queue=[rootPath];
    while(queue.length) {
      const current=queue.shift();
      for(const entry of fs.readdirSync(current,{withFileTypes:true})) {
        const absolute=path.join(current,entry.name);
        if(entry.isDirectory()) queue.push(absolute);
        else if(entry.isFile()&&entry.name.endsWith('.png')) return path.relative(e2eRoot,absolute);
      }
    }
  }
  throw new Error('visual snapshot fixture missing');
}

function mutateCandidatePayload(candidateRoot) {
  const e2e=path.join(candidateRoot,'e2e');
  const spec='tests/resilience-desktop.spec.mjs';
  const support='support/user-acceptance.mjs';
  fs.appendFileSync(path.join(e2e,spec),'\n// candidate-browser-spec-marker\n');
  fs.appendFileSync(path.join(e2e,support),'\n// candidate-browser-support-marker\n');
  fs.writeFileSync(path.join(e2e,'Dockerfile'),'candidate Dockerfile must remain inert\n');
  const snapshot=firstSnapshot(e2e);
  fs.appendFileSync(path.join(e2e,snapshot),Buffer.from('candidate-snapshot-marker'));
  return {spec,support,snapshot};
}

test('shadow materializes candidate browser tests, support and snapshots while protected executor control stays protected',t=>{
  const {scratch,candidateRoot}=copyCandidate(t);
  const changed=mutateCandidatePayload(candidateRoot);
  const destination=path.join(scratch,'browser-harness');
  prepareProtectedBrowserHarness({protectedRoot:root,candidateRoot,destination});
  assert.match(fs.readFileSync(path.join(destination,changed.spec),'utf8'),/candidate-browser-spec-marker/);
  assert.match(fs.readFileSync(path.join(destination,changed.support),'utf8'),/candidate-browser-support-marker/);
  assert.match(fs.readFileSync(path.join(destination,changed.snapshot)),/candidate-snapshot-marker/);
  assert.deepEqual(fs.readFileSync(path.join(destination,'Dockerfile')),fs.readFileSync(path.join(root,'e2e/Dockerfile')));
  assert.doesNotMatch(fs.readFileSync(path.join(destination,'Dockerfile'),'utf8'),/candidate Dockerfile/);
});

test('qualification binding is rendered onto candidate test payload without replacing candidate assertions',async t=>{
  const {scratch,candidateRoot}=copyCandidate(t);
  const visual=path.join(candidateRoot,'e2e/tests/visual-desktop.spec.mjs');
  fs.appendFileSync(visual,'\n// candidate-qualification-oracle-marker\n');
  const productRoot=path.join(scratch,'product');
  const manifest=await buildQualificationWorld(productRoot);
  await verifyQualificationWorld(productRoot);
  const bindings=resolveQualificationScenarioBindings({productRoot,expectedProductDigest:manifest.productDigest});
  const destination=path.join(scratch,'qualified-browser-harness');
  prepareProtectedBrowserHarness({protectedRoot:root,candidateRoot,destination,qualificationBindings:bindings});
  const rendered=fs.readFileSync(path.join(destination,'tests/visual-desktop.spec.mjs'),'utf8');
  assert.match(rendered,/candidate-qualification-oracle-marker/);
  assert.match(rendered,/protected-reference/);
  assert.deepEqual(fs.readFileSync(path.join(destination,'playwright.config.mjs')),fs.readFileSync(path.join(root,'e2e/playwright.config.mjs')));
});
