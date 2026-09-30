import { expect, test } from '@playwright/test';
import type { World } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';

declare global {
  interface Window {
    incomingWorld: World;
    incomingScene: Scene;
  }
}

// Browser plugin not available. Exercise the actual replay import and transport,
// then inspect the corrected shield retreat with its normal renderer.
for (const touch of [false, true]) {
  test(`unheard fire: ${touch ? 'touch' : 'desktop'} replay shows a shield officer retreating toward cover`, async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      hasTouch: touch,
      isMobile: touch,
      deviceScaleFactor: touch ? 2 : 1,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    const press = (name: string) => {
      const button = page.getByRole('button', { name, exact: true });
      return touch ? button.tap() : button.click();
    };
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route(/\/src\/sim\/world\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/sim/world.ts?original'; import { createWorld as original } from '/src/sim/world.ts?original'; export function createWorld(m) { return window.incomingWorld = original(m); }`,
      }),
    );
    await page.route(/\/src\/render\/scene\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/render/scene.ts?original'; import { Scene as Original } from '/src/render/scene.ts?original'; export class Scene extends Original { constructor(...args) { super(...args); window.incomingScene = this; } }`,
      }),
    );
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await expect(page.getByRole('button', { name: /Begin operation/ })).toBeVisible();
    const briefing = page.getByRole('dialog', { name: 'The release clause', exact: true });
    const opener = briefing.getByRole('button', { name: 'Import replay', exact: true });
    await (touch ? opener.tap() : opener.click());
    await page
      .getByLabel('Import a replay bundle')
      .setInputFiles('tests/fixtures/countermand-range-7458f5ab.replay.json');
    await expect(page.locator('#playtest-viewer-feedback')).toContainText('Imported');
    await press('Try current rules');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'day');
    await page.getByLabel('Replay speed').selectOption('4');
    await press('Play replay');
    await page.waitForFunction(
      () => {
        const g = window.incomingWorld.guards[0];
        return g.incoming && Math.hypot(g.x - 20, g.y - 32) > 1;
      },
      undefined,
      { timeout: 20_000 },
    );
    await press('Pause replay');
    const reaction = await page.evaluate(() => {
      const g = window.incomingWorld.guards[0];
      return { hp: g.hp, mode: g.mode, source: g.incoming?.source, x: g.x, y: g.y };
    });
    expect(reaction.hp).toBeGreaterThan(0);
    expect(reaction.hp).toBeLessThan(90);
    expect(reaction.mode).toBe('combat');
    expect(reaction.source).toBeDefined();
    expect(Math.hypot(reaction.x - 20, reaction.y - 32)).toBeGreaterThan(0.1);
    await page.locator('#stage').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const s = window.incomingScene,
        w = window.incomingWorld,
        g = w.guards[0];
      s.home();
      s.zoomBy(2.4 / s.camera.scale.x);
      const centre = s.screen({ x: g.x, y: g.y });
      s.panBy(s.app.screen.width / 2 - centre.x, s.app.screen.height / 2 - centre.y + 35);
      s.render(
        w.agents.map((a) => a.id),
        1,
      );
      s.app.render();
    });
    await page.screenshot({
      path: `${process.env.AMORTIZATION_QA_DIR ?? '/tmp'}/incoming-fire-${touch ? 'touch' : 'desktop'}.png`,
    });
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await context.close();
  });
}
