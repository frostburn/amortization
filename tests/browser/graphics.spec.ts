import { expect, test, type Page } from '@playwright/test';
import type { World } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';
import type { Hud } from '../../src/ui/hud';

declare global {
  interface Window {
    graphics: { world: World; scene: Scene; hud: Hud; render: () => void };
  }
}

async function fixture(page: Page) {
  await page.route('**/graphics-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Amortization graphics</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
    }),
  );
  await page.goto('/graphics-fixture');
  await page.evaluate(async () => {
    const paths = [
      '/src/render/scene.ts',
      '/src/ui/hud.ts',
      '/src/sim/world.ts',
      '/src/sim/commands.ts',
      '/src/sim/combat.ts',
      '/src/input/controls.ts',
    ];
    const [{ Scene }, { Hud }, { createWorld }, { applyCommand }, { shoot }, { bindControls }] =
      await Promise.all(paths.map((p) => import(p)));
    const world = createWorld() as World;
    world.guards = world.guards.slice(0, 2);
    const place = (
      p: World['agents'][number] | World['guards'][number] | NonNullable<World['escort']>,
      x: number,
      y: number,
    ) => Object.assign(p, { x, y, previous: { x, y }, angle: Math.PI / 4 });
    world.agents.forEach((p, i) => place(p, 10 + i * 1.5, 24));
    place(world.guards[0], 17, 24);
    place(world.guards[1], 14, 25.5);
    world.guards[1].hp = 0;
    world.guards[1].angle = -Math.PI / 4;
    place(world.escort!, 9.5, 25.5);
    world.escort!.recruited = true;
    world.escort!.leader = world.agents[0].id;
    world.agents[0].weapon = true;
    shoot(world, world.agents[0], world.guards[0], false);
    const hud = new Hud(
      (action: string) => {
        if (action === 'escort-wait') applyCommand(world, { kind: action });
        render();
      },
      () => {},
      () => {},
    );
    const scene = new Scene(hud.stage, world);
    const render = () => {
      hud.update(world, {
        selected: world.agents.map((a) => a.id),
        paused: true,
        slow: false,
        sound: false,
        best: null,
      });
      if (scene.app.renderer)
        scene.render(
          world.agents.map((a) => a.id),
          1,
        );
    };
    hud.reset(world.mission);
    render();
    await scene.init();
    scene.app.ticker.add(render);
    bindControls(scene, hud, {
      world: () => world,
      selection: () => world.agents.map((a) => a.id),
      select: () => {},
      order: (hit: { kind: string; id: string }) => {
        if (hit.kind === 'object')
          applyCommand(world, {
            kind: 'interact',
            agents: world.agents.map((a) => a.id),
            target: hit.id,
          });
        render();
      },
      action: () => {},
      slow: () => {},
    });
    window.graphics = { world, scene, hud, render };
  });
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#escort-wait-button')).toHaveText('Tell Voss to wait');
}

async function focus(page: Page, x: number, y: number, z = 0) {
  await page.evaluate(
    ({ x, y, z }) => {
      const { scene, render } = window.graphics;
      const point = scene.screen({ x, y }, z);
      scene.panBy(scene.app.screen.width / 2 - point.x, scene.app.screen.height / 2 - point.y);
      render();
    },
    { x, y, z },
  );
  await page.evaluate(() => new Promise(requestAnimationFrame));
}

test('keeps high-DPI text sharp and witness markers clear and actionable through zoom', async ({
  browser,
}, testInfo) => {
  test.setTimeout(45_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await fixture(page);
  await expect(page).toHaveTitle('Amortization graphics');
  await expect(page).toHaveURL(/graphics-fixture$/);
  await expect(page.locator('#mission-title')).toHaveText('The release clause');
  await page.evaluate(() => window.graphics.scene.zoomBy(2.8));
  await focus(page, 12.5, 24, 0.6);
  await page.screenshot({ path: testInfo.outputPath('squad-and-witness.png') });
  for (const zoom of [0.4, 1, 2.8]) {
    await page.evaluate((zoom) => {
      const { scene, render } = window.graphics;
      scene.zoomBy(zoom / scene.zoom);
      render();
    }, zoom);
    await focus(page, 9.5, 25.5, 1.6);
    const result = await page.evaluate(() => {
      const { scene, world } = window.graphics;
      const labels: { text: string; resolution: number }[] = [];
      const collect = (node: typeof scene.camera) => {
        if ('text' in node && 'resolution' in node)
          labels.push({
            text: String(node.text),
            resolution: Number(node.resolution),
          });
        node.children.forEach(collect);
      };
      collect(scene.camera);
      const marker = scene.markerScreen('escort')!,
        head = scene.screen(world.escort!, 1.6);
      return {
        gap: head.y - marker.y,
        marker,
        hit: scene.hit(marker.x, marker.y, true),
        labels,
        neededResolution: scene.camera.scale.x * scene.app.renderer.resolution,
      };
    });
    expect(result.gap).toBeGreaterThanOrEqual(31.9);
    expect(result.hit).toEqual({ kind: 'object', id: 'escort' });
    expect(result.labels.some((l) => l.text === 'VAN · LOCKED')).toBe(false); // Recruited witness unlocks extraction.
    expect(result.labels.some((l) => l.text === 'KIT')).toBe(true);
    for (const label of result.labels)
      expect(label.resolution).toBeGreaterThanOrEqual(result.neededResolution);
    const map = (await page.locator('canvas').boundingBox())!;
    await page.evaluate(() => {
      window.graphics.world.agents.forEach((a) => {
        a.order = { kind: 'hold' };
        a.path = [];
      });
    });
    await page.mouse.click(map.x + result.marker.x, map.y + result.marker.y, { button: 'right' });
    expect(
      await page.evaluate(() =>
        window.graphics.world.agents.some(
          (a) => a.order.kind === 'interact' && a.order.target === 'escort',
        ),
      ),
    ).toBe(true);
  }
  await page.evaluate(() => {
    const { world, render } = window.graphics;
    world.escort!.recruited = false;
    render();
  });
  await focus(page, 4.8, 21.5, 1);
  await page.screenshot({ path: testInfo.outputPath('zoomed-kit-and-van.png') });
  await focus(page, 18, 4.3, 1.2);
  await page.screenshot({ path: testInfo.outputPath('wall-lights.png') });
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});
