import { expect, test, type Locator } from '@playwright/test';

for (const touch of [false, true]) {
  test(`compact briefing: ${touch ? 'touch' : 'desktop'} keeps launch visible and advice opt-in`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(45_000);
    const viewport = touch ? { width: 390, height: 844 } : { width: 1280, height: 720 };
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const press = (locator: Locator) => (touch ? locator.tap() : locator.click());
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    const dialog = page.locator('#mission-dialog');
    const advice = dialog.locator('.briefing-advice');
    const scroller = dialog.getByRole('region', { name: 'Briefing details' });
    const begin = dialog.getByRole('button', { name: 'Begin operation' });
    const bounds = async () => {
      const rect = (await dialog.boundingBox())!;
      const size = page.viewportSize()!;
      expect(rect.width).toBeLessThanOrEqual(640);
      expect(rect.height).toBeLessThanOrEqual(Math.min(660, size.height - 32));
      expect(rect.y).toBeGreaterThanOrEqual(15);
      expect(rect.y + rect.height).toBeLessThanOrEqual(size.height - 15);
      expect(await dialog.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
      expect(await scroller.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await expect(begin).toBeInViewport({ ratio: 1 });
    };
    await expect(begin).toBeFocused();
    await expect(dialog.locator('.briefing-orders')).toContainText('Iona Voss');
    await expect(dialog.locator('.briefing-routes')).toBeHidden();
    await bounds();
    await page.screenshot({ path: testInfo.outputPath('first-briefing.png') });
    await press(dialog.getByText('Equipment & controls', { exact: true }));
    await expect(dialog.locator('[data-loadout]')).toContainText(
      'eight-unit range and need no reloads',
    );
    await expect(dialog.locator('[data-loadout]')).not.toContainText('Reloads are automatic');
    const ids = [
      'archive',
      'transfer',
      'custody',
      'broadcast',
      'severance',
      'clearing',
      'mandate',
      'personnel',
      'injunction',
    ];
    for (const id of ids) {
      await press(dialog.getByRole('button', { name: 'Choose operation' }));
      await press(dialog.locator(`[data-action="mission:${id}"]`));
      await expect(dialog).toHaveClass(/briefing-dialog/);
      await expect(dialog.locator('.briefing-routes')).toBeHidden();
      await expect(scroller).not.toBeEmpty();
      await bounds();
      if (id === 'personnel') {
        await expect(dialog.locator('.briefing-rules')).toContainText(
          'Any operative’s death fails',
        );
        await press(dialog.getByText('Equipment & controls', { exact: true }));
        for (const name of ['Vale', 'Rook'])
          await expect(
            dialog.locator('.briefing-loadout > div').filter({ hasText: name }),
          ).toContainText('Detained · unarmed');
        await expect(dialog.locator('[data-loadout]')).toContainText(
          'Morrow and Sable each start with one field dressing',
        );
        await expect(dialog.locator('[data-loadout]')).toContainText(
          'Detained operatives recover their dressings at GEAR',
        );
      }
    }
    await expect(begin).toBeFocused();
    await expect(dialog.locator('.briefing-orders')).toContainText('20s of work');
    await page.screenshot({ path: testInfo.outputPath('tenth-briefing.png') });
    const reveal = advice.locator('summary');
    await reveal.focus();
    await expect(dialog.locator('.briefing-routes')).toBeHidden(); // Focus alone must not reveal advice.
    if (touch) await reveal.tap();
    else await page.keyboard.press('Enter');
    await expect(dialog.locator('.briefing-routes')).toBeVisible();
    await expect(dialog.locator('.briefing-routes')).toContainText('Past the credentials desk');
    if (!touch) await expect(reveal).toBeFocused();
    expect(await scroller.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    const launchBefore = (await begin.boundingBox())!;
    await scroller.evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await expect(dialog.getByRole('heading', { name: 'If fighting breaks out' })).toBeInViewport();
    expect((await begin.boundingBox())!.y).toBe(launchBefore.y);
    await bounds();
    await page.screenshot({ path: testInfo.outputPath('advice-scrolled.png') });
    // Reopening and changing mission both reset the opt-in, without leaving
    // the reader at an old scroll offset or inheriting an Operations layout.
    await press(begin);
    await expect(dialog).toBeHidden();
    await expect(page.locator('#message')).toContainText('Serve the restitution mandate');
    await expect(page.locator('#message')).not.toContainText('LOOP');
    await page.getByRole('button', { name: 'Briefing', exact: true }).click();
    await expect(dialog.locator('.briefing-routes')).toBeHidden();
    expect(await scroller.evaluate((e) => e.scrollTop)).toBe(0);
    await expect(begin).toBeFocused();
    await page.setViewportSize(touch ? { width: 320, height: 568 } : { width: 844, height: 390 });
    await bounds();
    await press(reveal);
    await bounds();
    await page.screenshot({ path: testInfo.outputPath('short-viewport.png') });
    await press(dialog.getByRole('button', { name: 'Restart mission' }));
    await expect(dialog).toBeHidden();
    await expect(page.locator('#clock')).toHaveText('00:00');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
