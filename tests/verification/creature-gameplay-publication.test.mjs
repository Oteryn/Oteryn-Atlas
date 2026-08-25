import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const PRODUCT = join(ROOT, 'web', 'creature-gameplay');
const GAME_SHA = 'b56ce339281d252a9e01a5a2bed583582bf29e68';
const DIGEST = 'sha256:7ac7c08949aa498cb843ca26e3417e537b3409d89e4f265861f3f94855b96d28';
const LEGACY_SHA = 'e417c5e7c22986bf4acef0495eb47f7b72c97cce';
const sha = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function sortCanonical(value) {
  if (Array.isArray(value)) return value.map(sortCanonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortCanonical(value[key])]));
  return value;
}
const canonical = (value) => Buffer.from(JSON.stringify(sortCanonical(value)));

test('committed creature gameplay publication is exact merged Game output', () => {
  const manifestBytes = readFileSync(join(PRODUCT, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  assert.deepEqual(manifestBytes, canonical(manifest), 'manifest must be canonical compact JSON');
  assert.equal(manifest.producer_repository_sha, GAME_SHA);
  assert.equal(manifest.semantic_digest, DIGEST);
  assert.deepEqual(manifest.counts, { monster_profiles: 1800, npc_profiles: 1049, referenced_items: 0 });
  assert.equal(manifest.shards.length, 508);
  const unsigned = structuredClone(manifest); delete unsigned.semantic_digest;
  assert.equal(sha(canonical(unsigned)), DIGEST);
  const counts = { npc: 0, monster: 0, 'referenced-items': 0 };
  for (const descriptor of manifest.shards) {
    assert.equal(descriptor.path.startsWith('shards/'), true);
    const bytes = readFileSync(join(PRODUCT, ...descriptor.path.split('/')));
    assert.equal(bytes.length, descriptor.bytes, descriptor.path);
    assert.equal(sha(bytes), descriptor.digest, descriptor.path);
    assert.deepEqual(bytes, canonical(JSON.parse(bytes)), descriptor.path);
    counts[descriptor.kind] += descriptor.records;
  }
  assert.equal(counts.npc, 1049);
  assert.equal(counts.monster, 1800);
  assert.equal(counts['referenced-items'], 0);
  assert.equal(Math.max(...manifest.shards.map((entry) => entry.bytes)), 174660);
  assert.equal(Math.max(...manifest.shards.map((entry) => entry.records)), 15);
});

test('exact-source workflow rebuilds the same merged Game product and CI runs consumers', () => {
  const workflow = readFileSync(join(ROOT, '.github', 'workflows', 'creature-gameplay-profiles.yml'), 'utf8');
  assert.match(workflow, new RegExp(`GAME_REVISION: ${GAME_SHA}`));
  assert.match(workflow, new RegExp(`LEGACY_REVISION: ${LEGACY_SHA}`));
  assert.match(workflow, /game-atlas-creature-gameplay\/export\.py/);
  assert.match(workflow, /diff -qr web\/creature-gameplay \/tmp\/creature-gameplay/);
  assert.match(workflow, /tests\/creature-gameplay-profiles\.mjs/);
  assert.match(workflow, /tests\/creature-inspector-state\.mjs/);
  assert.match(workflow, /tests\/creature-gameplay-model\.mjs/);
  assert.match(workflow, new RegExp(DIGEST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const ci = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');
  for (const path of ['tests/creature-gameplay-profiles.mjs', 'tests/creature-inspector-state.mjs', 'tests/creature-gameplay-model.mjs', 'tests/creature-gameplay-runtime-contract.mjs']) {
    assert.match(ci, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});