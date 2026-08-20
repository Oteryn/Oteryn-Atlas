#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import { detailQualificationSatisfied } from '../../src/browser/fullworld-progressive.mjs';

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const chrome = option('--chrome');
const url = option('--url');
const output = option('--output');
const screenshot = option('--screenshot');
const stepsPath = option('--steps');
const timeoutMs = Number(option('--timeout-ms', '120000'));
if (!chrome || !url || !output || !screenshot) {
  throw new Error('usage: qualify_browser.mjs --chrome PATH --url URL --output JSON --screenshot PNG [--timeout-ms N]');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);
const profile = await mkdtemp(join(tmpdir(), 'oteryn-atlas-fullworld-'));
let child;
let cdp;
let peakBrowserRssBytes = null;
let browserRssSamples = 0;
let rssTimer = null;
let rssSampling = false;

async function processTreeRssBytes(rootPid) {
  if (!Number.isInteger(rootPid) || rootPid <= 0) return null;
  if (process.platform === 'win32') {
    const script = '$p=Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize; $p | ConvertTo-Json -Compress';
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { maxBuffer: 16 * 1024 * 1024 });
    const parsed = JSON.parse(stdout || '[]');
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const children = new Map();
    for (const row of rows) {
      const parent = Number(row.ParentProcessId);
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(row);
    }
    let total = 0;
    const queue = [rootPid];
    const seen = new Set();
    while (queue.length) {
      const pid = queue.shift();
      if (seen.has(pid)) continue;
      seen.add(pid);
      const row = rows.find((item) => Number(item.ProcessId) === pid);
      if (row) total += Number(row.WorkingSetSize) || 0;
      for (const childRow of children.get(pid) ?? []) queue.push(Number(childRow.ProcessId));
    }
    return total || null;
  }
  if (process.platform === 'linux') {
    let total = 0;
    const queue = [rootPid];
    const seen = new Set();
    while (queue.length) {
      const pid = queue.shift();
      if (seen.has(pid)) continue;
      seen.add(pid);
      try {
        const status = await readFile(`/proc/${pid}/status`, 'utf8');
        const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
        if (match) total += Number(match[1]) * 1024;
        const childText = await readFile(`/proc/${pid}/task/${pid}/children`, 'utf8');
        for (const childPid of childText.trim().split(/\s+/).filter(Boolean).map(Number)) queue.push(childPid);
      } catch {}
    }
    return total || null;
  }
  return null;
}

async function sampleBrowserRss() {
  if (rssSampling || !child?.pid) return;
  rssSampling = true;
  try {
    const value = await processTreeRssBytes(child.pid);
    if (Number.isFinite(value)) peakBrowserRssBytes = Math.max(peakBrowserRssBytes ?? 0, value);
    browserRssSamples += 1;
  } catch {} finally {
    rssSampling = false;
  }
}

async function waitForDebugPort(deadline) {
  const marker = join(profile, 'DevToolsActivePort');
  while (performance.now() < deadline) {
    try {
      const [port] = (await readFile(marker, 'utf8')).trim().split(/\r?\n/);
      if (/^\d+$/.test(port)) return Number(port);
    } catch {}
    await sleep(50);
  }
  throw new Error('Chrome DevToolsActivePort was not created before timeout');
}

async function waitForTarget(port, deadline) {
  while (performance.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { cache: 'no-store' });
      const targets = await response.json();
      const target = targets.find((item) => item.type === 'page' && item.url.startsWith(url.split('?')[0]));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {}
    await sleep(50);
  }
  throw new Error('Chrome page target was not available before timeout');
}

