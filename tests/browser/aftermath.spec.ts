import { expect, test } from '@playwright/test';
import type { World } from '../../src/sim/types';

declare global {
  interface Window {
    aftermathWorld: World;
  }
}

for (const touch of [false, true]) {
  test(`mission aftermath: ${touch ? 'touch' : 'desktop'} departure, defeat and restarts`, async ({
    browser,
  }) => {
    test.setTimeout(45_000);
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 960 },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    // Expose the real live world through a test-only module wrapper. The actual
    // main loop, recording, input, HUD, renderer and persistence remain in charge.
    await page.route(/\/src\/sim\/world\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/sim/world.ts?aftermath-original';
        import { createWorld as realWorld } from '/src/sim/world.ts?aftermath-original';
        export function createWorld(mission) {
          const world = realWorld(mission);
          window.aftermathWorld = world;
          return world;
        }`,
      }),
    );
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    const dialog = page.locator('#mission-dialog'),
      stage = page.locator('#stage');
    await expect(
      dialog.getByRole('button', { name: 'Restart mission', exact: true }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Begin operation' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(async () => {
      const path = '/src/sim/orders.ts';
      const { interact, landmark } = await import(path);
      const w = window.aftermathWorld;
      w.guards.forEach((g) => {
        g.hp = 0;
      });
      w.escort!.recruited = true;
      w.escort!.leader = w.agents[0].id;
      w.evidence = 'carried';
      w.agents[3].carrying = true;
      const van = landmark(w, 'extract');
      for (const p of [...w.agents, w.escort!]) Object.assign(p, { x: van.x, y: van.y });
      interact(
        w,
        w.agents.map((a) => a.id),
        'extract',
      );
    });
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(dialog).toContainText('Account settled.');
    await expect(
      dialog.getByRole('button', { name: 'Restart mission', exact: true }),
    ).toBeVisible();
    const before = await page.evaluate(() => ({
      world: JSON.stringify(window.aftermathWorld),
      records: localStorage.getItem('amortization.records.v4'),
      replay: localStorage.getItem('amortization.playtests.v1'),
    }));
    const close = () => (touch ? page.touchscreen.tap(8, 8) : page.mouse.click(8, 8));
    await close();
    await expect(
      page.getByRole('heading', { name: 'MISSION COMPLETE', exact: true }),
    ).toBeVisible();
    await expect(page.locator('#pause-button')).toBeHidden();
    await expect(page.locator('.orders-section')).toBeHidden();
    await expect(page.locator('#condition-0')).toHaveText('Extracted');
    await expect(stage).toHaveAttribute('data-aftermath', /boarding|departing/);
    await page.screenshot({
      path: `/tmp/amortization-departure-${touch ? 'touch' : 'desktop'}.png`,
    });
    await expect(stage).toHaveAttribute('data-aftermath', 'departed', { timeout: 12_000 });
    await page.keyboard.press('e');
    await page.keyboard.press('f');
    expect(
      await page.evaluate(() => ({
        world: JSON.stringify(window.aftermathWorld),
        records: localStorage.getItem('amortization.records.v4'),
        replay: localStorage.getItem('amortization.playtests.v1'),
      })),
    ).toEqual(before);
    await page.getByRole('button', { name: 'View results', exact: true }).click();
    await expect(dialog).toContainText('Account settled.');
    await dialog.getByRole('button', { name: 'Restart mission', exact: true }).click();
    await expect(page.locator('#mission-outcome')).toBeHidden();
    await expect(stage).not.toHaveAttribute('data-aftermath');
    expect(await page.evaluate(() => window.aftermathWorld.status)).toBe('playing');

    // Restart an unfinished run from the briefing; Shift+R also works there.
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(() => {
      window.aftermathWorld.time = 70;
      window.aftermathWorld.agents[0].hp = 20;
    });
    await page.getByRole('button', { name: 'Briefing', exact: true }).click();
    if (touch) await dialog.getByRole('button', { name: 'Restart mission', exact: true }).tap();
    else await page.keyboard.press('Shift+R');
    await expect(dialog).toBeHidden();
    expect(
      await page.evaluate(() => ({
        time: window.aftermathWorld.time,
        hp: window.aftermathWorld.agents[0].hp,
      })),
    ).toEqual({ time: expect.any(Number), hp: 100 });
    expect(await page.evaluate(() => window.aftermathWorld.time)).toBeLessThan(2);

    // A real failed step must leave a moving scene, not an unresumable pause UI.
    await page.evaluate(() => {
      window.aftermathWorld.agents.forEach((a) => {
        a.hp = 0;
      });
    });
    await expect(dialog).toContainText('The balance is due.');
    const failed = await page.evaluate(() => JSON.stringify(window.aftermathWorld));
    await close();
    await expect(page.getByRole('heading', { name: 'MISSION FAILED', exact: true })).toBeVisible();
    await expect(stage).toHaveAttribute('data-aftermath', 'failed');
    const frame = await page.locator('canvas').screenshot();
    await expect
      .poll(async () => !(await page.locator('canvas').screenshot()).equals(frame))
      .toBe(true);
    await page.keyboard.press('e');
    await page.keyboard.press('f');
    expect(await page.evaluate(() => JSON.stringify(window.aftermathWorld))).toBe(failed);
    await page.screenshot({ path: `/tmp/amortization-failure-${touch ? 'touch' : 'desktop'}.png` });
    await page.getByRole('button', { name: 'Restart mission', exact: true }).click();
    await expect(page.locator('#mission-outcome')).toBeHidden();
    await expect(page.locator('.orders-section')).toBeVisible();

    // The closed archive exposes the existing inside-CUT recovery action.
    await page.getByRole('button', { name: 'Operations', exact: true }).click();
    await page.locator('[data-action="mission:archive"]').click();
    await dialog.getByRole('button', { name: 'Begin operation' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.evaluate(() => {
      const w = window.aftermathWorld;
      w.shutterOpen = false;
      w.overrideBy = null;
      w.agents[0].hp = w.agents[3].hp = 0;
      Object.assign(w.agents[1], { x: 25.86, y: 8.12 });
      Object.assign(w.agents[2], { x: 26.26, y: 8.12, carrying: true });
      w.evidence = 'carried';
    });
    await expect(page.locator('#archive-escape')).toContainText('CUT works from inside');
    await page.getByRole('button', { name: 'Send selected to CUT · 8s', exact: true }).click();
    expect(await page.evaluate(() => window.aftermathWorld.agents[1].order)).toEqual({
      kind: 'interact',
      target: 'breach',
    });
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await context.close();
  });
}
