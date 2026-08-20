import {
  FullWorldError,
  selectBudgetedRuntimeGroups,
  validateWorldChunkDescriptor,
} from './fullworld.mjs';

function requireValue(condition, message) {
  if (!condition) throw new FullWorldError(message);
}

function validateQueryBounds(bounds) {
  requireValue(bounds && Number.isFinite(bounds.x_min) && Number.isFinite(bounds.x_max_exclusive) && Number.isFinite(bounds.y_min) && Number.isFinite(bounds.y_max_exclusive), 'World Query region invalid');
  requireValue(bounds.x_min < bounds.x_max_exclusive && bounds.y_min < bounds.y_max_exclusive, 'World Query region empty');
  return bounds;
}

function intersects(a, b) {
  return a.x_min < b.x_max_exclusive && a.x_max_exclusive > b.x_min
    && a.y_min < b.y_max_exclusive && a.y_max_exclusive > b.y_min;
}

function frozenStatus(status, reason, extra = {}) {
  return Object.freeze({ status, reason, ...extra });
}

export function createWorldQueryApi(runtimeWorld, capabilities) {
  requireValue(runtimeWorld?.source?.authority === 'Oteryn/Oteryn-Game', 'verified runtime world required');
  const layerById = new Map((capabilities?.layers ?? []).map((layer) => [layer.id, layer]));

  function region(runtimeFloor, bounds) {
    validateQueryBounds(bounds);
    return Object.freeze(runtimeFloor.chunks
      .map((chunk) => validateWorldChunkDescriptor(chunk, runtimeWorld, runtimeFloor))
      .filter((chunk) => intersects(chunk.bounds, bounds)));
  }
  function provenance(runtimeFloor, chunkId) {
    const chunk = runtimeFloor.chunks.find((entry) => entry.worldChunk?.chunk_id === chunkId);
    requireValue(chunk, `WorldChunk ${chunkId} is not present on floor ${runtimeFloor.floor}`);
    return validateWorldChunkDescriptor(chunk, runtimeWorld, runtimeFloor);
  }

  function layer(layerId) {
    const capability = layerById.get(layerId);
    requireValue(capability, `semantic layer ${layerId} is unknown`);
    return Object.freeze({ ...capability });
  }

  function entity(entityId) {
    requireValue(typeof entityId === 'string' && entityId.length > 0, 'entity query id required');
    return frozenStatus('BLOCKED', 'No authoritative full-world entity index is enabled in the current publication.', { entityId });
  }

  function object(objectId) {
    requireValue(typeof objectId === 'string' && objectId.length > 0, 'object query id required');
    return frozenStatus('BLOCKED', 'No authoritative full-world object index is enabled in the current publication.', { objectId });
  }

  function selectViewportGroups(runtimeFloor, visibleBounds, retainBounds, budget) {
    region(runtimeFloor, visibleBounds);
    return selectBudgetedRuntimeGroups(runtimeFloor, visibleBounds, retainBounds, budget);
  }
  return Object.freeze({
    entity,
    layer,
    object,
    provenance,
    region,
    selectViewportGroups,
  });
}
