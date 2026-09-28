import { expect, test } from '@playwright/test';
import type { Scene } from '../../src/render/scene';
import type { World } from '../../src/sim/types';
import type { Hud, Action } from '../../src/ui/hud';

declare global {
  interface Window {
    clearingTest: { world: World; scene: Scene; hud: Hud; draw: () => void };
  }
}

for (const mobile of [false, true]) {
  test(`operation seven: ${mobile ? 'touch' : 'desktop'} launch, readable framing and split-team follow`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 },
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
    await press('[data-action="mission:clearing"]');
    await expect(page.locator('[data-loadout]')).toContainText(
      'Rook — Compact automatic; Sable — Coil rifle',
    );
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#mission-title')).toHaveText('Margin call');
    await expect(page.locator('#objective-extract')).toContainText('Collect KEYS');
    await press('[data-agent="3"]');
    await expect(page.locator('#selected-equipment')).toContainText('Coil rifle');
    await press('[data-action="home"]');
    await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'false');
    await press('[data-action="follow"]');
    await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('canvas')
      .screenshot({ path: test.info().outputPath('mission-seven-start.png') });

    // Controlled positions make camera assertions independent of machine rendering speed.
    // The two real, live-patrol completions are recorded/replayed in clearing.test.ts.
    await page.route('**/clearing-camera', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
      }),
    );
    await page.goto('/clearing-camera');
    await page.evaluate(async () => {
      const paths = [
        '/src/render/scene.ts',
        '/src/ui/hud.ts',
        '/src/content/clearing.ts',
        '/src/sim/world.ts',
        '/src/input/controls.ts',
        '/src/sim/commands.ts',
      ];
      const [
        { Scene },
        { Hud },
        { clearing },
        { createWorld },
        { bindControls },
        { applyCommand },
      ] = await Promise.all(paths.map((p) => import(p)));
      const world = createWorld(clearing) as World;
      let selected = world.agents.map((a) => a.id);
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
      const select = (ids: string[]) => {
        selected = ids;
        scene.follow(selected);
        draw();
      };
      const action = (action: Action) => {
        if (action === 'home') scene.home();
        if (action === 'follow') {
          hud.clearGuide();
          scene.follow(selected, true);
        }
        if (action === 'zoom-in') scene.zoomBy(1.18);
        if (action === 'zoom-out') scene.zoomBy(1 / 1.18);
        draw();
      };
      const hud = new Hud(
        action,
        (index: number) => select([world.agents[index].id]),
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
      hud.reset(clearing);
      await scene.init();
      bindControls(scene, hud, {
        world: () => world,
        selection: () => selected,
        select,
        action,
        slow: () => {},
        order: (hit: { kind: string; point: { x: number; y: number } }) => {
          if (hit.kind === 'ground')
            applyCommand(world, { kind: 'move', agents: selected, point: hit.point });
          draw();
        },
      });
      scene.app.ticker.add(draw);
      draw();
      window.clearingTest = { world, scene, hud, draw };
    });
    const initial = await page.evaluate(() => {
      const { world, scene } = window.clearingTest;
      return {
        scale: scene.camera.scale.x,
        point: scene.screen(world.agents[0]),
        width: scene.app.screen.width,
        height: scene.app.screen.height,
      };
    });
    expect(initial.scale).toBeCloseTo(0.95);
    expect(initial.point.x / initial.width).toBeCloseTo(0.5, 1);
    const moved = await page.evaluate(() => {
      const { world, scene, draw } = window.clearingTest;
      for (const a of world.agents) {
        a.x += 25;
        a.previous = { x: a.x, y: a.y };
      }
      draw();
      return { scale: scene.camera.scale.x, point: scene.screen(world.agents[0]) };
    });
    expect(moved.scale).toBe(initial.scale);
    expect(moved.point.x).toBeLessThan(initial.width * 0.72);
    expect(moved.point.y).toBeLessThan(initial.height * 0.7);
    await page.evaluate(() => {
      const { world, draw } = window.clearingTest;
      Object.assign(world.agents[1], {
        x: 5.8,
        y: 23,
        previous: { x: 5.8, y: 23 },
        order: { kind: 'interact', target: 'override' },
      });
      world.overrideBy = world.agents[1].id;
      draw();
    });
    await press('[data-agent="1"]');
    const split = await page.evaluate(() => {
      const { world, scene } = window.clearingTest;
      return { scale: scene.camera.scale.x, point: scene.screen(world.agents[1]) };
    });
    expect(split.scale).toBe(initial.scale);
    expect(split.point.x).toBeCloseTo(initial.width * 0.5);
    expect(split.point.y).toBeCloseTo(initial.height * 0.53);
    // Real pointer panning suspends follow on desktop and touch.
    await page.locator('canvas').scrollIntoViewIfNeeded();
    const canvas = (await page.locator('canvas').boundingBox())!;
    const start = { x: canvas.x + canvas.width * 0.5, y: canvas.y + canvas.height * 0.5 };
    if (mobile) {
      const client = await context.newCDPSession(page);
      await client.send('Input.synthesizeScrollGesture', {
        x: start.x,
        y: start.y,
        xDistance: -50,
        yDistance: 0,
        gestureSourceType: 'touch',
        speed: 400,
      });
      await client.detach();
    } else {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(start.x + 50, start.y, { steps: 3 });
      await page.mouse.up({ button: 'middle' });
    }
    await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'false');
    await press('[data-agent="0"]');
    await expect(page.locator('#follow-button')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#archive-status')).toHaveText('SHUNT held by Vale');
    const switched = await page.evaluate(() => {
      const { world, scene } = window.clearingTest;
      return { scale: scene.camera.scale.x, point: scene.screen(world.agents[0]) };
    });
    expect(switched.scale).toBe(initial.scale);
    expect(switched.point.x).toBeCloseTo(initial.width * 0.5);
    await press('[data-action="zoom-in"]');
    await press('[data-action="home"]');
    const overview = await page.evaluate(() => window.clearingTest.scene.camera.scale.x);
    expect(overview).toBeLessThan(initial.scale);
    await press('[data-action="follow"]');
    expect(await page.evaluate(() => window.clearingTest.scene.camera.scale.x)).toBeCloseTo(
      initial.scale * 1.18,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await context.close();
  });
}
