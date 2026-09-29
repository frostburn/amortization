import { test, expect } from '@playwright/test';
import type { World, Vec } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';
import type { Command } from '../../src/sim/commands';

declare global {
  interface Window {
    injunctionTest: {
      world: World;
      scene: Scene;
      commands: Command[];
      advance: (ticks: number) => void;
    };
  }
}

for (const mobile of [false, true]) {
  test(`Stay of execution: ${mobile ? 'touch' : 'desktop'} objectives, one-throw targeting and recovery`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
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
    await press('[data-action="mission:injunction"]');
    await expect(page.locator('#mission-dialog')).toContainText(
      'RADIO is deep inside a secure office',
    );
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#mission-title')).toHaveText('Stay of execution');
    await expect(page.locator('#flash-button')).toHaveText('Flash · 2 left · B');
    await press('#objective-primary');
    await expect(page.locator('#guide-detail')).toContainText('2.5-second check');
    await expect(page.locator('#guide-locations')).toContainText('RADIO');
    await press('[data-dismiss-guide]');
    await press('[data-action="home"]');
    await page.locator('#stage').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/mission-10/${mobile ? 'touch' : 'desktop'}-overview.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (!mobile) {
      await page.setViewportSize({ width: 1280, height: 720 });
      const sidebar = page.locator('.crew-sidebar');
      expect(await sidebar.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
      await expect(page.locator('#flash-button')).toBeInViewport();
      await expect(page.locator('#drop-button')).toBeInViewport();
      await page.screenshot({ path: '/tmp/mission-10/desktop-compact.png' });
      await page.setViewportSize({ width: 1440, height: 960 });
    }

    // Paused, stepped presentation fixture. Live-patrol completions and exact
    // command replays run separately in injunction.test.ts.
    await page.route('**/injunction-fixture', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Amortization / flash fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
      }),
    );
    await page.goto('/injunction-fixture');
    await page.evaluate(async () => {
      const paths = [
        '/src/content/injunction.ts',
        '/src/sim/world.ts',
        '/src/sim/step.ts',
        '/src/sim/commands.ts',
        '/src/ui/hud.ts',
        '/src/render/scene.ts',
        '/src/input/controls.ts',
        '/src/ui/flash-aim.ts',
      ];
      const [
        { injunction },
        { createWorld },
        { step },
        { applyCommand },
        { Hud },
        { Scene },
        { bindControls },
        { FlashAim },
      ] = await Promise.all(paths.map((p) => import(p)));
      const world = createWorld(injunction) as World,
        commands: Command[] = [];
      const points = [
        { x: 38.5, y: 25 },
        { x: 33, y: 25 },
        { x: 33.5, y: 24 },
        { x: 34, y: 25.5 },
      ];
      world.agents.forEach((a, i) => Object.assign(a, points[i], { previous: { ...points[i] } }));
      const inspector = world.guards[5];
      Object.assign(inspector, {
        x: 38.3,
        y: 23.5,
        previous: { x: 38.3, y: 23.5 },
        patrol: [{ x: 38.3, y: 23.5 }],
        angle: Math.PI,
      });
      world.guards = [inspector];
      let selected = world.agents.map((a) => a.id);
      const draw = () => {
        scene.render(selected, 1);
        hud.update(world, { selected, paused: true, slow: false, sound: false, best: null });
      };
      const send = (c: Command) => {
        commands.push(structuredClone(c));
        applyCommand(world, c);
        draw();
      };
      const action = (id: string) => {
        if (id === 'flash') aim.toggle();
        if (id === 'all') selected = world.agents.map((a) => a.id);
        if (id === 'hold' || id === 'weapons') send({ kind: id, agents: selected });
        draw();
      };
      const hud = new Hud(
        action,
        (i: number) => {
          selected = [world.agents[i].id];
          draw();
        },
        () => {},
      );
      const scene: Scene = new Scene(hud.stage, world);
      hud.reset(injunction);
      await scene.init();
      scene.render(selected, 1);
      scene.showVision = false;
      scene.zoomBy(0.88 / scene.camera.scale.x);
      const p = scene.screen({ x: 37, y: 25 });
      scene.panBy(scene.app.screen.width / 2 - p.x, scene.app.screen.height / 2 - p.y);
      const aim = new FlashAim(scene, hud, {
        world: () => world,
        selection: () => selected,
        command: send,
      });
      bindControls(scene, hud, {
        aim,
        world: () => world,
        selection: () => selected,
        select: (ids: string[]) => {
          selected = ids;
        },
        action,
        slow: () => {},
        order: (hit: { kind: string; point: Vec }) => {
          if (hit.kind === 'ground') send({ kind: 'move', agents: selected, point: hit.point });
        },
      });
      scene.app.ticker.add(draw);
      window.injunctionTest = {
        world,
        scene,
        commands,
        advance(ticks: number) {
          for (let i = 0; i < ticks; i++) step(world);
          draw();
          scene.app.renderer.render(scene.app.stage);
        },
      };
      draw();
    });
    await expect(page).toHaveTitle('Amortization / flash fixture');
    await expect(page.locator('canvas')).toBeVisible();
    await press('[data-agent="0"]');
    await expect(page.locator('#flash-button')).toBeDisabled();
    await press('[data-action="all"]');
    const aimPoint = async (point: Vec) => {
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const p = await page.evaluate((point) => {
        const { scene } = window.injunctionTest;
        const p = scene.screen(point),
          box = scene.app.canvas.getBoundingClientRect();
        return { x: box.x + p.x, y: box.y + p.y };
      }, point);
      if (mobile) await page.touchscreen.tap(p.x, p.y);
      else await page.mouse.click(p.x, p.y);
    };
    await press('#flash-button');
    await expect(page.locator('.flash-aim')).toBeVisible();
    await aimPoint({ x: 40, y: 28 });
    await expect(page.locator('.flash-hint')).toContainText('open ground');
    await expect(page.locator('.flash-confirm')).toBeDisabled();
    await aimPoint({ x: 38.3, y: 23.5 });
    await expect(page.locator('.flash-hint')).toContainText('Exposed crew: Morrow');
    await expect(page.locator('.flash-confirm')).toBeEnabled();
    expect(await page.evaluate(() => window.injunctionTest.commands)).toEqual([]);
    expect(
      await page.evaluate(() => window.injunctionTest.world.agents.map((a) => a.order.kind)),
    ).toEqual(['hold', 'hold', 'hold', 'hold']);
    await page.evaluate(() => window.injunctionTest.advance(0));
    await page.screenshot({
      path: `/tmp/mission-10/${mobile ? 'touch' : 'desktop'}-flash-preview.png`,
    });
    await press('.flash-cancel');
    await expect(page.locator('#flash-button')).toHaveText('Flash · 2 left · B');
    if (mobile) await press('#flash-button');
    else await page.keyboard.press('b');
    await aimPoint({ x: 38.3, y: 23.5 });
    await page.evaluate(() => {
      const a = window.injunctionTest.world.agents[2];
      Object.assign(a, { x: 38, y: 23.5, previous: { x: 38, y: 23.5 } });
    });
    await press('.flash-confirm');
    await expect(page.locator('.flash-aim')).toBeHidden();
    await expect(page.locator('#flash-button')).toHaveText('Flash · 1 left · B');
    expect(
      await page.evaluate(() => window.injunctionTest.commands.filter((c) => c.kind === 'flash')),
    ).toHaveLength(1);
    expect(
      await page.evaluate(
        () => window.injunctionTest.commands.find((c) => c.kind === 'flash')?.agents,
      ),
    ).toEqual(['agent-3']);
    await page.evaluate(() => window.injunctionTest.advance(33));
    await expect(page.locator('#condition-0')).toContainText('Disoriented');
    expect(
      await page.evaluate(() => window.injunctionTest.world.guards[0].disoriented),
    ).toBeGreaterThan(0);
    await page.screenshot({
      path: `/tmp/mission-10/${mobile ? 'touch' : 'desktop'}-flash-recovery.png`,
    });
    await page.evaluate(() => window.injunctionTest.advance(46));
    await expect(page.locator('#condition-0')).not.toContainText('Disoriented');

    // Reproduce Vale's cross-wall move from human run 640aec9a with actual map input.
    await page.evaluate(() => {
      const { world, scene } = window.injunctionTest;
      world.guards = [];
      const a = world.agents[1];
      Object.assign(a, { x: 5.709494566159405, y: 21.460730524467742 });
      a.previous = { x: a.x, y: a.y };
      scene.zoomBy(0.62 / scene.camera.scale.x);
      const centre = scene.screen({ x: 9, y: 20 });
      scene.panBy(scene.app.screen.width / 2 - centre.x, scene.app.screen.height / 2 - centre.y);
    });
    await press('[data-agent="1"]');
    await page.locator('canvas').scrollIntoViewIfNeeded();
    const point = await page.evaluate(() => {
      const { scene } = window.injunctionTest;
      const p = scene.screen({ x: 9.933711354459884, y: 11.450122634612335 }),
        rect = scene.app.canvas.getBoundingClientRect();
      return { x: p.x + rect.x, y: p.y + rect.y };
    });
    if (mobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y, { button: 'right' });
    await expect(page.locator('#map-location')).toHaveText('Movement · detour');
    await expect(page.locator('#map-detail')).toContainText('Vale:');
    await expect(page.locator('#map-detail')).toContainText('around obstacles');
    expect(
      await page.evaluate(() => {
        const a = window.injunctionTest.world.agents[1];
        return a.path[0].y > a.y;
      }),
    ).toBe(true);
    await page.evaluate(() => window.injunctionTest.advance(0));
    await page.screenshot({
      path: `/tmp/mission-10-feedback/${mobile ? 'touch' : 'desktop'}-detour.png`,
    });
    await press('[data-action="hold"]');
    await expect(page.locator('#map-location')).not.toHaveText('Movement · detour');
    await page.evaluate(() => {
      const { world, advance } = window.injunctionTest;
      world.broadcast!.traced = true;
      world.broadcast!.progress = 10;
      advance(0);
    });
    await press('#objective-primary');
    await expect(page.locator('#guide-detail')).toContainText('Site guards and incoming teams');
    await expect(page.locator('#guide-locations')).toContainText('SHUNT');
    await expect(page.locator('#guide-locations')).toContainText('CUT');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
