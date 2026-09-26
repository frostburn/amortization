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

test('keeps the squad selected through missed drags and map clicks, with deliberate individual selection', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const map = (await page.locator('canvas').boundingBox())!;
  const scale = Math.min(map.width / (58 * 26 + 80), map.height / (58 * 14 + 110));
  const morrow = {
    x: map.x + map.width / 2 + ((5.4 - 21.2) * 26 - 3 * 26) * scale,
    y: map.y + map.height / 2 + ((5.4 + 21.2) * 14 - 0.5 * 25 - 29 * 14 + 25) * scale,
  };
  await page.mouse.click(morrow.x, morrow.y);
  await expect(page.locator('#selected-count')).toHaveText('4 / 4');
  for (const distance of [6, 80]) {
    await page.mouse.move(map.x + 40, map.y + 40);
    await page.mouse.down();
    await page.mouse.move(map.x + 40 + distance, map.y + 40 + distance);
    await page.mouse.up();
    await expect(page.locator('#selected-count')).toHaveText('4 / 4');
  }
  // Combat commands still reach everyone after the near-miss inputs.
  await page.keyboard.press('f');
  for (let i = 0; i < 4; i++)
    await expect(page.locator(`#condition-${i}`)).toHaveText('Weapon drawn');
  await page.keyboard.down('Shift');
  await page.mouse.click(morrow.x, morrow.y);
  await page.keyboard.up('Shift');
  await expect(page.locator('#selected-count')).toHaveText('3 / 4');
  await expect(page.getByRole('button', { name: 'Select Morrow', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  await expect(page.locator('#selected-name')).toHaveText('Vale');
  await page
    .getByRole('button', { name: 'Select Vale', exact: true })
    .click({ modifiers: ['Shift'] });
  await expect(page.locator('#selected-count')).toHaveText('1 / 4');
  await page.keyboard.press('q');
  await page.keyboard.press('3');
  await expect(page.locator('#selected-name')).toHaveText('Rook');
  // A deliberate box around the starting crew still replaces a solo selection.
  await page.mouse.move(morrow.x - 65, morrow.y - 30);
  await page.mouse.down();
  await page.mouse.move(morrow.x + 65, morrow.y + 75, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('#selected-count')).toHaveText('4 / 4');
});

test('touch map orders preserve the squad while portraits select individuals', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Begin operation' }).tap();
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  const map = (await page.locator('canvas').boundingBox())!;
  const scale = Math.min(map.width / (58 * 26 + 80), map.height / (58 * 14 + 110));
  await page.touchscreen.tap(
    map.x + map.width / 2 + ((5.4 - 21.2) * 26 - 3 * 26) * scale,
    map.y + map.height / 2 + ((5.4 + 21.2) * 14 - 0.5 * 25 - 29 * 14 + 25) * scale,
  );
  await expect(page.locator('#selected-count')).toHaveText('4 / 4');
  await page.getByRole('button', { name: 'Select Sable', exact: true }).tap();
  await expect(page.locator('#selected-name')).toHaveText('Sable');
  await context.close();
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

test('switches operations, holds the shunt while selecting a teammate, and restarts mission two', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose operation' }).click();
  await page.getByRole('button', { name: /02 .*Material breach/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Two people, one borrowed identity');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  const map = (await page.locator('canvas').boundingBox())!;
  const scale = Math.min(map.width / (62 * 26 + 80), map.height / (62 * 14 + 110));
  await page.mouse.click(
    map.x + map.width / 2 + ((4.8 - 10.2) * 26 - 3 * 26) * scale,
    map.y + map.height / 2 + ((4.8 + 10.2) * 14 - 1.45 * 25 - 31 * 14 + 25) * scale,
    { button: 'right' },
  );
  await expect(page.locator('#condition-1')).toHaveText('Holding shunt', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Select all' }).click();
  await expect(page.locator('#work-label')).toContainText('Vale: holding SHUNT');
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  // Reissuing an order on the marker still works when its operator overlaps it.
  await page.mouse.click(
    map.x + map.width / 2 + ((4.8 - 10.2) * 26 - 3 * 26) * scale,
    map.y + map.height / 2 + ((4.8 + 10.2) * 14 - 1.45 * 25 - 31 * 14 + 25) * scale,
    { button: 'right' },
  );
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await expect(page.locator('#archive-status')).toHaveText('SHUNT held by Vale');
  await expect(page.locator('#objective-primary')).toContainText('shutter open');
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  await page.locator('[data-action="hold"]').click();
  await expect(page.locator('#archive-status')).toHaveText('Shutter: locked');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#mission-title')).toHaveText('Material breach');
  await expect(page.locator('#condition-1')).toHaveText('Concealed');
  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  await page.getByRole('button', { name: /01 .*The release clause/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Voss wants out.');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await expect(page.locator('#archive-status')).toBeHidden();
  expect(errors).toEqual([]);
});
