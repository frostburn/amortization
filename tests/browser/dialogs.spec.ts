import { expect, test } from '@playwright/test';

for (const touch of [false, true]) {
  test(`backdrop dismissal: ${touch ? 'touch' : 'desktop'} keeps the game paused and closes only the top dialog`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 960 },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    const click = (x: number, y: number) =>
      touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y);
    await page.goto('/');
    const briefing = page.locator('#mission-dialog');
    await expect(briefing).toBeVisible();
    const bounds = (await briefing.boundingBox())!;
    // Empty padding belongs to the dialog; selecting text out of it is not a dismissal.
    await click(bounds.x + 5, bounds.y + 10);
    await expect(briefing).toBeVisible();
    if (!touch) {
      await page.mouse.move(bounds.x + 50, bounds.y + 50);
      await page.mouse.down();
      await page.mouse.move(8, 8);
      await page.mouse.up();
      await expect(briefing).toBeVisible();
      await page.mouse.click(8, 8, { button: 'right' });
      await expect(briefing).toBeVisible();
    }
    await click(8, 8);
    await expect(briefing).toBeHidden();
    await expect(page.locator('#pause-label')).toHaveText('Resume');
    await expect(page.locator('#clock')).toHaveText('00:00');
    await page.getByRole('button', { name: 'Operations', exact: true }).click();
    await expect(briefing).toContainText('CONTRACT DESK');
    await click(8, 8);
    await expect(briefing).toBeHidden();
    await page.getByRole('button', { name: 'Briefing', exact: true }).click();

    // Dev tools stack over the briefing; one click must not dismiss both layers.
    await briefing.getByRole('button', { name: 'Import replay', exact: true }).click();
    const viewer = page.getByRole('dialog', { name: 'Replay viewer', exact: true });
    await expect(viewer).toBeVisible();
    await click(8, 8);
    await expect(viewer).toBeHidden();
    await expect(briefing).toBeVisible();
    await expect(
      briefing.getByRole('button', { name: 'Import replay', exact: true }),
    ).toBeFocused();
    await briefing.getByRole('button', { name: 'Export attempt', exact: true }).click();
    const exporter = page.getByRole('dialog', { name: 'Export attempt', exact: true });
    await exporter
      .getByLabel('Player note', { exact: false })
      .fill('Keep this note when clicking outside.');
    await click(8, 8);
    await expect(exporter).toBeHidden();
    await expect(briefing).toBeVisible();
    await briefing.getByRole('button', { name: 'Export attempt', exact: true }).click();
    await expect(exporter.getByLabel('Player note', { exact: false })).toHaveValue(
      'Keep this note when clicking outside.',
    );
    await expect(exporter.locator('#playtest-summary')).toContainText('0 orders · 0:00 mission');
    await click(8, 8);
    await click(8, 8);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(page.locator('#pause-label')).toHaveText('Resume');
    await expect(page.locator('#clock')).toHaveText('00:00');
    await context.close();
  });
}
