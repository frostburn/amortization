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
    // The selection change resumes follow; hold this presentation fixture still
    // so a drag can only move the camera through the input handler under test.
    await page.evaluate(() => {
      window.injunctionTest.scene.following = false;
    });
    const touchSession = mobile ? await context.newCDPSession(page) : null;
    let touching = false;
    const clientPoint = async (point: Vec) => {
      await page.locator('canvas').scrollIntoViewIfNeeded();
      return page.evaluate((point) => {
        const { scene } = window.injunctionTest;
        const p = scene.screen(point),
          box = scene.app.canvas.getBoundingClientRect();
        return { x: box.x + p.x, y: box.y + p.y };
      }, point);
    };
    const previewAt = async (point: Vec) => {
      const p = await clientPoint(point);
      if (touchSession) {
        await touchSession.send('Input.dispatchTouchEvent', {
          type: touching ? 'touchMove' : 'touchStart',
          touchPoints: [{ ...p, id: 1 }],
        });
        touching = true;
      } else await page.mouse.move(p.x, p.y);
    };
    const releaseAt = async (point: Vec) => {
      if (touchSession) {
        await previewAt(point);
        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        touching = false;
      } else {
        const p = await clientPoint(point);
        await page.mouse.click(p.x, p.y);
      }
    };
    const valid = { x: 38.3, y: 23.5 };
    const orders = await page.evaluate(() =>
      JSON.stringify(window.injunctionTest.world.agents.map((a) => a.order)),
    );
    await press('#flash-button');
    await expect(page.locator('.flash-aim')).toBeVisible();
    await expect(page.locator('.flash-confirm')).toHaveCount(0);
    await previewAt({ x: 40, y: 28 });
    await expect(page.locator('.flash-hint')).toContainText('open ground');
    expect(await page.evaluate(() => window.injunctionTest.scene.flashAim?.valid)).toBe(false);
    await releaseAt({ x: 40, y: 28 });
    await expect(page.locator('.flash-aim')).toBeHidden();
    await expect(page.locator('#flash-button')).toHaveText('Flash · 2 left · B');
    expect(await page.evaluate(() => window.injunctionTest.commands)).toEqual([]);

    // The current release location wins over the valid initial press, without panning.
    await press('#flash-button');
    const camera = await page.evaluate(() => ({
      x: window.injunctionTest.scene.camera.x,
      y: window.injunctionTest.scene.camera.y,
    }));
    await previewAt(valid);
    await previewAt({ x: 42.5, y: 23.5 });
    await expect(page.locator('.flash-hint')).toContainText('Out of range');
    expect(
      await page.evaluate(() => ({
        x: window.injunctionTest.scene.camera.x,
        y: window.injunctionTest.scene.camera.y,
      })),
    ).toEqual(camera);
    await releaseAt({ x: 42.5, y: 23.5 });
    await expect(page.locator('.flash-aim')).toBeHidden();
    expect(await page.evaluate(() => window.injunctionTest.commands)).toEqual([]);
    expect(
      await page.evaluate(() =>
        JSON.stringify(window.injunctionTest.world.agents.map((a) => a.order)),
      ),
    ).toBe(orders);
    await expect(page.locator('#flash-button')).toHaveText('Flash · 2 left · B');

    await press('#flash-button');
    await previewAt(valid);
    await expect(page.locator('.flash-hint')).toContainText('Exposed crew: Morrow');
    expect(await page.evaluate(() => window.injunctionTest.scene.flashAim?.valid)).toBe(true);
    expect(await page.evaluate(() => window.injunctionTest.commands)).toEqual([]);
    await page.evaluate(() => window.injunctionTest.advance(0));
    await page.screenshot({
      path: `/tmp/mission-10/${mobile ? 'touch' : 'desktop'}-flash-preview.png`,
    });
    if (touchSession) {
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      touching = false;
    } else await page.keyboard.press('Escape');
    await expect(page.locator('.flash-aim')).toBeHidden();
    expect(await page.evaluate(() => window.injunctionTest.commands)).toEqual([]);

    if (mobile) await press('#flash-button');
    else await page.keyboard.press('b');
    await previewAt({ x: 35, y: 24 });
    await previewAt(valid);
    await expect(page.locator('.flash-hint')).toContainText('Sable');
    await releaseAt(valid);
    await expect(page.locator('.flash-aim')).toBeHidden();
    await expect(page.locator('#flash-button')).toHaveText('Flash · 1 left · B');
    expect(await page.evaluate(() => window.injunctionTest.commands.map((c) => c.kind))).toEqual([
      'flash',
    ]);
    expect(await page.evaluate(() => window.injunctionTest.commands[0])).toMatchObject({
      kind: 'flash',
      agents: ['agent-3'],
    });
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
