import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nginx = fs.readFileSync('e2e/nginx/default.conf.template', 'utf8');
const compose = fs.readFileSync('e2e/compose.yml', 'utf8');
const runSh = fs.readFileSync('e2e/run.sh', 'utf8');
const runPs = fs.readFileSync('e2e/run.ps1', 'utf8');
const nightly = fs.readFileSync('.github/workflows/verification-depth.yml', 'utf8');

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
