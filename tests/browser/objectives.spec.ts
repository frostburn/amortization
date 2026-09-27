import { expect, test } from '@playwright/test';

test('previews, pins and refocuses goals without changing a queued squad order', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  const map = (await page.locator('canvas').boundingBox())!;
  const scale = Math.min(map.width / (58 * 26 + 80), map.height / (58 * 14 + 110));
  await page.mouse.click(
    map.x + map.width / 2 + ((6.5 - 24) * 26 - 3 * 26) * scale,
    map.y + map.height / 2 + ((6.5 + 24) * 14 - 29 * 14 + 25) * scale,
    { button: 'right' },
  );
  await expect(page.locator('#condition-0')).toHaveText('Moving');
  await page.locator('#objective-primary').hover();
  await expect(page.locator('#objective-guide')).toBeVisible();
  await expect(page.locator('#guide-detail')).toContainText('Interact with VOSS');
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-description',
    'Highlighted mission items: VOSS, KIT.',
  );
  const previewPosition = await page
    .locator('[data-target="escort"]')
    .evaluate((el) => el.getBoundingClientRect().x);
  // Preview leaves the camera at its original fit position.
  const vossX = map.x + map.width / 2 + ((26.4 - 6.4) * 26 - 3 * 26) * scale;
  expect(previewPosition).toBeCloseTo(vossX, 0);
  await page.mouse.move(map.x + 20, map.y + map.height - 20);
  await expect(page.locator('#objective-guide')).toBeHidden();
  await expect(page.locator('.objective-locator')).toHaveCount(0);
  await page.locator('#objective-primary').click();
  await page.getByRole('button', { name: 'Locate VOSS', exact: true }).click();
  await expect(page.locator('.objective-locator')).toHaveCount(1);
  await expect(page.locator('[data-target="escort"]')).not.toHaveClass(/is-offscreen/);
  await page.locator('canvas').focus();
  for (let i = 0; i < 18; i++) await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-target="escort"]')).toHaveClass(/is-offscreen/);
  await page.getByRole('button', { name: 'Locate VOSS', exact: true }).click();
  await expect(page.locator('[data-target="escort"]')).not.toHaveClass(/is-offscreen/);
  await expect(page.locator('#selected-count')).toHaveText('1 / 4');
  await expect(page.locator('#condition-0')).toHaveText('Moving');
  await expect(page.locator('#pause-label')).toHaveText('Resume');
  await page.keyboard.press('Escape');
  await expect(page.locator('#objective-guide')).toBeHidden();
  await page.keyboard.press('?');
  await expect(page.locator('#objective-primary')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#objective-evidence')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Locate UNIT', exact: true })).toBeFocused();
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-description',
    'Highlighted mission items: UNIT.',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toBeFocused();
  await page.keyboard.press('?');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Locate VOSS', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Locate KIT', exact: true })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('.objective-locator')).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-description',
    'Highlighted mission items: KIT.',
  );
  await expect(page.locator('#pause-label')).toHaveText('Resume');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#objective-guide')).toBeHidden();
  await expect(page.locator('.objective-locator')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('touch goals reveal the map, explain alternatives, and keep the highlighted diamond actionable', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Choose operation' }).tap();
  await page.getByRole('button', { name: /04 .*Protective custody/ }).tap();
  await page.getByRole('button', { name: 'Begin operation' }).tap();
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await page.getByRole('button', { name: 'Select Sable', exact: true }).tap();
  await page.locator('#objective-primary').tap();
  await expect(page.locator('#objective-guide')).toBeInViewport();
  await expect(page.locator('#guide-detail')).toContainText('Quiet: take KIT');
  await expect(page.locator('#guide-detail')).toContainText('Loud: CUT');
  await expect(page.locator('.objective-locator')).toHaveCount(3);
  await page.getByRole('button', { name: 'Locate CUT', exact: true }).tap();
  await expect(page.locator('.objective-locator')).toHaveCount(1);
  const marker = page.locator('[data-target="breach"]');
  await expect(marker).not.toHaveClass(/is-offscreen/);
  await expect(page.locator('#selected-name')).toHaveText('Sable');
  await expect(page.locator('#condition-3')).toHaveText('Concealed');
  const point = await marker.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y };
  });
  await page.touchscreen.tap(point.x, point.y);
  await expect(page.locator('#condition-3')).toHaveText('Moving');
  await expect(page.locator('#selected-count')).toHaveText('1 / 4');
  await page.getByRole('button', { name: 'Close mission guide' }).tap();
  await expect(page.locator('#objective-guide')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(errors).toEqual([]);
  await context.close();
});
