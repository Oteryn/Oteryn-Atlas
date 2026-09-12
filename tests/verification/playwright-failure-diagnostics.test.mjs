import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {retainFailedPlaywrightDiagnostics} from '../../tools/verification/run-verification-shadow.mjs';

const commandId=`sha256:${'a'.repeat(64)}`;

test('retains only completed regular Playwright failure images under a command-specific path', t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-failure-diagnostics-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const artifacts=path.join(root,'artifacts'),results=path.join(artifacts,'test-results','suite'),diagnostics=path.join(root,'diagnostics');
  fs.mkdirSync(results,{recursive:true});
  fs.writeFileSync(path.join(results,'screen-actual.png'),'actual');
  fs.writeFileSync(path.join(results,'screen-diff.png'),'diff');
  fs.writeFileSync(path.join(results,'screen-expected.png'),'expected');
  fs.writeFileSync(path.join(results,'trace.zip'),'trace');
  fs.symlinkSync(path.join(results,'screen-actual.png'),path.join(results,'linked-actual.png'));

  assert.deepEqual(retainFailedPlaywrightDiagnostics({artifactRoot:artifacts,diagnosticsRoot:diagnostics,commandId}),['suite/screen-actual.png','suite/screen-diff.png']);
  const destination=path.join(diagnostics,'a'.repeat(64),'suite');
  assert.equal(fs.readFileSync(path.join(destination,'screen-actual.png'),'utf8'),'actual');
  assert.equal(fs.readFileSync(path.join(destination,'screen-diff.png'),'utf8'),'diff');
  assert.deepEqual(fs.readdirSync(destination).sort(),['screen-actual.png','screen-diff.png']);
});

test('does not create a diagnostics root when no eligible file exists', t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-failure-diagnostics-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const artifacts=path.join(root,'artifacts'),diagnostics=path.join(root,'diagnostics');
  fs.mkdirSync(path.join(artifacts,'test-results'),{recursive:true});
  fs.writeFileSync(path.join(artifacts,'test-results','expected.png'),'expected');
  assert.deepEqual(retainFailedPlaywrightDiagnostics({artifactRoot:artifacts,diagnosticsRoot:diagnostics,commandId}),[]);
  assert.equal(fs.existsSync(diagnostics),false);
});

test('rejects unsafe roots and command identities', ()=>{
  assert.throws(()=>retainFailedPlaywrightDiagnostics({artifactRoot:'relative',diagnosticsRoot:'/tmp/diagnostics',commandId}),/failure diagnostics destination/);
  assert.throws(()=>retainFailedPlaywrightDiagnostics({artifactRoot:'/tmp/artifacts',diagnosticsRoot:'relative',commandId}),/failure diagnostics destination/);
  assert.throws(()=>retainFailedPlaywrightDiagnostics({artifactRoot:'/tmp/artifacts',diagnosticsRoot:'/tmp/diagnostics',commandId:'../escape'}),/failure diagnostics destination/);
});

test('maintenance workflow defines a separate failure-only diagnostics artifact', ()=>{
  const root=path.resolve(import.meta.dirname,'../..');
  const workflow=fs.readFileSync(path.join(root,'tools/maintenance/verification-shadow.yml'),'utf8');
  assert.match(workflow,/ATLAS_SHADOW_FAILURE_DIAGNOSTICS_DIR: \$\{\{ runner\.temp \}\}\/atlas-shadow-failure-diagnostics/);
  assert.match(workflow,/if: failure\(\) && needs\.plan\.outputs\.requires_review == 'true'/);
  assert.match(workflow,/name: atlas-verification-diagnostics-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow,/path: \$\{\{ runner\.temp \}\}\/atlas-shadow-failure-diagnostics\n\s+if-no-files-found: ignore/);
  assert.match(workflow,/name: atlas-verification-review-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}[\s\S]*if-no-files-found: error/);
});
