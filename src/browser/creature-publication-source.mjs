const SHA256 = /^sha256:[0-9a-f]{64}$/;

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

export function validateCreaturePublicationSource(source, animationSource, expected) {
  requireValue(source && typeof source === 'object' && !Array.isArray(source), 'creature source invalid');
  requireValue(animationSource && typeof animationSource === 'object' && !Array.isArray(animationSource), 'creature animation source invalid');
  requireValue(expected && typeof expected === 'object' && !Array.isArray(expected), 'creature source expectations invalid');
  requireValue(typeof expected.contractId === 'string' && expected.contractId.length > 0, 'creature contract expectation invalid');
  requireValue(typeof expected.capability === 'string' && expected.capability.length > 0, 'creature capability expectation invalid');
  requireValue(SHA256.test(expected.semanticDigest), 'creature semantic digest expectation invalid');
  requireValue(Number.isSafeInteger(expected.npcRoleSchemaVersion) && expected.npcRoleSchemaVersion > 0, 'creature NPC role schema expectation invalid');
  requireValue(source.contract_id === expected.contractId, 'creature source contract mismatch');
  requireValue(source.capability === expected.capability, 'creature source capability mismatch');
  requireValue(source.semantic_digest === expected.semanticDigest, 'creature source semantic digest mismatch');
  requireValue(source.npc_role_schema_version === expected.npcRoleSchemaVersion, 'creature source NPC role schema mismatch');
  if (expected.fixtureId == null) requireValue(source.fixture_id == null, 'production creature source must not claim fixture identity');
  else requireValue(source.fixture_id === expected.fixtureId, 'creature source fixture identity mismatch');

  requireValue(SHA256.test(source.appearance_product_root), 'creature source appearance root invalid');
  requireValue(SHA256.test(source.outfit_spatial_product_root), 'creature source outfit root invalid');
  requireValue(source.appearance_product_root === animationSource.appearance_product_root, 'creature/animation appearance root mismatch');
  requireValue(source.outfit_spatial_product_root === animationSource.outfit_spatial_product_root, 'creature/animation outfit root mismatch');
  return Object.freeze({ ...source });
}
