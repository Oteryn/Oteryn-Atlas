import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

import {authenticateExecutionProducer, assertExecutionProducer} from '../../tools/verification/execution-producer.mjs';
import {canonicalJson} from '../../tools/verification/verification-plan-schema.mjs';
import {bindAuthenticatedExecutionArtifacts} from './helpers/execution-producer-fixture.mjs';

const sha = seed => seed.repeat(40).slice(0, 40);
const digest = seed => `sha256:${seed.repeat(64).slice(0, 64)}`;
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const commandId = digest('8');

function contractFixture(event = 'pull_request_target') {
  const identity = {repository:'Oteryn/Oteryn-Atlas',headSha:sha('a'),protectedBaseSha:sha('b'),treeSha:sha('c'),candidateDigest:digest('1'),environmentDigest:'2'.repeat(64),planDigest:digest('3'),policyDigest:digest('4')};
  const core = {schemaVersion:1,identity,producerPolicy:{repositoryId:99,workflowPath:'.github/workflows/product-verification.yml',jobName:'execute-proof',event},maxEvidenceAgeMs:60_000,retries:0,commands:[{id:commandId,argv:['node','--test','tests/a.mjs'],expectedTestIds:['tests/a.mjs'],timeoutSeconds:10}],groups:[{id:'deterministic.a',commandIds:[commandId]}],reviews:[]};
  return {...core,contractDigest:hash(Buffer.from(canonicalJson(core)))};
}

function zip(entries) {
  const script = "import io,json,sys,zipfile\nentries=json.loads(sys.argv[1])\nout=io.BytesIO()\nwith zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:\n for name,value in entries: z.writestr(name,value)\nsys.stdout.buffer.write(out.getvalue())";
  return execFileSync('python3',['-c',script,JSON.stringify(entries)],{maxBuffer:3*1024*1024});
}

function fixture(event = 'pull_request_target', entries) {
  const contract = contractFixture(event);
  const report = {commandId,contractDigest:contract.contractDigest,identity:contract.identity,status:'passed',exitCode:0,attempt:1,tests:[{id:'tests/a.mjs',status:'passed',attempt:1}]};
  const reportBytes = Buffer.from(JSON.stringify(report));
  const artifactName = `execution-proof-${commandId.slice(7)}`;
  const archiveBytes = zip(entries ?? [[`${artifactName}.json`,reportBytes.toString()]]) ;
  const run = event === 'pull_request_target' ? {
    id:42,run_attempt:1,path:contract.producerPolicy.workflowPath,event,head_sha:contract.identity.protectedBaseSha,head_branch:'main',status:'completed',conclusion:'success',repository:{id:99,full_name:contract.identity.repository},created_at:'2026-09-07T00:00:00Z',updated_at:'2026-09-07T00:00:06Z',pull_requests:[{number:7,head:{sha:contract.identity.headSha,repo:{id:99}},base:{sha:contract.identity.protectedBaseSha,repo:{id:99}}}],
  } : {
    id:42,run_attempt:1,path:contract.producerPolicy.workflowPath,event,head_sha:contract.identity.headSha,head_branch:`gh-readonly-queue/main/pr-7-${contract.identity.headSha.slice(0,12)}`,status:'completed',conclusion:'success',repository:{id:99,full_name:contract.identity.repository},created_at:'2026-09-07T00:00:00Z',updated_at:'2026-09-07T00:00:06Z',pull_requests:[],
  };
  const jobs = {total_count:2,jobs:[{id:43,run_id:42,run_attempt:1,head_sha:run.head_sha,name:'execute-proof',status:'completed',conclusion:'success',started_at:'2026-09-07T00:00:01Z',completed_at:'2026-09-07T00:00:05Z'},{id:44,run_id:42,run_attempt:1,head_sha:run.head_sha,name:'unrelated',status:'completed',conclusion:'success',started_at:'2026-09-07T00:00:01Z',completed_at:'2026-09-07T00:00:02Z'}]};
  const artifact = {id:45,name:artifactName,expired:false,digest:hash(archiveBytes),workflow_run:{id:42,repository_id:99,head_repository_id:99,head_sha:run.head_sha}};
  const protectedSource = {repository:contract.identity.repository,repositoryId:99,ref:'refs/heads/main',revision:contract.identity.protectedBaseSha};
  return {contract,commandId,run,jobs,artifact,archiveBytes,protectedSource,now:'2026-09-07T00:00:10Z',reportBytes};
}

test('authenticates PR producer readback and binds archive separately from report bytes', () => {
  const input = fixture();
  const receipt = authenticateExecutionProducer(input);
  assert.equal(receipt.archiveDigest, hash(input.archiveBytes));
  assert.equal(receipt.reportDigest, hash(input.reportBytes));
  assert.notEqual(receipt.archiveDigest, receipt.reportDigest);
  const producer = assertExecutionProducer(receipt,{contract:input.contract,commandId,artifactBytes:input.reportBytes});
  assert.deepEqual(producer,{repository:'Oteryn/Oteryn-Atlas',repositoryId:99,workflowPath:'.github/workflows/product-verification.yml',jobName:'execute-proof',event:'pull_request_target',headSha:sha('a'),baseSha:sha('b'),sourceSha:sha('b'),sourceRef:'refs/heads/main',headRepositoryId:99,baseRepositoryId:99,runId:42,jobId:43,runAttempt:1,status:'completed',conclusion:'success',artifactDigest:hash(input.reportBytes)});
});

