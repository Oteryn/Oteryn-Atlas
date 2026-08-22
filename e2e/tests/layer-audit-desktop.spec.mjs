import { expect, test } from '@playwright/test';
import { gotoAtlas, waitForAtlas } from './runtime.mjs';

test('layer controls expose correct availability and fail-closed states', async ({ page }) => {
  await gotoAtlas(page, '/web/fullworld.html?x=32369&y=32241&floor=-7&zoom=0.48');
  await waitForAtlas(page);

  await expect(page.getByText('Base semantic pixels', { exact: true })).toBeVisible();
  const base = page.getByText('Base semantic pixels', { exact: true }).locator('..').locator('input');
  await expect(base).toBeChecked();
  await expect(base).toBeDisabled();

  const overview = page.locator('#overview-toggle');
  await expect(overview).toBeEnabled();
  await overview.check();
  await expect(overview).toBeChecked();
  await overview.uncheck();
  await expect(overview).not.toBeChecked();

  const failClosed = [
    ['Areas', 'BLOCKED'],
    ['Subareas', 'BLOCKED'],
    ['Towns', 'BLOCKED'],
    ['Temples', 'UNKNOWN'],
    ['Teleports / transitions', 'BLOCKED'],
    ['Houses', 'BLOCKED'],
    ['House doors', 'UNKNOWN'],
    ['Action IDs', 'BLOCKED'],
    ['Unique IDs', 'BLOCKED'],
    ['Waypoints', 'BLOCKED'],
    ['Mechanics', 'BLOCKED'],
    ['Raids / encounters', 'BLOCKED'],
    ['Quest areas', 'UNKNOWN'],
    ['POIs', 'BLOCKED'],
  ];

  const rows = page.locator('#semantic-layer-list .layer');
  await expect(rows).toHaveCount(failClosed.length + 2);
  for (const [label, status] of failClosed) {
    const row = rows.filter({ has: page.getByText(label, { exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(status);
    await expect(row.locator('input')).toBeDisabled();
    await expect(row.locator('input')).not.toBeChecked();
  }

  for (const [kind, label] of [['npc', 'NPCs'], ['monster', 'Monsters / Spawns']]) {
    const row = rows.filter({ has: page.getByText(label, { exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('STATIC');
    await expect(row.locator(`input[data-creature-kind="${kind}"]`)).toBeEnabled();
    await expect(row.locator(`input[data-creature-kind="${kind}"]`)).not.toBeChecked();
  }
});
