import { expect, test } from '@playwright/test';

test('loads art, accepts individual orders while paused, and restarts cleanly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Amortization');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await expect(page.locator('#selected-name')).toHaveText('Morrow');
  await expect(page.getByRole('button', { name: 'Select Vale', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Draw weapons' }).click();
  await expect(page.locator('#condition-0')).toHaveText('Weapon drawn');
  await expect(page.locator('#condition-1')).toHaveText('Concealed');
  await page.getByRole('button', { name: 'Select all' }).click();
  await expect(page.locator('#selected-count')).toHaveText('4 / 4');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#condition-0')).toHaveText('Concealed');
  await page.getByRole('button', { name: 'Briefing', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('A borrowed identity');
  expect(errors).toEqual([]);
});

test('keeps the briefing and controls usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Select Sable', exact: true }).click();
  await expect(page.locator('#selected-name')).toHaveText('Sable');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});
