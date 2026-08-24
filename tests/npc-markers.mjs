import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NPC_ROLE_IDS,
  availableNpcFilters,
  npcBadgeSlots,
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

test('builds immutable bounded badge slots in canonical factual order', () => {
  const one = { kind: 'npc', roles: ['bank'], role_resolution_state: 'RESOLVED' };
  const three = { kind: 'npc', roles: ['bank', 'travel', 'shop'], role_resolution_state: 'RESOLVED' };
  const four = { kind: 'npc', roles: ['bank', 'travel', 'shop', 'quest'], role_resolution_state: 'RESOLVED' };
  const five = { kind: 'npc', roles: ['bank', 'travel', 'shop', 'quest', 'blessing'], role_resolution_state: 'RESOLVED' };

  assert.deepEqual(npcBadgeSlots(one), [
    { kind: 'role', role: 'bank', glyph: 'coin' },
  ]);
  assert.deepEqual(npcBadgeSlots(resolved), [
    { kind: 'role', role: 'bank', glyph: 'coin' },
    { kind: 'role', role: 'quest', glyph: 'quest' },
  ]);
  assert.deepEqual(npcBadgeSlots(three), [
    { kind: 'role', role: 'bank', glyph: 'coin' },
    { kind: 'role', role: 'travel', glyph: 'travel' },
    { kind: 'role', role: 'shop', glyph: 'bag' },
  ]);
  assert.deepEqual(npcBadgeSlots(four), [
    { kind: 'role', role: 'bank', glyph: 'coin' },
    { kind: 'role', role: 'travel', glyph: 'travel' },
    { kind: 'overflow', hiddenCount: 2, text: '+2' },
  ]);
  const fiveSlots = npcBadgeSlots(five);
  assert.deepEqual(fiveSlots, [
    { kind: 'role', role: 'bank', glyph: 'coin' },
    { kind: 'role', role: 'travel', glyph: 'travel' },
    { kind: 'overflow', hiddenCount: 3, text: '+3' },
  ]);
  assert.equal(Object.isFrozen(fiveSlots), true);
  assert.equal(fiveSlots.every(Object.isFrozen), true);
});

test('keeps a hidden active factual filter role visible without rewriting roles', () => {
  const record = {
    kind: 'npc',
    roles: ['bank', 'travel', 'shop', 'quest', 'blessing'],
    role_resolution_state: 'RESOLVED',
  };
  const before = [...record.roles];

  assert.deepEqual(npcBadgeSlots(record, 'travel'), [
    { kind: 'role', role: 'bank', glyph: 'coin' },
    { kind: 'role', role: 'travel', glyph: 'travel' },
    { kind: 'overflow', hiddenCount: 3, text: '+3' },
  ]);
  assert.deepEqual(npcBadgeSlots(record, 'blessing'), [
    { kind: 'role', role: 'bank', glyph: 'coin' },
    { kind: 'role', role: 'blessing', glyph: 'star' },
    { kind: 'overflow', hiddenCount: 3, text: '+3' },
  ]);
  assert.deepEqual(record.roles, before);
});

test('uses only the neutral presentation fallback for unresolved factual roles', () => {
  const fallback = [{ kind: 'fallback', role: 'other', glyph: 'npc' }];
  assert.deepEqual(npcBadgeSlots(plain), fallback);
  assert.deepEqual(npcBadgeSlots(ambiguous), fallback);
  assert.throws(
    () => npcBadgeSlots({ kind: 'npc', roles: ['weapons'], role_resolution_state: 'RESOLVED' }),
    /role/,
  );
});

test('badge slot bounds fail closed and overflow is not a factual role descriptor', () => {
  const record = {
    kind: 'npc',
    roles: ['bank', 'travel', 'shop', 'quest'],
    role_resolution_state: 'RESOLVED',
  };
  assert.throws(() => npcBadgeSlots(record, 'all', 0), /maxSlots/);
  assert.throws(() => npcBadgeSlots(record, 'all', 4), /maxSlots/);
  assert.throws(() => npcBadgeSlots(record, 'all', 1.5), /maxSlots/);
  const overflow = npcBadgeSlots(record)[2];
  assert.equal(overflow.kind, 'overflow');
  assert.equal(Object.hasOwn(overflow, 'role'), false);
});
