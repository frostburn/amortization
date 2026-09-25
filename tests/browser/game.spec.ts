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

test('accepts successive movement orders next to and around the kiosk', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  const map = await page.locator('canvas').boundingBox();
  expect(map).not.toBeNull();
  const { x, y, width, height } = map!;
  const scale = Math.min(width / (58 * 26 + 80), height / (58 * 14 + 110));
  for (const point of [
    { x: 6.205, y: 11 },
    { x: 7.2, y: 14 },
    { x: 1.5, y: 7 },
    { x: 7.5, y: 16 },
  ]) {
    await page.mouse.click(
      x + width / 2 + ((point.x - point.y) * 26 - 3 * 26) * scale,
      y + height / 2 + ((point.x + point.y) * 14 - 29 * 14 + 25) * scale,
      { button: 'right' },
    );
    await expect(page.locator('#condition-0')).toHaveText('Moving');
    await expect(page.locator('#condition-0')).toHaveText('Concealed', { timeout: 15_000 });
    await expect(page.locator('#message')).not.toContainText('No clear route');
  }
  expect(errors).toEqual([]);
});
