import { expect, test } from '@playwright/test';

test('releases Mara, preserves her wait order across selection, and resets the escort controls', async ({
  page,
}) => {
  test.setTimeout(50_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose operation' }).click();
  await page.getByRole('button', { name: /04 .*Protective custody/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Two ways out');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await expect(page.locator('#objective-primary')).toHaveText('○ Unlock the transport');
  await expect(page.locator('#objective-extract')).toContainText('STREET or SERVICE');
  await expect(page.locator('#escort-controls')).toBeHidden();
  const map = (await page.locator('canvas').boundingBox())!;
  const scale = Math.min(map.width / (68 * 26 + 80), map.height / (68 * 14 + 110));
  const order = async (x: number, y: number, z = 1.45) =>
    page.mouse.click(
      map.x + map.width / 2 + ((x - y) * 26 - 4 * 26) * scale,
      map.y + map.height / 2 + ((x + y) * 14 - z * 25 - 34 * 14 + 25) * scale,
      { button: 'right' },
    );
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await order(25, 18.4);
  await expect(page.locator('#message')).toContainText('Transport locked');
  await order(5.5, 21);
  await expect(page.locator('#condition-0')).toHaveText('Maintenance', { timeout: 8_000 });
  await order(14.3, 6.2);
  await expect(page.locator('#objective-primary')).toHaveText('○ Locate Mara', { timeout: 15_000 });
  await expect(page.locator('#escort-controls')).toBeHidden();
  await order(25, 18.4);
  await expect(page.locator('#escort-status')).toHaveText('Mara · 75 / 75 health · following', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Tell Mara to wait', exact: true }).click();
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  await expect(page.locator('#escort-status')).toContainText('waiting');
  await expect(page.locator('#objective-primary')).toHaveText('✓ Mara waiting for escort');
  const extraction = page.getByRole('region', { name: 'Extraction', exact: true });
  await expect(
    extraction.getByRole('button', { name: 'Rally crew to STREET', exact: true }),
  ).toBeVisible();
  await expect(
    extraction.getByRole('button', { name: 'Rally crew to SERVICE', exact: true }),
  ).toBeVisible();
  await extraction.getByRole('button', { name: 'Ask Mara to follow', exact: true }).click();
  await expect(page.locator('#escort-status')).toContainText('following');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#mission-title')).toHaveText('Protective custody');
  await expect(page.locator('#objective-primary')).toHaveText('○ Unlock the transport');
  await expect(page.locator('#escort-controls')).toBeHidden();
  await expect(extraction).toBeHidden();
  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  await page.getByRole('button', { name: /01 .*The release clause/ }).click();
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await expect(page.locator('#objective-primary')).toHaveText('○ Locate Voss');
  await expect(page.locator('#escort-controls')).toBeHidden();
  expect(errors).toEqual([]);
});

test('routes a courier transfer, distinguishes CASE from its carrier, and resets mission three', async ({
  page,
}) => {
  test.setTimeout(40_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose operation' }).click();
  await page.getByRole('button', { name: /03 .*Adverse possession/ }).click();
  await expect(page.getByRole('dialog')).toContainText('A signature in someone else');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  // Let the patrol leave its spawn before testing the moving CASE marker.
  await expect
    .poll(async () => Number((await page.locator('#clock').innerText()).split(':')[1]), {
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('#objective-evidence')).toHaveText('○ Access case · with courier');
  await expect(page.locator('#archive-status')).toBeHidden();
  const map = (await page.locator('canvas').boundingBox())!;
  const scale = Math.min(map.width / (64 * 26 + 80), map.height / (64 * 14 + 110));
  const order = async (x: number, y: number, z = 1.45) =>
    page.mouse.click(
      map.x + map.width / 2 + ((x - y) * 26 - 4 * 26) * scale,
      map.y + map.height / 2 + ((x + y) * 14 - z * 25 - 32 * 14 + 25) * scale,
      { button: 'right' },
    );
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await page.locator('#objective-evidence').hover();
  const locator = page.locator('[data-target="evidence"]');
  await expect(locator).toHaveCount(1);
  await expect(locator).not.toHaveClass(/is-offscreen/);
  const casePoint = await locator.evaluate((el) => {
    const { x, y } = el.getBoundingClientRect();
    return { x, y };
  });
  await page.mouse.click(casePoint.x, casePoint.y, { button: 'right' });
  await expect(page.locator('#message')).toContainText('The courier holds CASE');
  await expect(page.locator('#condition-0')).toHaveText('Concealed');
  await page.mouse.click(casePoint.x, casePoint.y + (2.1 - 0.5) * 25 * scale, { button: 'right' });
  await expect(page.locator('#condition-0')).toHaveText('Weapon drawn');
  await page.getByRole('button', { name: 'Conceal weapons' }).click();
  await order(4.8, 19.5);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#condition-0')).toHaveText('Maintenance', { timeout: 8_000 });
  await order(10.5, 15.3);
  await expect(page.locator('#objective-primary')).toHaveText('○ Use CALL to start the transfer', {
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  await order(4.8, 16);
  await expect(page.locator('#courier-status')).toContainText('moving to inspection', {
    timeout: 8_000,
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const clock = await page.locator('#clock').textContent();
  await page.waitForTimeout(1100);
  await expect(page.locator('#clock')).toHaveText(clock!);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#mission-title')).toHaveText('Adverse possession');
  await expect(page.locator('#courier-status')).toHaveText('Courier: awaiting CALL · east route');
  await expect(page.locator('#condition-0')).toHaveText('Concealed');
  await expect(page.locator('#selected-count')).toHaveText('4 / 4');
  expect(errors).toEqual([]);
});

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
  // A short drag over Morrow's upper body must deliberately isolate him,
  // even though the visible box excludes his foot point entirely.
  await page.mouse.move(morrow.x - 5, morrow.y - 20 * scale);
  await page.mouse.down();
  await page.mouse.move(morrow.x + 5, morrow.y - 14 * scale, { steps: 3 });
  await expect(page.locator('#selection-box')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('#selected-count')).toHaveText('1 / 4');
  await expect(page.locator('#selected-name')).toHaveText('Morrow');
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