class CdpSession {
  constructor(webSocketUrl) {
    this.ws = new WebSocket(webSocketUrl);
    this.nextId = 1;
    this.pending = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function waitForQualification(deadline, expectedView = null) {
  while (performance.now() < deadline) {
    const evaluation = await cdp.send('Runtime.evaluate', {
      expression: 'globalThis.__OTERYN_ATLAS_FULLWORLD__ ?? null',
      returnByValue: true,
    });
    const value = evaluation.result?.value;
    const terminal = value?.status === 'PASS' || value?.status === 'FAIL';
    const matches = !expectedView || Object.entries(expectedView).every(([key, expected]) => value?.view?.[key] === expected);
    if (terminal && matches) return value;
    await sleep(50);
  }
  throw new Error('full-world browser qualification did not reach a terminal state');
}

function assertQualifiedResult(result, label) {
  if (result.status !== 'PASS') return;
  const minimapRepresentation = result.view?.mode === 'minimap' || Number(result.view?.zoom) < 0.5;
  if (!minimapRepresentation && !detailQualificationSatisfied(result)) throw new Error(`${label} reported PASS without authenticated visible detail`);
}

async function waitForMinimap(deadline) {
  while (performance.now() < deadline) {
    const evaluation = await cdp.send('Runtime.evaluate', { expression: 'globalThis.__OTERYN_ATLAS_MINIMAP__ ?? null', returnByValue: true });
    const value = evaluation.result?.value;
    if (value?.status === 'FAIL') throw new Error(`visual minimap failed: ${value.error ?? 'unknown'}`);
    if (value?.status === 'PASS' && value.visibleChunks > 0 && value.loadedImages > 0 && Number.isFinite(value.firstUsefulPaintMs)) return value;
    await sleep(50);
  }
  throw new Error('visual minimap did not reach painted PASS state');
}

function metricMap(result) {
  return Object.fromEntries(result.metrics.map((entry) => [entry.name, entry.value]));
}

const started = performance.now();
const deadline = started + timeoutMs;
try {
  child = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-precise-memory-info',
    '--force-device-scale-factor=1',
    '--window-size=1920,1080',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    url,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  rssTimer = setInterval(() => { sampleBrowserRss(); }, 100);
  await sampleBrowserRss();
  const stderr = [];
  child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
  const port = await waitForDebugPort(deadline);
  const target = await waitForTarget(port, deadline);
  cdp = new CdpSession(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Performance.enable');
  const initialResult = await waitForQualification(deadline);
  assertQualifiedResult(initialResult, 'initial qualification');
  const initialMinimap = (initialResult.view?.mode === 'minimap' || Number(initialResult.view?.zoom) < 0.5) ? await waitForMinimap(deadline) : null;
  const pageResults = [initialResult];
  if (stepsPath && initialResult.status === 'PASS') {
    const steps = JSON.parse(await readFile(stepsPath, 'utf8'));
    if (!Array.isArray(steps)) throw new Error('qualification steps must be a JSON array');
    for (const step of steps) {
      if (!step || typeof step.search !== 'string' || !step.expect || typeof step.expect !== 'object') throw new Error('invalid qualification step');
      if (step.search.length > 256 || /[\u0000-\u001f\u007f]/.test(step.search)) throw new Error('invalid qualification search');
      const inputEvaluation = await cdp.send('Runtime.evaluate', {
        expression: "document.querySelector('#search-input')",
        returnByValue: false,
      });
      const inputObjectId = inputEvaluation.result?.objectId;
      if (!inputObjectId) throw new Error('qualification search input was not available');
      const submitted = await cdp.send('Runtime.callFunctionOn', {
        objectId: inputObjectId,
        functionDeclaration: "function (search) { this.value = search; if (!this.form) throw new Error('search form missing'); this.form.requestSubmit(); return true; }",
        arguments: [{ value: step.search }],
        returnByValue: true,
      });
      if (submitted.exceptionDetails || submitted.result?.value !== true) throw new Error('qualification search submission failed');
      const stepResult = await waitForQualification(deadline, step.expect);
      assertQualifiedResult(stepResult, `detail qualification after search ${step.search}`);
      pageResults.push(stepResult);
      if (stepResult.status !== 'PASS') break;
    }
  }
  const pageResult = pageResults.at(-1);
  const wallMs = performance.now() - started;
  const performanceResult = await cdp.send('Performance.getMetrics');
  const screenshotResult = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(screenshot, Buffer.from(screenshotResult.data, 'base64'));
  await sampleBrowserRss();
  const result = {
    status: pageResult.status,
    classification: 'G5_REAL_CHROME_FULLWORLD_QUALIFICATION',
    wallMs,
    browserProcessPeakRssBytes: peakBrowserRssBytes,
    browserProcessRssSamples: browserRssSamples,
    page: pageResult,
    minimap: initialMinimap,
    transitions: pageResults,
    cdp: metricMap(performanceResult),
    chromeStderr: stderr.join('').trim() || null,
  };
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  if (pageResults.some((entry) => entry.status !== 'PASS')) process.exitCode = 1;
} catch (error) {
  await writeFile(output, `${JSON.stringify({ status: 'FAIL', error: String(error.stack ?? error) }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  if (rssTimer) clearInterval(rssTimer);
  try { await sampleBrowserRss(); } catch {}
  try { cdp?.close(); } catch {}
  try { child?.stderr?.destroy(); } catch {}
  try { child?.kill(); } catch {}
  try { child?.unref(); } catch {}
}
