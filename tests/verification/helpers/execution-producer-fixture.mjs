import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

import {authenticateExecutionProducer, assertExecutionProducer} from '../../../tools/verification/execution-producer.mjs';

const digest = value => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function archive(reportPath, reportBytes) {
  const script = "import io,sys,zipfile\ndata=sys.stdin.buffer.read()\nout=io.BytesIO()\nwith zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:z.writestr(sys.argv[1],data)\nsys.stdout.buffer.write(out.getvalue())";
  return execFileSync('python3',['-c',script,reportPath],{input:reportBytes,maxBuffer:3*1024*1024});
}

// Test-only transport fixture. This invokes the real authenticator over synthetic
// GitHub API records and an in-memory ZIP; it does not claim hosted execution.
export function bindAuthenticatedExecutionArtifacts(fixture) {
  const producers = {};
  const artifacts = {};
  const transports = {};
  const policy = fixture.contract.producerPolicy;
  fixture.evidence.forEach((row,index) => {
    const {producer:ignored,...report} = row;
    const reportBytes = Buffer.from(JSON.stringify(report));
    const artifactName = `execution-proof-${row.commandId.slice('sha256:'.length)}`;
    const archiveBytes = archive(`${artifactName}.json`,reportBytes);
    const runId = 1000 + index;
    const jobId = 2000 + index;
    const artifactId = 3000 + index;
    const run = policy.event === 'pull_request_target' ? {
      id:runId,run_attempt:1,path:policy.workflowPath,event:policy.event,
      head_sha:fixture.contract.identity.protectedBaseSha,head_branch:'main',status:'completed',conclusion:'success',
      repository:{id:policy.repositoryId,full_name:fixture.contract.identity.repository},
      created_at:row.startedAt,updated_at:row.completedAt,
      pull_requests:[{number:7,head:{sha:fixture.contract.identity.headSha,repo:{id:policy.repositoryId}},base:{sha:fixture.contract.identity.protectedBaseSha,repo:{id:policy.repositoryId}}}],
    } : {
      id:runId,run_attempt:1,path:policy.workflowPath,event:policy.event,
      head_sha:fixture.contract.identity.headSha,
      head_branch:`gh-readonly-queue/main/pr-7-${fixture.contract.identity.headSha.slice(0,12)}`,
      status:'completed',conclusion:'success',repository:{id:policy.repositoryId,full_name:fixture.contract.identity.repository},
      created_at:row.startedAt,updated_at:row.completedAt,pull_requests:[],
    };
    const jobs = {total_count:1,jobs:[{id:jobId,run_id:runId,run_attempt:1,head_sha:run.head_sha,name:policy.jobName,
      status:'completed',conclusion:'success',started_at:row.startedAt,completed_at:row.completedAt}]};
    const artifact = {id:artifactId,name:artifactName,expired:false,digest:digest(archiveBytes),
      workflow_run:{id:runId,repository_id:policy.repositoryId,head_repository_id:policy.repositoryId,head_sha:run.head_sha}};
    const protectedSource = {repository:fixture.contract.identity.repository,repositoryId:policy.repositoryId,
      ref:'refs/heads/main',revision:fixture.contract.identity.protectedBaseSha};
    const input = {contract:fixture.contract,commandId:row.commandId,run,jobs,artifact,archiveBytes,protectedSource,now:fixture.now};
    const receipt = authenticateExecutionProducer(input);
    const normalized = assertExecutionProducer(receipt,{contract:fixture.contract,commandId:row.commandId,artifactBytes:reportBytes});
    row.producer = {runId:normalized.runId,jobId:normalized.jobId,artifactDigest:normalized.artifactDigest};
    producers[row.commandId] = receipt;
    artifacts[row.commandId] = reportBytes;
    transports[row.commandId] = input;
  });
  return {...fixture,producers,artifacts,producerTransports:transports};
}
