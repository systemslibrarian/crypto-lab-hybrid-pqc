import { expect, test } from '@playwright/test';

test('tour narration follows the switch settings across a shared link and a manual edit', async ({ page }) => {
  await page.goto('./?step=4');
  await expect(page.locator('.tour-count')).toHaveText('Step 5 of 6');
  await expect(page.locator('#break-classical')).toBeChecked();
  const pq = page.locator('#break-pq');
  await expect(pq).toBeChecked();
  await pq.press('Space');
  await expect(pq).not.toBeChecked();
  await expect(page.getByRole('button', { name: /Start guided tour/ })).toBeVisible();
  await expect(page.locator('.tour-takeaway')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('step')).toBe(false);
  await page.reload();
  await expect(page.locator('#break-classical')).toBeChecked();
  await expect(pq).not.toBeChecked();
  await expect(page.locator('.tour-takeaway')).toHaveCount(0);
});
