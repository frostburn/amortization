import { test, expect } from '@playwright/test';
import type { World, ObjectKind } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';
import type { Command } from '../../src/sim/commands';

declare global {
  interface Window {
    personnelTest: {
      world: World;
      scene: Scene;
      send: (c: Command) => void;
      advance: (ticks: number) => void;
    };
  }
}

for (const mobile of [false, true]) {
  test(`Key personnel: ${mobile ? 'touch' : 'desktop'} gates, captivity, release and extraction`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const press = async (selector: string) => {
      if (mobile) await page.locator(selector).tap();
      else await page.locator(selector).click();
    };
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await press('dialog [data-action="operations"]');
    await press('[data-action="mission:personnel"]');
    await expect(page.locator('#mission-dialog')).toContainText('The mandate stays with Mara');
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#mission-title')).toHaveText('Key personnel');
    await expect(page.locator('[data-agent="1"]')).toBeDisabled();
    await expect(page.locator('[data-agent="2"]')).toBeDisabled();
    await expect(page.locator('#condition-1')).toContainText('Captive');
    await press('[data-action="all"]');
    await expect(page.locator('#selected-count')).toHaveText('2 / 4');
    await page.keyboard.press('2');
    await expect(page.locator('#selected-count')).toHaveText('2 / 4');
    await press('#objective-primary');
    await expect(page.locator('#guide-detail')).toContainText('different operative');
    await expect(page.locator('#guide-locations')).toContainText('VALE');
    await press('[data-dismiss-guide]');
    await press('[data-agent="3"]');
    await press('#intake-button');
    await press('[data-action="pause"]');
    await expect(page.locator('#detention-status')).toContainText('Sable holds INTAKE', {
      timeout: 10000,
    });
    await press('[data-agent="0"]');
    await press('#cells-button');
    await expect(page.locator('#detention-status')).toContainText('Sable holds CELLS');
    await expect(page.locator('#selected-name')).toHaveText('Morrow');
    await press('[data-action="pause"]');
    await press('[data-action="home"]');
    await page.locator('#stage').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `/tmp/key-personnel/${mobile ? 'touch' : 'desktop'}-overview.png`,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    // The real HUD/renderer/input with deterministic stepping. Full live-patrol
    // completion and replay checks belong to personnel.test.ts.
    await page.route('**/personnel-fixture', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Amortization / detention fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
      }),
    );
    await page.goto('/personnel-fixture');
    await page.evaluate(async () => {
      const paths = [
        '/src/content/personnel.ts',
        '/src/sim/world.ts',
        '/src/sim/step.ts',
        '/src/sim/commands.ts',
        '/src/ui/hud.ts',
        '/src/render/scene.ts',
        '/src/input/controls.ts',
        '/src/sim/types.ts',
      ];
      const [
        { personnel },
        { createWorld },
        { step },
        { applyCommand },
        { Hud },
        { Scene },
        { bindControls },
        { controllable },
      ] = await Promise.all(paths.map((p) => import(p)));
      const world = createWorld(personnel) as World;
      // Only fixture patrols are removed; this is a control/selection test.
      world.guards = [];
      let selected = ['agent-3'];
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
      const send = (c: Command) => {
        applyCommand(world, c);
        draw();
      };
      const action = (id: string) => {
        if (id.startsWith('detention:')) {
          const target = id.slice(10) as ObjectKind;
          send({
            kind: 'interact',
            agents:
              target.startsWith('access-') && world.detention!.operator
                ? [world.detention!.operator!]
                : selected,
            target,
          });
        }
        if (id === 'all') selected = world.agents.filter(controllable).map((a) => a.id);
        if (id === 'home') scene.home();
        if (id === 'hold') send({ kind: 'hold', agents: selected });
        if (id === 'extract:extract')
          send({
            kind: 'interact',
            agents: world.agents.filter(controllable).map((a) => a.id),
            target: 'extract',
          });
        draw();
      };
      const hud = new Hud(
        action,
        (index: number) => {
          if (controllable(world.agents[index])) selected = [world.agents[index].id];
          draw();
        },
        (targets: unknown, focus: boolean, panel: unknown) => {
          scene.showGuidance(targets, panel);
          if (focus) scene.focusGuidance();
        },
      );
      const scene = new Scene(hud.stage, world);
      hud.reset(personnel);
      await scene.init();
      bindControls(scene, hud, {
        world: () => world,
        selection: () => selected,
        select: (ids: string[]) => {
          const active = ids.filter((id) =>
            world.agents.some((a) => a.id === id && controllable(a)),
          );
          if (active.length) selected = active;
          draw();
        },
        action,
        slow: () => {},
        order: (hit: { kind: string; id: ObjectKind }) => {
          if (hit.kind === 'object') send({ kind: 'interact', agents: selected, target: hit.id });
        },
      });
      scene.app.ticker.add(() => scene.render(selected, 1));
      const advance = (ticks: number) => {
        for (let i = 0; i < ticks; i++) step(world);
        draw();
      };
      window.personnelTest = { world, scene, send, advance };
      draw();
    });
    await press('#intake-button');
    await page.evaluate(() => window.personnelTest.advance(130));
    await expect(page.locator('#detention-status')).toContainText('Sable holds INTAKE');
    await page.evaluate(() => {
      const f = window.personnelTest;
      f.send({ kind: 'move', agents: ['agent-0'], point: { x: 18, y: 26.5 } });
      f.advance(130);
    });
    await press('[data-agent="0"]');
    await press('#cells-button');
    await page.evaluate(() => window.personnelTest.advance(70));
    await expect(page.locator('#detention-status')).toContainText('Sable holds CELLS');
    await page.evaluate(() => {
      const f = window.personnelTest;
      f.send({ kind: 'move', agents: ['agent-0'], point: { x: 32, y: 12 } });
      f.advance(400);
      f.scene.showGuidance(['rescue-vale'], { x: 0, y: 0, w: 0, h: 0 });
      f.scene.focusGuidance();
    });
    await page.locator('#stage').scrollIntoViewIfNeeded();
    const marker = await page.evaluate(() =>
      window.personnelTest.scene.markerScreen('rescue-vale')!,
    );
    const canvas = page.locator('canvas'),
      bounds = (await canvas.boundingBox())!;
    if (mobile) await page.touchscreen.tap(bounds.x + marker.x, bounds.y + marker.y);
    else await page.mouse.click(bounds.x + marker.x, bounds.y + marker.y, { button: 'right' });
    expect(await page.evaluate(() => window.personnelTest.world.agents[0].order)).toEqual({
      kind: 'interact',
      target: 'rescue-vale',
    });
    await page.evaluate(() => window.personnelTest.advance(100));
    await expect(page.locator('[data-agent="1"]')).toBeEnabled();
    await expect(page.locator('#condition-1')).toContainText('Unarmed');
    await expect(page.locator('#objective-primary')).toContainText('1 / 2 free');
    await press('[data-agent="1"]');
    await expect(page.locator('[data-action="weapons"]')).toBeDisabled();
    await page.evaluate(() => {
      const f = window.personnelTest;
      f.send({ kind: 'interact', agents: ['agent-1'], target: 'equipment' });
      f.advance(260);
    });
    await expect(page.locator('[data-action="weapons"]')).toBeEnabled();
    await press('[data-agent="0"]');
    await page.evaluate(() => {
      const f = window.personnelTest;
      f.send({ kind: 'interact', agents: ['agent-0'], target: 'rescue-rook' });
      f.advance(230);
    });
    await expect(page.locator('[data-agent="2"]')).toBeEnabled();
    await expect(page.locator('#objective-extract')).toContainText('Release EXIT');
    await press('#release-exit-button');
    await page.evaluate(() => window.personnelTest.advance(100));
    await expect(page.locator('#detention-status')).toContainText('Both gates released');
    await expect(page.locator('#exit-button-extract')).toBeVisible();
    await expect(page.locator('#exit-button-extract')).toBeEnabled();
    await press('#objective-primary');
    await page.screenshot({
      path: `/tmp/key-personnel/${mobile ? 'touch' : 'desktop'}-rescued.png`,
    });
    await press('[data-dismiss-guide]');
    await press('#exit-button-extract');
    await page.evaluate(() => window.personnelTest.advance(900));
    expect(await page.evaluate(() => window.personnelTest.world.status)).toBe('won');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
