import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const SCENARIO_CATEGORIES = Object.freeze([
  'unit', 'contract', 'e2e', 'geometry', 'render', 'visual',
  'stress', 'performance', 'accessibility', 'failure',
]);
const CATEGORY_SET = new Set(SCENARIO_CATEGORIES);
const STATUS_SET = new Set(['pass', 'fail', 'skip']);

function requireValue(condition, message) {
  if (!condition) throw new TypeError(message);
}

function boundedText(value, label, maximum = 512) {
  requireValue(typeof value === 'string' && value.length > 0 && value.length <= maximum, `${label} invalid`);
  return value;
}

function safeArtifactPath(value) {
  boundedText(value, 'artifact path', 1024);
  requireValue(!path.isAbsolute(value), 'artifact path must be relative');
  const normalized = value.replaceAll('\\', '/');
  requireValue(!normalized.split('/').some((part) => part === '..' || part === ''), 'artifact path traversal is forbidden');
  return normalized;
}

export function normalizeScenarioEvidence(input) {
  requireValue(input && typeof input === 'object' && !Array.isArray(input), 'scenario evidence must be an object');
  const scenarioId = boundedText(input.scenarioId, 'scenario id', 256);
  requireValue(CATEGORY_SET.has(input.category), 'scenario category invalid');
  requireValue(STATUS_SET.has(input.status), 'scenario status invalid');
  requireValue(Number.isFinite(input.durationMs) && input.durationMs >= 0, 'scenario duration invalid');
  if (input.status === 'skip') boundedText(input.skipReason, 'skip reason', 1024);
  if (input.firstFailingActionIndex != null) {
    requireValue(Number.isSafeInteger(input.firstFailingActionIndex) && input.firstFailingActionIndex >= 0, 'first failing action index invalid');
  }
  const artifacts = Object.freeze((input.artifacts ?? []).map(safeArtifactPath));
  const value = {
    scenarioId,
    category: input.category,
    status: input.status,
    targetMode: input.targetMode ?? null,
    browserProfile: input.browserProfile ?? null,
    atlasRevision: input.atlasRevision ?? null,
    durationMs: input.durationMs,
    seed: input.seed ?? null,
    firstFailingActionIndex: input.firstFailingActionIndex ?? null,
    skipReason: input.skipReason ?? null,
    artifacts,
  };
  return Object.freeze(value);
}

export async function writeScenarioEvidence(artifactsDir, input) {
  boundedText(artifactsDir, 'artifacts directory', 4096);
  const evidence = normalizeScenarioEvidence(input);
  await mkdir(artifactsDir, { recursive: true });
  const filename = `${evidence.scenarioId.replace(/[^a-zA-Z0-9._-]+/g, '_')}.json`;
  const outputPath = path.join(artifactsDir, filename);
  requireValue(path.dirname(outputPath) === path.resolve(artifactsDir), 'artifact output escaped root');
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return Object.freeze({ path: outputPath, evidence });
}
