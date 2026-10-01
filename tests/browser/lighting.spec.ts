import { expect, test } from '@playwright/test';
import type { Graphics, WebGLRenderer } from 'pixi.js';
import type { Scene } from '../../src/render/scene';
import type { OperativeLighting } from '../../src/render/lighting';
import type { World } from '../../src/sim/types';

test('light pools preserve distant visibility, split crew, interpolation and camera transforms', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 1000, height: 700 },
    deviceScaleFactor: 2,
  });
  await context.grantPermissions(['local-network-access'], { origin: 'http://127.0.0.1:4173' });
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('PixiJS')))
      errors.push(m.text());
  });
  await page.route('**/lighting-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Amortization / lighting</title><style>body{margin:0}#stage{width:100vw;height:100vh}</style><div id="stage"></div>',
    }),
  );
  await page.goto('/lighting-fixture');
  const result = await page.evaluate(async () => {
    const paths = [
      '/src/render/scene.ts',
      '/src/render/lighting.ts',
      '/src/sim/world.ts',
      '/src/render/isometric.ts',
      '/src/content/bench.ts',
    ];
    const [{ Scene }, { OperativeLighting }, { createWorld }, { project }, { bench }] =
      await Promise.all(paths.map((p) => import(p)));
    const world = createWorld() as World,
      scene = new Scene(document.querySelector('#stage')!, world) as Scene;
    await scene.init();
    scene.app.ticker.stop();
    scene.render([], 1, 0);
    // Use a white calibration surface beneath the production lighting layer.
    // Pixel assertions catch a missing shader, accidental black-out, DPI drift,
    // additive overlap, or lights tied to selection instead of the actual crew.
    scene.camera.children.forEach((c) => {
      c.visible = false;
    });
    const floor = scene.camera.getChildAt<Graphics>(0),
      lighting = scene.camera.children.find(
        (c) => c instanceof OperativeLighting,
      )! as OperativeLighting;
    floor.clear().rect(-20000, -20000, 40000, 40000).fill(0xffffff);
    floor.visible = lighting.visible = true;
    scene.camera.position.set(250, 350);
    scene.camera.scale.set(1);
    const place = (
      p: World['agents'][number] | NonNullable<World['escort']>,
      x: number,
      y: number,
    ) => Object.assign(p, { x, y, previous: { x, y } });
    world.agents.forEach((a, i) => {
      place(a, 0, 0);
      a.hp = i ? 0 : 100;
    });
    const gl = (scene.app.renderer as WebGLRenderer).gl;
    const read = (x: number, y: number) => {
      const pixel = new Uint8Array(4),
        resolution = scene.app.renderer.resolution;
      gl.readPixels(
        Math.round(x * resolution),
        scene.app.canvas.height - 1 - Math.round(y * resolution),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixel,
      );
      return pixel[0];
    };
    const frame = (alpha = 1, w = world, activeFloor = 0) => {
      lighting.refresh(w, alpha, scene.camera, scene.app.screen, null, activeFloor);
      scene.app.render();
    };
    const at = (x: number, y: number, dy = 0, floor = 0) => {
      const p = project({ x, y, floor }, 0.55),
        scale = scene.camera.scale.x;
      return read(scene.camera.x + p.x * scale, scene.camera.y + (p.y + dy) * scale);
    };
    frame();
    const solo = { core: at(0, 0), fringe: at(0, 0, 90), distant: at(9, -9) };
    world.agents.forEach((a) => {
      a.hp = 100;
    });
    frame();
    const grouped = at(0, 0, 90);
    // A second pool remains present even when that operative is not selected.
    place(world.agents[1], 9, -9);
    frame();
    const split = at(9, -9);
    world.agents[1].captive = true;
    frame();
    const captive = at(9, -9);
    world.agents[1].captive = false;
    world.agents[1].hp = 0;
    frame();
    const fallen = at(9, -9);
    place(world.escort!, 9, -9);
    world.escort!.recruited = true;
    frame();
    const witness = at(9, -9);
    world.escort!.recruited = false;
    world.agents.forEach((a, i) => {
      a.hp = i ? 0 : 100;
    });
    place(world.agents[0], 8, -8);
    world.agents[0].previous = { x: -8, y: 8 };
    frame(0.5);
    const interpolated = at(0, 0);
    place(world.agents[0], 0, 0);
    const snapshot = JSON.stringify(world);
    const transforms = [0.55, 1.8, 3].map((scale) => {
      scene.camera.scale.set(scale);
      scene.camera.position.set(200 + scale * 30, 300);
      frame();
      return { core: at(0, 0), fringe: at(0, 0, 90) };
    });
    const unchanged = JSON.stringify(world) === snapshot;
    world.agents[0].hp = 0;
    frame();
    const empty = at(0, 0);
    // A split crew must light the elevated roof at the correct screen position,
    // never project a downstairs pool through it. Indoors stays evenly lit on
    // both visits, independent of camera/selection or the outdoor sunset.
    const tower = createWorld(bench) as World;
    scene.camera.position.set(250, 350);
    scene.camera.scale.set(1);
    tower.agents.forEach((a, i) => {
      place(a, i ? 9 : 0, i ? -9 : 0);
      a.hp = i < 2 ? 100 : 0;
      a.floor = i ? 0 : 1;
    });
    const towerSnapshot = JSON.stringify(tower);
    frame(1, tower, 0);
    const indoor = at(9, -9);
    frame(1, tower, 1);
    const rooftop = { crew: at(0, 0, 0, 1), downstairs: at(9, -9, 0, 1) };
    frame(1, tower, 0);
    const returned = at(9, -9);
    return {
      solo,
      grouped,
      split,
      captive,
      fallen,
      witness,
      interpolated,
      transforms,
      unchanged,
      empty,
      indoor,
      rooftop,
      returned,
      towerUnchanged: JSON.stringify(tower) === towerSnapshot,
    };
  });
  expect(result.solo.core).toBeGreaterThan(250);
  expect(result.solo.fringe).toBeGreaterThan(result.solo.distant + 30);
  expect(result.solo.fringe).toBeLessThan(result.solo.core - 15);
  expect(result.grouped).toBe(result.solo.fringe);
  for (const level of [result.split, result.witness, result.interpolated])
    expect(level).toBeGreaterThan(250);
  for (const level of [result.solo.distant, result.captive, result.fallen, result.empty]) {
    expect(level).toBeGreaterThanOrEqual(150); // At least ~60% ambient visibility.
    expect(level).toBeLessThan(170);
  }
  for (const state of result.transforms) {
    expect(state.core).toBeGreaterThan(250);
    expect(Math.abs(state.fringe - result.solo.fringe)).toBeLessThanOrEqual(2);
  }
  expect(result.unchanged).toBe(true);
  expect(result.indoor).toBeGreaterThan(250);
  expect(result.returned).toBe(result.indoor);
  expect(result.rooftop.crew).toBeGreaterThan(250);
  expect(result.rooftop.downstairs).toBeGreaterThan(180);
  expect(result.rooftop.downstairs).toBeLessThan(210);
  expect(result.towerUnchanged).toBe(true);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});
