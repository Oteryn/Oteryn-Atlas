import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {buildVerificationAuthorityIdentity} from '../../tools/verification/verification-authority.mjs';
import {buildProtectedExecutionEnvironmentIdentity} from '../../tools/verification/protected-execution-environment.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const environmentConfig=JSON.parse(read('tools/verification/protected-execution-environment.json'));
const probeUrl=new URL('tools/verification/protected-execution-environment-probe.mjs',root);
test('executable environment probe maps exact observations to the complete qualification contract', async () => {
  assert.equal(fs.existsSync(probeUrl), true, 'protected environment probe module must exist');
  const { buildProtectedExecutionEnvironmentProbeEvidence } = await import(probeUrl.href);
  const evidence = buildProtectedExecutionEnvironmentProbeEvidence(environmentConfig, {
    schemaVersion: 1,
    image: environmentConfig.container.image,
    nodeAvailable: true,
    npmAvailable: true,
    playwrightVersion: environmentConfig.runtime.playwright.version,
    chromiumLaunched: true,
    python3Path: '/usr/bin/python3',
    pythonPath: '/usr/bin/python3',
    writableTmp: true,
    writablePycache: true,
    dependencyMountExists: true,
    dependencyLinkTarget: environmentConfig.mounts.dependencies.target,
    dependencyReadOnly: true,
    candidateReadOnly: true,
    externalNetworkBlocked: true,
    loopbackSocket: true,
    uid: 1000,
    gid: 1000,
    artifactWrite: true,
    pidsLimit: environmentConfig.container.pidsLimit,
    memoryBytes: environmentConfig.container.memoryBytes,
    cpus: environmentConfig.container.cpus,
    noNewPrivileges: true,
    capabilitiesDropped: true,
  });
  assert.equal(evidence.status, 'QUALIFIED');
  assert.deepEqual(Object.values(evidence.checks), Object.values(evidence.checks).map(() => true));
  assert.match(evidence.probeDigest, /^sha256:[a-f0-9]{64}$/);
  assert.match(evidence.qualificationDigest, /^sha256:[a-f0-9]{64}$/);
  assert.throws(
    () => buildProtectedExecutionEnvironmentProbeEvidence(environmentConfig, {
      schemaVersion: 1,
      image: environmentConfig.container.image,
      nodeAvailable: true,
    }),
    /observation|qualification|check/i,
  );
});


test('protected execution source and environment changes invalidate their semantic identities',async()=>{
 const paths=['tools/verification/protected-execution-environment.mjs','tools/verification/protected-execution-environment-probe.mjs','tools/verification/protected-verification-lifecycle.mjs'];
 const manifest={schemaVersion:1,authorityId:'execution-source-contract',components:paths.map((path,i)=>({id:`component-${i}`,path}))};
 const original=await buildVerificationAuthorityIdentity({manifest,readFile:read});
 for(const changed of paths){
  const changedIdentity=await buildVerificationAuthorityIdentity({manifest,readFile:path=>read(path)+(path===changed?'\n// semantic dependency changed':'')});
  assert.notEqual(changedIdentity.authorityDigest,original.authorityDigest,changed);
 }
 await assert.rejects(buildVerificationAuthorityIdentity({manifest,readFile:path=>{if(path===paths[0])throw Error('unavailable protected source');return read(path);}}),/missing|unreadable/);
 const environment=buildProtectedExecutionEnvironmentIdentity(environmentConfig);
 const changed=structuredClone(environmentConfig);changed.container.memoryBytes+=1024;
 assert.notEqual(buildProtectedExecutionEnvironmentIdentity(changed).environmentDigest,environment.environmentDigest);
});
test('Playwright metadata carries separate semantic, instance, authority and environment identity',()=>{
 const playwright=read('e2e/playwright.config.mjs');
 for(const field of ['planSemanticDigest','planInstanceDigest','authorityDigest','environmentDigest'])assert.match(playwright,new RegExp(field));
 for(const variable of ['ATLAS_PLAN_SEMANTIC_DIGEST','ATLAS_PLAN_INSTANCE_DIGEST','ATLAS_AUTHORITY_DIGEST','ATLAS_ENVIRONMENT_DIGEST'])assert.match(playwright,new RegExp(variable));
});
