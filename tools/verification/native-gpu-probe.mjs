import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/i;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const SOFTWARE_RENDERER = /SwiftShader|llvmpipe|Microsoft Basic|software|WARP/i;

function fail(message) {
  throw new Error(`native-gpu-probe: ${message}`);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null || Object.hasOwn(values, key)) fail('requires unique --flag value pairs');
    values[key] = value;
  }
  return values;
}

export function assessNativeGpuEvidence(input) {
  if (!input || typeof input !== 'object') fail('evidence input is missing');
  if (!SHA.test(input.atlasRevision ?? '')) fail('Atlas revision is invalid');
  if (!SHA256.test(input.verificationPlanSha256 ?? '')) fail('verification plan digest is invalid');
  if (typeof input.adapterName !== 'string' || input.adapterName.trim().length === 0) fail('adapter name is missing');
  if (typeof input.driverVersion !== 'string' || input.driverVersion.trim().length === 0) fail('driver version is missing');
  if (typeof input.browserVersion !== 'string' || input.browserVersion.trim().length === 0) fail('browser version is missing');
  if (typeof input.webglVendor !== 'string' || typeof input.webglRenderer !== 'string') fail('WebGL identity is missing');
  if (!Array.isArray(input.pixelSample) || input.pixelSample.length !== 4 || input.pixelSample.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) fail('pixel sample is invalid');
  const expected = [64, 128, 191, 255];
  const pixelValid = input.pixelSample.every((value, index) => Math.abs(value - expected[index]) <= 2);
  const software = SOFTWARE_RENDERER.test(`${input.webglVendor} ${input.webglRenderer}`);
  const hardwareAccelerated = input.webgl2 === true && pixelValid && !software;
  const evidence = Object.freeze({
    schemaVersion: 1,
    kind: 'atlas-native-gpu-truth',
    atlasRevision: input.atlasRevision.toLowerCase(),
    verificationPlanSha256: input.verificationPlanSha256,
    adapterName: input.adapterName.trim(),
    driverVersion: input.driverVersion.trim(),
    browserVersion: input.browserVersion.trim(),
    webgl2: input.webgl2 === true,
    webglVendor: input.webglVendor,
    webglRenderer: input.webglRenderer,
    pixelSample: [...input.pixelSample],
    hardwareAccelerated,
  });
  if (!hardwareAccelerated) fail(`hardware acceleration not proven renderer=${input.webglRenderer}`);
  return evidence;
}

function probeDocument() {
  return `<!doctype html><meta charset="utf-8"><title>pending</title><canvas id="c" width="8" height="8"></canvas><script>
(() => {
  const result = { webgl2: false, webglVendor: '', webglRenderer: '', pixelSample: [] };
  try {
    const gl = document.getElementById('c').getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('webgl2 unavailable');
    result.webgl2 = true;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debug) throw new Error('WEBGL_debug_renderer_info unavailable');
    result.webglVendor = String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL));
    result.webglRenderer = String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL));
    gl.clearColor(0.25, 0.5, 0.75, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixel = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    result.pixelSample = Array.from(pixel);
  } catch (error) {
    result.error = String(error?.message ?? error);
  }
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(result))));
  document.title = encoded;
})();
</script>`;
}

function runBrowser(browser) {
  if (!fs.existsSync(browser)) fail(`browser executable not found: ${browser}`);
  const version = spawnSync(browser, ['--version'], { encoding: 'utf8', timeout: 30_000 });
  if (version.status !== 0) fail(`browser version probe failed: ${version.stderr || version.stdout}`);
  const browserVersion = `${version.stdout || version.stderr}`.trim();
  if (!browserVersion) fail('browser version output is empty');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-native-gpu-'));
  try {
    const html = path.join(temp, 'probe.html');
    const profile = path.join(temp, 'profile');
    fs.writeFileSync(html, probeDocument(), 'utf8');
    const target = pathToFileURL(html).href;
    const execution = spawnSync(browser, [
      '--headless=new', '--enable-gpu', '--use-angle=d3d11', '--disable-software-rasterizer',
      '--disable-background-networking', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, '--virtual-time-budget=5000', '--dump-dom', target,
    ], { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
    if (execution.status !== 0) fail(`browser WebGL probe failed: ${execution.stderr || execution.stdout}`);
    const match = `${execution.stdout}`.match(/<title>([A-Za-z0-9+/=]+)<\/title>/i);
    if (!match) fail('browser WebGL probe returned no bounded result');
    const browserEvidence = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    if (browserEvidence.error) fail(browserEvidence.error);
    return { browserVersion, browserEvidence };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const required = ['--browser', '--adapter-name', '--driver-version', '--atlas-revision', '--verification-plan-sha256', '--output'];
  for (const flag of required) if (!Object.hasOwn(args, flag)) fail(`missing ${flag}`);
  const { browserVersion, browserEvidence } = runBrowser(args['--browser']);
  const evidence = assessNativeGpuEvidence({
    ...browserEvidence,
    browserVersion,
    adapterName: args['--adapter-name'],
    driverVersion: args['--driver-version'],
    atlasRevision: args['--atlas-revision'],
    verificationPlanSha256: args['--verification-plan-sha256'],
  });
  const output = path.resolve(args['--output']);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`native-gpu-probe=PASS renderer=${evidence.webglRenderer}\n`);
}

if (process.argv[1] === new URL(import.meta.url).pathname || pathToFileURL(path.resolve(process.argv[1] ?? '')).href === import.meta.url) {
  try { runCli(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
