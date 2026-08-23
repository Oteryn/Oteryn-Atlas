import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const nginx = fs.readFileSync('e2e/nginx/default.conf.template', 'utf8');
const compose = fs.readFileSync('e2e/compose.yml', 'utf8');
const runSh = fs.readFileSync('e2e/run.sh', 'utf8');
const runPs = fs.readFileSync('e2e/run.ps1', 'utf8');
const nightly = fs.readFileSync('.github/workflows/verification-depth.yml', 'utf8');
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

test('local publication forwarder passes its executable relay self-test', () => {
  const result = spawnSync('python', [forwarderPath, '--self-test'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /SELF-TEST PASS/);
});
