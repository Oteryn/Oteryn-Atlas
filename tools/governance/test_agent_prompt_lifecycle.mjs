import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const POLICY = resolve(ROOT, 'docs/agents/DOCUMENTATION_AGENT_IA.md');
const CANARY = resolve(ROOT, 'docs/agents/prompts/ATLAS-LEAN-PROMPT-CANARY.md');
const REGISTRY = resolve(ROOT, 'docs/agents/DOCUMENTATION_AGENT_IA.json');
const REGISTRY_VALIDATOR = resolve(ROOT, 'tools/governance/validate_documentation_ia.py');
const REGISTRY_TEST = resolve(ROOT, 'tools/governance/test_documentation_ia.py');
const ACTIVE_TASKS = resolve(ROOT, 'docs/agents/tasks/active');
const ARCHIVED_TASKS = resolve(ROOT, 'docs/agents/tasks/archive');

const REQUIRED_CANARY_SECTIONS = ['Outcome', 'Scope', 'Atlas invariants', 'Acceptance'];
const FORBIDDEN_CANARY_SECTIONS = [
  'GitHub-first execution gate',
  'Capability truthfulness and tool discovery',
  'Parallel-agent Git concurrency',
  'META execution-routing policy',
  'Verification execution placement',
  'Validation and merge',
  'Live deployment authority',
];

function readOptionalCache(directory) {
  try {
    return readdirSync(directory).filter((name) => name.endsWith('.md'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

test('Atlas Documentation/Agent IA has one mutable lifecycle authority', () => {
  assert.equal(existsSync(REGISTRY), false, 'mutable Documentation/Agent IA registry mirror must be removed');
  assert.equal(existsSync(REGISTRY_VALIDATOR), false, 'registry-only validator must be removed');
  assert.equal(existsSync(REGISTRY_TEST), false, 'registry-only validator test must be removed');

  const policy = readFileSync(POLICY, 'utf8');
  for (const phrase of [
    '`docs/agents/prompts/*.md` are reusable prompt contracts',
    'GitHub Issues are mutable lifecycle authority',
    'Git history is provenance',
    '`docs/agents/tasks/active` is a convenience cache',
  ]) {
    assert.match(policy, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `missing authority rule: ${phrase}`);
  }
});

test('optional task caches tolerate absence and reject non-directory paths', (t) => {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'atlas-task-cache-'));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

  for (const name of ['active', 'archive']) {
    const directory = resolve(temporaryRoot, name);
    assert.deepEqual(readOptionalCache(directory), []);
    mkdirSync(directory);
    assert.deepEqual(readOptionalCache(directory), []);
    writeFileSync(resolve(directory, 'packet.md'), 'task contract');
    assert.deepEqual(readOptionalCache(directory), ['packet.md']);
    rmSync(directory, { recursive: true });
    assert.deepEqual(readOptionalCache(directory), []);
    writeFileSync(directory, 'not a directory');
    assert.throws(() => readOptionalCache(directory), { code: 'ENOTDIR' });
  }
});

test('task caches do not classify the same packet as active and archived', () => {
  const active = new Set(readOptionalCache(ACTIVE_TASKS));
  const archived = new Set(readOptionalCache(ARCHIVED_TASKS));
  const overlap = [...active].filter((name) => archived.has(name)).sort();
  assert.deepEqual(overlap, [], 'task packet cannot exist in both lifecycle cache directories');
});

test('lean prompt canary is a task delta and does not copy repository policy', () => {
  const text = readFileSync(CANARY, 'utf8');
  const sections = text
    .split(/\r?\n/u)
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());

  assert.deepEqual(sections, REQUIRED_CANARY_SECTIONS);
  for (const forbidden of FORBIDDEN_CANARY_SECTIONS) {
    assert.equal(text.includes(`## ${forbidden}`), false, `canary copied repository policy section: ${forbidden}`);
  }
  assert.match(text, /GitHub Issue #322 owns mutable lifecycle state/u);
  assert.match(text, /inherits current repository-wide execution, authorization, review, verification and Merge Queue policy/u);
});
