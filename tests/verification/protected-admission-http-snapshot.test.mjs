import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runProtectedAdmission } from '../../tools/verification/run-protected-admission.mjs';

const repository = 'owner/repo', headSha = 'a'.repeat(40), baseSha = 'b'.repeat(40);
const repositoryPath = '/repos/owner/repo';
const snapshotPaths = [
  `${repositoryPath}/pulls/7`, repositoryPath,
  `${repositoryPath}/git/ref/heads/main`, `${repositoryPath}/git/commits/${headSha}`,
  `${repositoryPath}/pulls/7/files?per_page=100&page=1`,
];

async function withSnapshot(t, mutate, verify) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-admission-http-'));
  const outputRoot = path.join(root, 'proof'), githubOutput = path.join(root, 'github-output');
  const rows = new Map([
    [snapshotPaths[0], { number: 7, state: 'open', changed_files: 1,
      head: { sha: headSha, repo: { full_name: repository } },
      base: { sha: baseSha, ref: 'main', repo: { full_name: repository } } }],
    [repositoryPath, { full_name: repository, default_branch: 'main' }],
    [snapshotPaths[2], { ref: 'refs/heads/main', object: { sha: baseSha } }],
    [snapshotPaths[3], { sha: headSha, tree: { sha: 'c'.repeat(40) } }],
    [snapshotPaths[4], [{ filename: 'web/fullworld-app.mjs', status: 'modified' }]],
  ]);
  mutate(rows);
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.setHeader('Content-Type', 'application/json');
    // In particular, the repository URL with a trailing slash is not a route.
    if (!rows.has(request.url)) { response.writeHead(404); response.end('{"message":"Not Found"}'); return; }
    response.end(JSON.stringify(rows.get(request.url)));
  });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const execute = () => runProtectedAdmission({
    protectedRoot: root, candidateRoot: root, outputRoot,
    env: { GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
      GITHUB_REPOSITORY: repository, ATLAS_PR_NUMBER: '7', GITHUB_EVENT_NAME: 'pull_request_target',
      GITHUB_RUN_ATTEMPT: '1', GH_TOKEN: 'local-fixture-only', GITHUB_OUTPUT: githubOutput,
      // Stop at the real event freshness fence after a complete HTTP snapshot,
      // before policy imports or candidate execution. No production seam is mocked.
      ATLAS_CODE_REVISION: 'd'.repeat(40), ATLAS_BASE_SHA: baseSha },
  });
  await verify(execute, requests);
  assert.deepEqual(fs.readdirSync(outputRoot), [], 'failed snapshots must not publish proof');
  assert.equal(fs.existsSync(githubOutput), false, 'failed snapshots must not publish admission eligibility');
}

test('actual admission HTTP snapshot uses canonical repository URL and unchanged nested routes', async t => {
  await withSnapshot(t, () => {}, async (execute, requests) => {
    await assert.rejects(execute, /event snapshot stale/);
    assert.deepEqual(requests, snapshotPaths.map(url => ({ method: 'GET', url })));
  });
});

test('actual admission HTTP snapshot fails closed when repository is unavailable', async t => {
  await withSnapshot(t, rows => rows.delete(repositoryPath), async (execute, requests) => {
    await assert.rejects(execute, /GitHub read failed 404/);
    assert.deepEqual(requests.map(request => request.url), snapshotPaths.slice(0, 2));
  });
});

test('actual admission HTTP snapshot rejects malformed repository association', async t => {
  await withSnapshot(t, rows => rows.set(repositoryPath, {}), async (execute, requests) => {
    await assert.rejects(execute, /PR association invalid/);
    assert.deepEqual(requests.map(request => request.url), snapshotPaths.slice(0, 2));
  });
});

test('actual admission HTTP snapshot rejects stale protected base', async t => {
  await withSnapshot(t, rows => { rows.get(snapshotPaths[2]).object.sha = 'e'.repeat(40); }, async (execute, requests) => {
    await assert.rejects(execute, /protected base stale/);
    assert.deepEqual(requests.map(request => request.url), snapshotPaths.slice(0, 3));
  });
});

test('actual admission HTTP snapshot rejects malformed commit identity', async t => {
  await withSnapshot(t, rows => { rows.get(snapshotPaths[3]).tree.sha = 'invalid'; }, async (execute, requests) => {
    await assert.rejects(execute, /producer snapshot association invalid/);
    assert.deepEqual(requests.map(request => request.url), snapshotPaths.slice(0, 4));
  });
});
