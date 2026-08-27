import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { analyzeCreatureAnimationCoverage } from '../support/creature-animation-coverage.mjs';

const STATIC_EQUIVALENT_PRESENTATION = 'outfit-presentation:sha256:b16bfc92e9d9e9c8f790507f987a11b25a169c4343c9d68471de76a5f3565c88';

async function publishedCreatureAnimationCoverage(page) {
  const manifestResponse = await page.request.get('/fullworld/animation/manifest.json');
  expect(manifestResponse.ok(), `animation manifest HTTP ${manifestResponse.status()}`).toBeTruthy();
  const manifest = await manifestResponse.json();
  const programsResponse = await page.request.get('/fullworld/animation/programs.json');
  expect(programsResponse.ok(), `animation programs HTTP ${programsResponse.status()}`).toBeTruthy();
  const bytes = await programsResponse.body();
  expect(bytes.byteLength).toBe(manifest.programs.bytes);
  expect(`sha256:${createHash('sha256').update(bytes).digest('hex')}`).toBe(manifest.programs.digest);
  const coverage = analyzeCreatureAnimationCoverage(JSON.parse(bytes.toString('utf8')));
  expect(coverage.totalPrograms).toBe(manifest.counts.creature_programs);
  return coverage;
}

test('published creature animation product passes the full authoritative coverage census', async ({ page }) => {
  const coverage = await publishedCreatureAnimationCoverage(page);
  expect(coverage).toEqual({
    multiPhasePrograms: 101,
    phaseContentReferences: 2036,
    phaseCountHistogram: { 1: 1276, 2: 2, 3: 4, 4: 4, 6: 1, 8: 88, 9: 2 },
    staticEquivalentProgramIds: [STATIC_EQUIVALENT_PRESENTATION],
    totalPrograms: 1377,
    visuallyDynamicPrograms: 100,
  });
});