test('serialized or copied receipts and substituted report bytes cannot authenticate', () => {
  const input = fixture();
  const receipt = authenticateExecutionProducer(input);
  for (const candidate of [structuredClone(receipt),JSON.parse(JSON.stringify(receipt)),{...receipt}]) {
    assert.throws(()=>assertExecutionProducer(candidate,{contract:input.contract,commandId,artifactBytes:input.reportBytes}),/receipt/);
  }
  assert.throws(()=>assertExecutionProducer(receipt,{contract:input.contract,commandId,artifactBytes:Buffer.from('{}')}),/report bytes/);
  const other = contractFixture(); other.contractDigest=digest('f');
  assert.throws(()=>assertExecutionProducer(receipt,{contract:other,commandId,artifactBytes:input.reportBytes}),/contract/);
});

test('archive digest, exact report path and single-member census fail closed', () => {
  const wrongBytes=fixture();wrongBytes.archiveBytes=Buffer.from(wrongBytes.archiveBytes);wrongBytes.archiveBytes[10]^=1;
  assert.throws(()=>authenticateExecutionProducer(wrongBytes),/archive digest/);
  for (const entries of [[['wrong.json','{}']],[[`execution-proof-${commandId.slice(7)}.json`,JSON.stringify({})],['extra.json','{}']]]) {
    const input=fixture('pull_request_target',entries);input.artifact.digest=hash(input.archiveBytes);
    assert.throws(()=>authenticateExecutionProducer(input),/archive|report/);
  }
});

test('repository, PR, artifact and protected-source associations fail closed', () => {
  const mutations=[
    input=>input.run.repository.id=100,
    input=>input.run.pull_requests[0].head.sha=sha('f'),
    input=>input.run.pull_requests.push(structuredClone(input.run.pull_requests[0])),
    input=>input.artifact.name='execution-proof-other',
    input=>input.artifact.workflow_run.id=999,
    input=>input.artifact.expired=true,
    input=>input.protectedSource.ref='refs/heads/feature',
    input=>input.protectedSource.revision=sha('f'),
  ];
  for(const mutate of mutations){const input=fixture();mutate(input);assert.throws(()=>authenticateExecutionProducer(input));}
});

test('complete unique successful job and bounded current timeline are required', () => {
  const mutations=[
    input=>input.jobs.total_count=3,
    input=>input.jobs.jobs.push({...input.jobs.jobs[0],id:88}),
    input=>input.jobs.jobs[0].conclusion='failure',
    input=>input.jobs.jobs[0].run_attempt=2,
    input=>input.jobs.jobs[0].completed_at='2026-09-07T00:00:20Z',
    input=>input.jobs.jobs[0].completed_at='2026-09-07T00:00:15Z',
    input=>input.now='2026-09-07T00:02:00Z',
  ];
  for(const mutate of mutations){const input=fixture();mutate(input);assert.throws(()=>authenticateExecutionProducer(input),/job|census|freshness|budget/);}
});

test('merge-group producer binds exact queue branch and candidate revision', () => {
  const input=fixture('merge_group');
  const receipt=authenticateExecutionProducer(input);
  assert.equal(assertExecutionProducer(receipt,{contract:input.contract,commandId,artifactBytes:input.reportBytes}).event,'merge_group');
  for(const mutate of [value=>value.run.head_sha=sha('f'),value=>value.run.head_branch='main',value=>value.run.head_branch='gh-readonly-queue/dev/pr-7-deadbeef']) {
    const bad=fixture('merge_group');mutate(bad);bad.jobs.jobs.forEach(job=>job.head_sha=bad.run.head_sha);bad.artifact.workflow_run.head_sha=bad.run.head_sha;
    assert.throws(()=>authenticateExecutionProducer(bad),/merge-group/);
  }
});

test('archive-contained report must bind the exact command, contract and identity', () => {
  for(const mutate of [report=>report.commandId=digest('f'),report=>report.contractDigest=digest('f'),report=>report.identity.treeSha=sha('f'),report=>report.producer={runId:42}]) {
    const base=fixture();const report=JSON.parse(base.reportBytes);mutate(report);
    const path=`execution-proof-${commandId.slice(7)}.json`;const input=fixture('pull_request_target',[[path,JSON.stringify(report)]]);input.artifact.digest=hash(input.archiveBytes);
    assert.throws(()=>authenticateExecutionProducer(input),/report/);
  }
});

test('fan-in fixture helper returns real authenticated receipts and report bytes', () => {
  const input=fixture();
  const evidence={...JSON.parse(input.reportBytes),startedAt:'2026-09-07T00:00:01Z',completedAt:'2026-09-07T00:00:05Z',producer:{runId:0,jobId:0,artifactDigest:digest('0')}};
  const bound=bindAuthenticatedExecutionArtifacts({contract:input.contract,evidence:[evidence],now:input.now});
  const receipt=bound.producers[commandId];
  const producer=assertExecutionProducer(receipt,{contract:input.contract,commandId,artifactBytes:bound.artifacts[commandId]});
  assert.equal(producer.artifactDigest,hash(bound.artifacts[commandId]));
  assert.equal(bound.evidence[0].producer.runId,producer.runId);
  assert.notEqual(hash(bound.producerTransports[commandId].archiveBytes),hash(bound.artifacts[commandId]));
});
