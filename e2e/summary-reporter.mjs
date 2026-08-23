import fs from 'node:fs';
import path from 'node:path';

const CATEGORIES = new Set([
  'unit', 'contract', 'e2e', 'geometry', 'render', 'visual',
  'stress', 'performance', 'accessibility', 'failure',
]);

function annotationValue(annotations, type) {
  return annotations?.find((entry) => entry?.type === type)?.description ?? null;
}

export function classifyScenario(file, annotations = []) {
  const explicit = annotationValue(annotations, 'category');
  if (explicit && CATEGORIES.has(explicit)) return explicit;
  const normalized = String(file ?? '').replaceAll('\\', '/');
  if (/geometry-(?:desktop|mobile)\.spec\.mjs$/.test(normalized)) return 'geometry';
  if (/render-probes-.*\.spec\.mjs$/.test(normalized)) return 'render';
  if (/visual-.*\.spec\.mjs$/.test(normalized)) return 'visual';
  if (/stress-.*\.spec\.mjs$/.test(normalized)) return 'stress';
  if (/performance-.*\.spec\.mjs$/.test(normalized)) return 'performance';
  if (/accessibility-.*\.spec\.mjs$/.test(normalized)) return 'accessibility';
  if (/resilience-.*\.spec\.mjs$/.test(normalized)) return 'failure';
  return 'e2e';
}

function optionalInteger(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function normalizeSummaryScenario(input) {
  const annotations = input.annotations ?? [];
  const seed = optionalInteger(annotationValue(annotations, 'seed'));
  const firstFailingActionIndex = optionalInteger(annotationValue(annotations, 'first-failing-action'));
  const skipReason = annotationValue(annotations, 'skip-reason')
    ?? annotationValue(annotations, 'skip')
    ?? null;
  return Object.freeze({
    project: input.project,
    scenario: input.title,
    category: classifyScenario(input.file, annotations),
    status: input.status,
    durationMs: input.durationMs,
    retry: input.retry,
    seed,
    firstFailingActionIndex,
    skipReason,
    evidence: Object.freeze([...(input.evidence ?? [])]),
    error: input.error ?? null,
  });
}

export function buildFailureManifest(summary) {
  const failures = Object.freeze((summary.scenarios ?? [])
    .filter((scenario) => scenario.status !== 'passed' && scenario.status !== 'skipped')
    .slice(0, 64)
    .map((scenario) => Object.freeze({
      project: String(scenario.project ?? 'unknown').slice(0, 128),
      scenario: String(scenario.scenario ?? 'unknown').slice(0, 512),
      category: scenario.category ?? 'e2e',
      status: scenario.status ?? 'unknown',
      durationMs: scenario.durationMs ?? null,
      seed: scenario.seed ?? null,
      firstFailingActionIndex: scenario.firstFailingActionIndex ?? null,
      skipReason: scenario.skipReason ?? null,
      evidence: Object.freeze([...(scenario.evidence ?? [])].slice(0, 32)),
      error: scenario.error == null ? null : String(scenario.error).slice(0, 4096),
    })));
  return Object.freeze({
    version: 1,
    status: summary.status,
    atlasRevision: summary.metadata?.expectedRevision ?? null,
    targetMode: summary.metadata?.targetMode ?? null,
    targetURL: summary.metadata?.targetURL ?? null,
    browserContainer: summary.metadata?.browserContainer ?? null,
    projects: Object.freeze([...(summary.projects ?? [])].slice(0, 16)),
    failures,
  });
}

export default class AtlasSummaryReporter {
  onBegin(config) {
    this.startedAt = new Date().toISOString();
    this.metadata = config.metadata ?? {};
    this.projects = config.projects.map((project) => ({
      name: project.name,
      viewport: project.use?.viewport ?? null,
      browserName: project.use?.browserName ?? null,
      isMobile: Boolean(project.use?.isMobile),
      deviceScaleFactor: project.use?.deviceScaleFactor ?? 1,
    }));
    this.scenarios = [];
  }

  onTestEnd(test, result) {
    const project = test.parent.project()?.name ?? test.parent.title ?? 'unknown';
    this.scenarios.push(normalizeSummaryScenario({
      project,
      file: test.location?.file ?? '',
      title: test.titlePath().slice(1).join(' / '),
      annotations: test.annotations ?? [],
      status: result.status,
      durationMs: result.duration,
      retry: result.retry,
      evidence: result.attachments.map((attachment) => attachment.path).filter(Boolean),
      error: result.error?.message ?? null,
    }));
  }

  async onEnd(result) {
    const artifactsDir = process.env.ATLAS_ARTIFACTS_DIR || '/artifacts';
    fs.mkdirSync(artifactsDir, { recursive: true });
    const summary = {
      status: result.status,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      metadata: this.metadata,
      projects: this.projects,
      scenarios: this.scenarios,
    };
    fs.writeFileSync(path.join(artifactsDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
    if (result.status !== 'passed') {
      const failure = buildFailureManifest(summary);
      fs.writeFileSync(path.join(artifactsDir, 'failure.json'), `${JSON.stringify(failure, null, 2)}\n`);
    }
  }
}
