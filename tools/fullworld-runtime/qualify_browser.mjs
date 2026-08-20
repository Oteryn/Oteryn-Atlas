#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

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
const profile = await mkdtemp(join(tmpdir(), 'oteryn-atlas-fullworld-'));
let child;
let cdp;
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
  const stderr = [];
  child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
  const port = await waitForDebugPort(deadline);
  const target = await waitForTarget(port, deadline);
  cdp = new CdpSession(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Performance.enable');
  const initialResult = await waitForQualification(deadline);
  const pageResults = [initialResult];
  if (stepsPath && initialResult.status === 'PASS') {
    const steps = JSON.parse(await readFile(stepsPath, 'utf8'));
    if (!Array.isArray(steps)) throw new Error('qualification steps must be a JSON array');
    for (const step of steps) {
      if (!step || typeof step.search !== 'string' || !step.expect || typeof step.expect !== 'object') throw new Error('invalid qualification step');
      const expression = `(() => { const input = document.querySelector('#search-input'); input.value = ${JSON.stringify(step.search)}; document.querySelector('#search-form').requestSubmit(); return true; })()`;
      await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
      const stepResult = await waitForQualification(deadline, step.expect);
      pageResults.push(stepResult);
      if (stepResult.status !== 'PASS') break;
    }
  }
  const pageResult = pageResults.at(-1);
  const wallMs = performance.now() - started;
  const performanceResult = await cdp.send('Performance.getMetrics');
  const screenshotResult = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(screenshot, Buffer.from(screenshotResult.data, 'base64'));
  const result = {
    status: pageResult.status,
    classification: 'G5_REAL_CHROME_FULLWORLD_QUALIFICATION',
    wallMs,
    page: pageResult,
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
  try { cdp?.close(); } catch {}
  try { child?.stderr?.destroy(); } catch {}
  try { child?.kill(); } catch {}
  try { child?.unref(); } catch {}
}
