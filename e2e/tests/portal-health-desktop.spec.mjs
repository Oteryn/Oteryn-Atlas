import { expect, test } from '@playwright/test';

const criticalStaticResources = [
  ['/web/fullworld.html', /text\/html/i],
  ['/web/fullworld-app.mjs', /javascript/i],
  ['/web/fullworld-search.mjs', /javascript/i],
  ['/web/fullworld-creatures.mjs', /javascript/i],
  ['/src/browser/fullworld.mjs', /javascript/i],
  ['/web/semantic-search/index.json', /application\/json/i],
  ['/web/semantic-search/creatures.json', /application\/json/i],
];

const criticalPublicationResources = [
  '/fullworld/publication/publication.json',
  '/fullworld/minimap/world.json',
  '/data/creatures/index.json',
];

test('portal health exposes browser runtime and publication prerequisites', async ({ request }) => {
  for (const [path, contentType] of criticalStaticResources) {
    const response = await request.get(path);
    expect(response.status(), `${path} status`).toBe(200);
    expect(response.headers()['content-type'] ?? '', `${path} content-type`).toMatch(contentType);
  }

  for (const path of criticalPublicationResources) {
    const response = await request.get(path);
    expect(response.status(), `${path} status`).toBe(200);
    expect(response.headers()['content-type'] ?? '', `${path} content-type`).toMatch(/application\/json/i);
  }
  const entry = await request.get('/web/fullworld.html');
  const expectedRevision = process.env.ATLAS_EXPECTED_REVISION?.trim();
  if (expectedRevision) {
    const headers = entry.headers();
    const observed = headers['x-oteryn-atlas-code-revision'] || headers['x-oteryn-atlas-revision'];
    expect(observed, 'Atlas entry revision header').toBe(expectedRevision);
  }

  const publication = await request.get('/fullworld/publication/publication.json');
  expect(publication.headers()['accept-ranges'] ?? '', 'publication range support').toMatch(/bytes/i);
});
