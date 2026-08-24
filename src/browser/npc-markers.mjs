const ROLE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'bank', label: 'Bank', glyph: 'coin' }),
  Object.freeze({ id: 'travel', label: 'Travel', glyph: 'travel' }),
  Object.freeze({ id: 'shop', label: 'Shops', glyph: 'bag' }),
  Object.freeze({ id: 'quest', label: 'Quests', glyph: 'quest' }),
  Object.freeze({ id: 'blessing', label: 'Blessings', glyph: 'star' }),
  Object.freeze({ id: 'trainer', label: 'Training', glyph: 'book' }),
]);

export const NPC_ROLE_IDS = Object.freeze(ROLE_DEFINITIONS.map(({ id }) => id));
const ROLE_INDEX = new Map(ROLE_DEFINITIONS.map((definition, index) => [definition.id, { ...definition, index }]));
const FILTER_IDS = new Set(['all', 'other', ...NPC_ROLE_IDS]);

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateNpcRoleMetadata(record) {
  requireValue(record?.kind === 'npc', 'NPC role metadata requires an NPC record');
  const state = record.role_resolution_state;
  const roles = record.roles;
  if (state == null) {
    requireValue(roles == null, 'NPC roles require a role resolution state');
    return [];
  }
  requireValue(state === 'RESOLVED' || state === 'AMBIGUOUS', 'invalid NPC role resolution state');
  if (state === 'AMBIGUOUS') {
    requireValue(roles == null, 'ambiguous NPC role metadata must not publish roles');
    return [];
  }
  if (roles == null) return [];
  requireValue(Array.isArray(roles), 'NPC roles must be an array');
  let previous = -1;
  const seen = new Set();
  for (const role of roles) {
    const definition = ROLE_INDEX.get(role);
    requireValue(definition, `unsupported NPC role: ${String(role)}`);
    requireValue(!seen.has(role), `duplicate NPC role: ${role}`);
    requireValue(definition.index > previous, 'NPC roles must use canonical order');
    seen.add(role);
    previous = definition.index;
  }
  return [...roles];
}

export function npcRoleFilter(value) {
  return FILTER_IDS.has(value) ? value : 'all';
}

export function npcPresentationRoles(record) {
  const roles = validateNpcRoleMetadata(record);
  return record.role_resolution_state === 'RESOLVED' && roles.length ? roles : ['other'];
}

function npcBadgeRoleSlot(role) {
  const definition = ROLE_INDEX.get(role);
  requireValue(definition, `unsupported NPC role: ${String(role)}`);
  return Object.freeze({ kind: 'role', role, glyph: definition.glyph });
}

function npcBadgeOverflowSlot(hiddenCount) {
  requireValue(Number.isSafeInteger(hiddenCount) && hiddenCount > 0, 'NPC badge overflow count must be positive');
  return Object.freeze({ kind: 'overflow', hiddenCount, text: `+${hiddenCount}` });
}

const NPC_BADGE_FALLBACK_SLOT = Object.freeze({ kind: 'fallback', role: 'other', glyph: 'npc' });

export function npcBadgeSlots(record, activeFilter = 'all', maxSlots = 3) {
  requireValue(
    Number.isSafeInteger(maxSlots) && maxSlots >= 1 && maxSlots <= 3,
    'NPC badge maxSlots must be an integer from 1 to 3',
  );
  const roles = validateNpcRoleMetadata(record);
  if (record.role_resolution_state !== 'RESOLVED' || roles.length === 0) {
    return Object.freeze([NPC_BADGE_FALLBACK_SLOT]);
  }
  if (roles.length <= maxSlots) {
    return Object.freeze(roles.map((role) => npcBadgeRoleSlot(role)));
  }

  const explicitCapacity = maxSlots - 1;
  let explicitRoles = roles.slice(0, explicitCapacity);
  const normalizedFilter = npcRoleFilter(activeFilter);
  const activeFactualRole = normalizedFilter !== 'all'
    && normalizedFilter !== 'other'
    && roles.includes(normalizedFilter);
  if (activeFactualRole && !explicitRoles.includes(normalizedFilter)) {
    if (explicitCapacity === 0) explicitRoles = [];
    else if (explicitCapacity === 1) explicitRoles = [normalizedFilter];
    else explicitRoles = [...roles.slice(0, explicitCapacity - 1), normalizedFilter];
  }

  const hiddenCount = roles.length - explicitRoles.length;
  const slots = explicitRoles.map((role) => npcBadgeRoleSlot(role));
  slots.push(npcBadgeOverflowSlot(hiddenCount));
  return Object.freeze(slots);
}
export function npcMatchesRole(record, filter) {
  const normalized = npcRoleFilter(filter);
  if (normalized === 'all') return true;
  return npcPresentationRoles(record).includes(normalized);
}
export function npcRoleLabel(role) {
  if (role === 'all') return 'All NPCs';
  if (role === 'other') return 'Other / uncategorized';
  const definition = ROLE_INDEX.get(role);
  requireValue(definition, `unsupported NPC role: ${String(role)}`);
  return definition.label;
}

export function npcRoleGlyph(record, filter = 'all') {
  const normalized = npcRoleFilter(filter);
  const roles = npcPresentationRoles(record);
  if (normalized !== 'all' && normalized !== 'other' && roles.includes(normalized)) {
    return ROLE_INDEX.get(normalized).glyph;
  }
  if (normalized === 'other' || roles[0] === 'other') return 'npc';
  return ROLE_INDEX.get(roles[0])?.glyph ?? 'npc';
}

export function availableNpcFilters(records) {
  const present = new Set();
  let other = false;
  for (const record of records) {
    if (record?.kind !== 'npc') continue;
    const roles = npcPresentationRoles(record);
    for (const role of roles) {
      if (role === 'other') other = true;
      else present.add(role);
    }
  }
  return ['all', ...NPC_ROLE_IDS.filter((role) => present.has(role)), ...(other ? ['other'] : [])];
}
