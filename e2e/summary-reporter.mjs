import fs from 'node:fs';
import path from 'node:path';

export default class AtlasSummaryReporter {
  onBegin(config) {
    this.startedAt = new Date().toISOString();
    this.metadata = config.metadata ?? {};
    this.projects = config.projects.map((project) => ({
      name: project.name,
      viewport: project.use?.viewport ?? null,
      browserName: project.use?.browserName ?? null,
      isMobile: Boolean(project.use?.isMobile),
    }));
    this.scenarios = [];
  }

  onTestEnd(test, result) {
    const project = test.parent.project()?.name ?? test.parent.title ?? 'unknown';
    this.scenarios.push({
      project,
      scenario: test.titlePath().slice(1).join(' / '),
      status: result.status,
      durationMs: result.duration,
      retry: result.retry,
      evidence: result.attachments.map((attachment) => attachment.path).filter(Boolean),
      error: result.error?.message ?? null,
    });
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
  }
}
