import { expect, test } from '@playwright/test';
import type { World } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';
import type { Hud } from '../../src/ui/hud';
import type { Action } from '../../src/input/actions';

declare global {
  interface Window {
    mandateTest: { world: World; scene: Scene; hud: Hud; advance: (ticks: number) => void };
  }
}

for (const mobile of [false, true]) {
  test(`operation eight: ${mobile ? 'touch' : 'desktop'} security guidance, inspection and permanent isolation`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const press = async (selector: string) => {
      const button = page.locator(selector);
      if (mobile) await button.tap();
      else await button.click();
    };
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await press('dialog [data-action="operations"]');
    await press('[data-action="mission:mandate"]');
    await expect(page.locator('#mission-dialog')).toContainText('Borrow their authority');
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#mission-title')).toHaveText('Adverse selection');
    await expect(page.locator('#security-status')).toContainText('4 / 4 turrets live');
    await expect(page.locator('#authorise-button')).toBeDisabled();
    await expect(page.locator('#authorise-status')).toContainText('KIT');
    await expect(page.locator('#objective-extract')).toContainText('Collect MANDATE');
    await press('#objective-primary');
    await expect(page.locator('#guide-detail')).toContainText(
      'RADIO stops human reinforcements only',
    );
    for (const tag of ['WEST', 'EAST', 'INSPECT'])
      await expect(page.locator('#guide-locations')).toContainText(tag);
    await press('[data-dismiss-guide]');
    await press('[data-action="home"]');
    await page.locator('#stage').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `/tmp/amortization-mission-eight/${mobile ? 'phone' : 'desktop'}-overview.png`,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (!mobile) {
      const bounds = await page.locator('.mission-section').boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThan(800);
    }

    // Fixture advances the real fixed-step simulation without real-time browser waits.
    // Unmodified, live-patrol completions and exact replay checkpoints live in mandate.test.ts.
    await page.route('**/mandate-fixture', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Amortization / security fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
      }),
    );
    await page.goto('/mandate-fixture');
    await page.evaluate(async () => {
      const paths = [
        '/src/content/mandate.ts',
        '/src/sim/world.ts',
        '/src/sim/step.ts',
        '/src/sim/commands.ts',
        '/src/ui/hud.ts',
        '/src/render/scene.ts',
      ];
      const [{ mandate }, { createWorld }, { step }, { applyCommand }, { Hud }, { Scene }] =
        await Promise.all(paths.map((p) => import(p)));
      const world = createWorld(mandate) as World;
      const a = world.agents[0];
      Object.assign(a, { x: 12.7, y: 27, previous: { x: 12.7, y: 27 }, disguised: true });
      world.disguiseTaken = true;
      let selected = [a.id];
      const draw = () => {
        scene.render(selected, 1);
        hud.update(world, {
          selected,
          paused: true,
          slow: false,
          sound: false,
          best: null,
          following: scene.following,
        });
      };
      const action = (action: Action) => {
        if (
          action === 'security:authorise' ||
          action === 'security:power-west' ||
          action === 'security:power-east'
        )
          applyCommand(world, { kind: 'interact', agents: selected, target: action.slice(9) });
        if (action === 'home') scene.home();
        if (action === 'follow') scene.follow(selected, true);
        draw();
      };
      const hud = new Hud(
        action,
        (index: number) => {
          selected = [world.agents[index].id];
          draw();
        },
        (
          targets: Parameters<Scene['showGuidance']>[0],
          focus: boolean,
          panel: Parameters<Scene['showGuidance']>[1],
        ) => {
          scene.showGuidance(targets, panel);
          if (focus) scene.focusGuidance();
        },
      );
      const scene = new Scene(hud.stage, world);
      hud.reset(mandate);
      await scene.init();
      scene.app.ticker.add(() => scene.render(selected, 1));
      const advance = (ticks: number) => {
        for (let i = 0; i < ticks; i++) step(world);
        draw();
      };
      window.mandateTest = { world, scene, hud, advance };
      draw();
    });
    await expect(page.locator('#authorise-button')).toBeEnabled();
    await page.locator('#stage').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `/tmp/amortization-mission-eight/${mobile ? 'phone' : 'desktop'}-sentries.png`,
    });
    await press('#authorise-button');
    expect(await page.evaluate(() => window.mandateTest.world.agents[0].order)).toEqual({
      kind: 'interact',
      target: 'authorise',
    });
    await page.evaluate(() => window.mandateTest.advance(80));
    await expect(page.locator('#security-status')).toContainText('guns stopped');
    await expect(page.locator('#authorise-button')).toBeDisabled();
    await press('#power-west-button');
    await page.evaluate(() => window.mandateTest.advance(300));
    await expect(page.locator('#power-west-button')).toHaveText('✓ WEST · offline');
    await expect(page.locator('#power-west-button')).toBeDisabled();
    await page.evaluate(() => window.mandateTest.advance(700));
    await expect(page.locator('#security-status')).toHaveText(
      '2 / 4 turrets live · RADIO has no effect',
    );
    await expect(page.locator('#authorise-button')).toBeDisabled();
    await expect(page.locator('#power-east-button')).toBeEnabled();
    await press('#power-east-button');
    expect(await page.evaluate(() => window.mandateTest.world.agents[0].order)).toEqual({
      kind: 'interact',
      target: 'power-east',
    });
    await page.evaluate(() => window.mandateTest.advance(650));
    await expect(page.locator('#security-status')).toHaveText(
      '0 / 4 turrets live · RADIO has no effect',
    );
    await expect(page.locator('#objective-primary')).toContainText('Sentry circuits neutralised');
    await expect(page.locator('#objective-extract')).toContainText('Collect MANDATE');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `/tmp/amortization-mission-eight/${mobile ? 'phone' : 'desktop'}-isolated.png`,
    });
    await context.close();
  });
}
