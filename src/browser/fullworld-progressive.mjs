export class FullWorldProgressiveError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new FullWorldProgressiveError(message);
}

export function renderRecordBucket(record, pixelCatalog, runtimeCatalog) {
  const spriteSourceId = record?.primitive?.spriteSourceId;
  requireValue(Number.isSafeInteger(spriteSourceId) && spriteSourceId > 0, 'render record sprite source is invalid');
  const sourceBlob = pixelCatalog?.sprites?.get?.(spriteSourceId);
  requireValue(sourceBlob, `published pixel mapping missing for sprite ${spriteSourceId}`);
  const placement = runtimeCatalog?.blobs?.get?.(sourceBlob.contentId);
  requireValue(placement, `runtime pixel placement missing for ${sourceBlob.contentId}`);
  requireValue(placement.width === sourceBlob.width && placement.height === sourceBlob.height, `runtime pixel placement dimensions diverge for ${sourceBlob.contentId}`);
  return placement.bucket;
}

export function recordsForResidentBuckets(records, pixelCatalog, runtimeCatalog, residentBuckets) {
  requireValue(Array.isArray(records), 'render records must be an array');
  requireValue(residentBuckets instanceof Set, 'resident pixel buckets must be a Set');
  return records.filter((record) => residentBuckets.has(renderRecordBucket(record, pixelCatalog, runtimeCatalog)));
}

export function detailQualificationSatisfied(result) {
  if (!result || result.status !== 'PASS') return false;
  if (!(Number(result.view?.zoom) >= 0.5)) return true;
  const measured = result.measured;
  if (!measured) return false;
  if ((measured.visibleRangeGroups ?? 0) === 0) return true;
  return (measured.retainedTiles ?? 0) > 0
    && (measured.submittedPrimitives ?? 0) > 0
    && (measured.loadedPixelBuckets ?? 0) > 0
    && measured.drawCalls === 1;
}
