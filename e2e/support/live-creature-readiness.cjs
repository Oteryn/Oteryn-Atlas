'use strict';

function liveCreatureReady({
  digest,
  selected = null,
  wantNpc = true,
  wantMonster = true,
  requireNpcBadge = false,
} = {}) {
  const value = globalThis.__OTERYN_ATLAS_CREATURES__;
  if (!value || value.status !== 'PASS') return false;
  if (value.sourceSemanticDigest !== digest) return false;
  if (value.cacheChunks > 96 || value.drawnRecords < 1 || value.pixelDrawnRecords < 1) return false;
  if (!value.animationRuntime || value.animationRuntime.creaturePrograms !== 1377) return false;
  if (value.enabled?.npc !== wantNpc || value.enabled?.monster !== wantMonster) return false;
  if (selected && (value.selectedRecordId !== selected || value.selectedVisible !== true)) return false;
  if (requireNpcBadge) {
    const render = value.render;
    if (value.npcMarkerStyle !== 'functional-icons-v2') return false;
    if (!Number.isSafeInteger(value.drawnNpcIcons) || value.drawnNpcIcons < 1) return false;
    if (!render || render.baseGenerationAtStart == null || render.baseGenerationAtStart !== render.baseGenerationAtCommit) return false;
    if (!Number.isSafeInteger(render.drawnNpcBadges) || render.drawnNpcBadges < 1) return false;
  }
  return true;
}

module.exports = { liveCreatureReady };