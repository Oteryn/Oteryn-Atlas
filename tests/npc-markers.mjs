import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NPC_ROLE_IDS,
  availableNpcFilters,
  npcMatchesRole,
  npcPresentationRoles,
  npcRoleFilter,
  npcRoleGlyph,
  npcRoleLabel,
  validateNpcRoleMetadata,
} from '../src/browser/npc-markers.mjs';

const resolved = { kind: 'npc', roles: ['bank', 'quest'], role_resolution_state: 'RESOLVED' };
const plain = { kind: 'npc', role_resolution_state: 'RESOLVED' };
const ambiguous = { kind: 'npc', role_resolution_state: 'AMBIGUOUS' };

test('defines the closed Game-owned NPC role vocabulary', () => {
  assert.deepEqual(NPC_ROLE_IDS, ['bank', 'travel', 'shop', 'quest', 'blessing', 'trainer']);
});

test('labels bank role without inventing depot semantics', () => {
  assert.equal(npcRoleLabel('bank'), 'Bank');
});

test('validates ordered role metadata and rejects guessed or ambiguous roles', () => {
  assert.deepEqual(validateNpcRoleMetadata(resolved), ['bank', 'quest']);
  assert.deepEqual(validateNpcRoleMetadata(plain), []);
  assert.deepEqual(validateNpcRoleMetadata(ambiguous), []);
  assert.throws(() => validateNpcRoleMetadata({ kind: 'npc', roles: ['quest', 'bank'], role_resolution_state: 'RESOLVED' }), /order/);
  assert.throws(() => validateNpcRoleMetadata({ kind: 'npc', roles: ['weapons'], role_resolution_state: 'RESOLVED' }), /role/);
  assert.throws(() => validateNpcRoleMetadata({ kind: 'npc', roles: ['bank'], role_resolution_state: 'AMBIGUOUS' }), /ambiguous/);
});
test('filters NPCs without inventing a Game role', () => {
  assert.deepEqual(npcPresentationRoles(resolved), ['bank', 'quest']);
  assert.deepEqual(npcPresentationRoles(plain), ['other']);
  assert.deepEqual(npcPresentationRoles(ambiguous), ['other']);
  assert.equal(npcMatchesRole(resolved, 'bank'), true);
  assert.equal(npcMatchesRole(resolved, 'travel'), false);
  assert.equal(npcMatchesRole(plain, 'other'), true);
  assert.equal(npcMatchesRole(ambiguous, 'other'), true);
  assert.equal(npcMatchesRole(resolved, 'all'), true);
});

test('normalizes deep-link filters and uses the selected factual category glyph', () => {
  assert.equal(npcRoleFilter('bank'), 'bank');
  assert.equal(npcRoleFilter('other'), 'other');
  assert.equal(npcRoleFilter('bogus'), 'all');
  assert.equal(npcRoleGlyph(resolved, 'quest'), 'quest');
  assert.equal(npcRoleGlyph(resolved, 'all'), 'coin');
  assert.equal(npcRoleGlyph(plain, 'all'), 'npc');
});

test('discovers only categories present in the current publication', () => {
  const filters = availableNpcFilters([
    resolved,
    { kind: 'npc', roles: ['travel'], role_resolution_state: 'RESOLVED' },
    plain,
    { kind: 'monster' },
  ]);
  assert.deepEqual(filters, ['all', 'bank', 'travel', 'quest', 'other']);
});
