import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const POLICY = resolve(ROOT, 'docs/agents/DOCUMENTATION_AGENT_IA.md');
const CANARY = resolve(ROOT, 'docs/agents/prompts/ATLAS-LEAN-PROMPT-CANARY.md');
const REGISTRY = resolve(ROOT, 'docs/agents/DOCUMENTATION_AGENT_IA.json');
const REGISTRY_VALIDATOR = resolve(ROOT, 'tools/governance/validate_documentation_ia.py');
const REGISTRY_TEST = resolve(ROOT, 'tools/governance/test_documentation_ia.py');

const TERMINAL_PACKETS = [
  'ATLAS-CREATURE-GAMEPLAY-PROFILES.md',
  'ATLAS-CREATURE-LABEL-AND-NPC-BADGE-UX.md',
  'ATLAS-E2E-VERIFICATION-ANTI-LOOP-HARDENING.md',
];

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

test('terminal task packets are archived and no longer dispatchable', () => {
  for (const filename of TERMINAL_PACKETS) {
    assert.equal(
      existsSync(resolve(ROOT, 'docs/agents/tasks/active', filename)),
      false,
      `${filename} must not remain under tasks/active`,
    );
    assert.equal(
      existsSync(resolve(ROOT, 'docs/agents/tasks/archive', filename)),
      true,
      `${filename} must be preserved under tasks/archive`,
    );
  }

  for (const filename of ['ATLAS-FULLWORLD-COORDINATOR.md', 'ATLAS-HUNT-INTELLIGENCE-PROJECT.md']) {
    assert.equal(
      existsSync(resolve(ROOT, 'docs/agents/tasks/active', filename)),
      true,
      `${filename} belongs to an open Issue and must remain active`,
    );
  }
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
