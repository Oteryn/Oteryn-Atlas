import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { verifySelectedGameplayProduct } from './shadow-gameplay-source.mjs';

export const GAMEPLAY_HTTP_SPEC = 'e2e/tests/creature-gameplay-source-contract-desktop.spec.mjs';
export const GAMEPLAY_HTTP_TITLES = Object.freeze([
  'bounded real gameplay source preserves selected Game-owned NPC facts',
  'bounded real gameplay source preserves selected Game-owned monster facts',
]);
export const GAMEPLAY_HTTP_STABLE_IDS = Object.freeze(GAMEPLAY_HTTP_TITLES.map(title => `desktop-chromium::${GAMEPLAY_HTTP_SPEC}::${title}`));
const fail = detail => { throw new TypeError(`selected gameplay HTTP invalid: ${detail}`); };

export async function startSelectedGameplayServer(productFiles) {
  const files = Object.fromEntries(Object.entries(productFiles).map(([name, bytes]) => [name, Buffer.from(bytes)]));
  verifySelectedGameplayProduct(files);
  const observedRequests = [];
  const server = http.createServer((request, response) => {
    const prefix = '/web/creature-gameplay/';
    const relative = request.url?.startsWith(prefix) ? request.url.slice(prefix.length) : '';
    const bytes = Object.hasOwn(files, relative) ? files[relative] : null;
    const status = request.method === 'GET' && bytes ? 200 : 404;
    observedRequests.push({ method: request.method, path: request.url, status });
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': status === 200 ? bytes.length : 0 });
    response.end(status === 200 ? bytes : undefined);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { origin: `http://127.0.0.1:${server.address().port}`, observedRequests, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

export function validateGameplayHttpResults(report) {
  if (!report || report.config?.workers !== 1 || report.config?.projects?.length !== 1 || report.config.projects[0].name !== 'desktop-chromium' || report.config.projects[0].retries !== 0 || report.errors?.length) fail('runner configuration or global error');
  const observed = [];
  const walk = suite => {
    for (const spec of suite.specs ?? []) {
      if (!GAMEPLAY_HTTP_TITLES.includes(spec.title) || !spec.file?.endsWith('creature-gameplay-source-contract-desktop.spec.mjs') || spec.tests?.length !== 1) fail('unexpected test census');
      const test = spec.tests[0];
      if (test.projectName !== 'desktop-chromium' || test.expectedStatus !== 'passed' || test.status !== 'expected' || test.results?.length !== 1 || test.results[0].status !== 'passed' || test.results[0].retry !== 0 || test.results[0].errors?.length) fail('test did not pass exactly once');
      observed.push(`desktop-chromium::${GAMEPLAY_HTTP_SPEC}::${spec.title}`);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  walk(report);
  if (JSON.stringify([...observed].sort()) !== JSON.stringify([...GAMEPLAY_HTTP_STABLE_IDS].sort())) fail('stable test census mismatch');
  return Object.freeze([...observed]);
}

// Must be imported from the protected checkout. Runtime dependencies resolve only
// from that checkout's e2e installation; candidate paths/config/specs are not input.
export async function runSelectedGameplayHttp(productFiles) {
  const server = await startSelectedGameplayServer(productFiles);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-gameplay-http-'));
  try {
    const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
    const require = createRequire(path.join(repositoryRoot, 'e2e/package.json'));
    const packagePath = require.resolve('@playwright/test/package.json');
    const runtime = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    if (runtime.version !== '1.62.0') fail('protected Playwright version must be 1.62.0');
    const packageRoot = path.dirname(packagePath);
    fs.symlinkSync(path.dirname(path.dirname(packageRoot)), path.join(temporary, 'node_modules'), 'dir');
    const specDirectory = path.join(temporary, 'e2e/tests'); fs.mkdirSync(specDirectory, { recursive: true });
    const protectedSpec = path.join(repositoryRoot, GAMEPLAY_HTTP_SPEC);
    if (!fs.lstatSync(protectedSpec).isFile() || fs.lstatSync(protectedSpec).isSymbolicLink()) fail('protected spec is not a regular file');
    fs.copyFileSync(protectedSpec, path.join(temporary, GAMEPLAY_HTTP_SPEC));
    const reportPath = path.join(temporary, 'results.json');
    fs.writeFileSync(path.join(temporary, 'playwright.config.mjs'), `export default ${JSON.stringify({ testDir: './e2e/tests', testMatch: 'creature-gameplay-source-contract-desktop.spec.mjs', workers: 1, retries: 0, forbidOnly: true, timeout: 30000, reporter: [['json', { outputFile: reportPath }]], projects: [{ name: 'desktop-chromium', retries: 0 }], use: { baseURL: server.origin }, outputDir: path.join(temporary, 'test-results') })};`);
    const argv = [path.join(packageRoot, 'cli.js'), 'test', GAMEPLAY_HTTP_SPEC, '--project=desktop-chromium', '--config=playwright.config.mjs', '--workers=1', '--retries=0'];
    const execution = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, argv, { cwd: temporary, env: { LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', ATLAS_GAMEPLAY_SOURCE_MODE: 'selected-gameplay-v1' }, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
      let outputBytes = 0; const timer = setTimeout(() => child.kill('SIGKILL'), 90000);
      for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { outputBytes += bytes.length; if (outputBytes > 1024 * 1024) child.kill('SIGKILL'); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
    });
    if (execution.code !== 0 || execution.signal) fail('protected Playwright process failed');
    const resultsBytes = fs.readFileSync(reportPath);
    const observedStableIds = validateGameplayHttpResults(JSON.parse(resultsBytes));
    const expectedRequests = ['manifest.json', 'shards/npc-f8.json', 'manifest.json', 'shards/monster-80.json'].map(p => `/web/creature-gameplay/${p}`);
    if (JSON.stringify(server.observedRequests.map(x => x.path)) !== JSON.stringify(expectedRequests) || server.observedRequests.some(x => x.method !== 'GET' || x.status !== 200)) fail('HTTP request census mismatch');
    return { schemaVersion: 1, contract: 'selected-gameplay-v1', scope: 'source-contract-http', candidateProductEvidence: false, observedStableIds, observedRequests: [...server.observedRequests], resultsBytes };
  } finally { await server.close(); fs.rmSync(temporary, { recursive: true, force: true }); }
}
