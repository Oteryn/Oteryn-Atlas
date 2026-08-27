import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const nginx = fs.readFileSync('e2e/nginx/default.conf.template', 'utf8');
const compose = fs.readFileSync('e2e/compose.yml', 'utf8');
const runSh = fs.readFileSync('e2e/run.sh', 'utf8');
const runPs = fs.readFileSync('e2e/run.ps1', 'utf8');
const nightly = fs.readFileSync('.github/workflows/verification-depth.yml', 'utf8');
const dockerHarness = fs.readFileSync('.github/workflows/docker-e2e.yml', 'utf8');
const forwarderPath = 'e2e/local-publication-forwarder.py';

test('checkout overlay reuses publication upstream connections without masking failures', () => {
  assert.match(nginx, /upstream atlas_publication_upstream\s*\{/);
  assert.match(nginx, /server \$\{ATLAS_PUBLICATION_UPSTREAM\};/);
  assert.match(nginx, /keepalive\s+\d+;/);
  assert.match(nginx, /proxy_pass \$\{ATLAS_PUBLICATION_SCHEME\}:\/\/atlas_publication_upstream;/);
  assert.match(nginx, /proxy_set_header Host "\$\{ATLAS_PUBLICATION_HOST_HEADER\}";/);
  assert.doesNotMatch(nginx, /proxy_next_upstream/);
});

test('all checkout-overlay launch paths provide normalized publication upstream identity', () => {
  for (const key of ['ATLAS_PUBLICATION_SCHEME', 'ATLAS_PUBLICATION_UPSTREAM', 'ATLAS_PUBLICATION_HOST_HEADER', 'ATLAS_PUBLICATION_HOST']) {
    assert.match(compose, new RegExp(`${key}:`));
    assert.match(runSh, new RegExp(key));
    assert.match(runPs, new RegExp(key));
    assert.match(nightly, new RegExp(key));
  }
});

test('non-authoritative Docker harness uses an explicit isolated publication sentinel only for static overlay validation', () => {
  assert.match(dockerHarness, /Non-authoritative static-overlay sentinel/);
  assert.match(dockerHarness, /ATLAS_PUBLICATION_ORIGIN:\s*http:\/\/127\.0\.0\.1:9/);
  assert.match(dockerHarness, /ATLAS_PUBLICATION_SCHEME:\s*http/);
  assert.match(dockerHarness, /ATLAS_PUBLICATION_UPSTREAM:\s*127\.0\.0\.1:9/);
  assert.match(dockerHarness, /ATLAS_PUBLICATION_HOST_HEADER:\s*127\.0\.0\.1/);
  assert.match(dockerHarness, /ATLAS_PUBLICATION_HOST:\s*127\.0\.0\.1/);
  assert.doesNotMatch(dockerHarness, /docker compose -f e2e\/compose\.yml run --rm e2e/);
  assert.match(dockerHarness, /playwright test --config=playwright\.config\.mjs --list/);
});

test('GitHub-hosted Compose fails closed before browser allocation when publication identity is missing', () => {
  for (const key of ['ATLAS_PUBLICATION_ORIGIN', 'ATLAS_PUBLICATION_SCHEME', 'ATLAS_PUBLICATION_UPSTREAM', 'ATLAS_PUBLICATION_HOST_HEADER', 'ATLAS_PUBLICATION_HOST']) {
    assert.match(compose, new RegExp(`${key}:\\s+"?\\$\\{${key}:\\?`), `${key} must be required by Compose interpolation`);
  }
  assert.doesNotMatch(compose, /ATLAS_PUBLICATION_(?:ORIGIN|UPSTREAM):[^\n]*127\.0\.0\.1:9/);
  assert.match(runSh, /ATLAS_PUBLICATION_ORIGIN is required/);
});

test('native Windows checkout overlay bridges Docker Desktop to LAN through the host', () => {
  assert.equal(fs.existsSync(forwarderPath), true, 'missing local publication forwarder');
  const forwarder = fs.readFileSync(forwarderPath, 'utf8');
  assert.match(runPs, /local-publication-forwarder\.py/);
  assert.match(runPs, /host\.docker\.internal/);
  assert.match(runPs, /ATLAS_PUBLICATION_HOST_HEADER/);
  assert.match(runPs, /Stop-Process/);
  assert.match(forwarder, /ThreadingTCPServer/);
  assert.match(forwarder, /socket\.create_connection/);
});

test('Windows checkout-overlay waits for the required publication products before starting Playwright', () => {
  assert.match(runPs, /\$publicationPreflightPaths = @\(/);
  for (const path of ['/fullworld/publication/publication.json', '/fullworld/animation/manifest.json', '/fullworld/minimap/world.json']) {
    assert.match(runPs, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(runPs, /Invoke-WebRequest -UseBasicParsing/);
  assert.match(runPs, /Publication origin preflight did not become healthy/);
});

test('local publication forwarder passes its executable relay self-test', () => {
  const result = spawnSync('python', [forwarderPath, '--self-test'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /SELF-TEST PASS/);
});
test('local publication forwarder accepts a bounded parallel connection burst', () => {
  const script = String.raw`
import importlib.util, socket, threading
spec = importlib.util.spec_from_file_location('atlas_forwarder', r'${forwarderPath}')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
clients = []
results = []
with module.ForwardingTCPServer(('127.0.0.1', 0), ('127.0.0.1', 9)) as server:
    start = threading.Event()
    def connect_one():
        start.wait()
        try:
            client = socket.create_connection(server.server_address, timeout=1.0)
            clients.append(client)
            results.append(True)
        except OSError:
            results.append(False)
    threads = [threading.Thread(target=connect_one) for _ in range(32)]
    for thread in threads: thread.start()
    start.set()
    for thread in threads: thread.join()
    for client in clients: client.close()
if sum(results) < 32:
    raise SystemExit(f'BURST FAIL: accepted {sum(results)}/32 connections')
print('BURST PASS')
`;
  const result = spawnSync('python', ['-c', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /BURST PASS/);
});
