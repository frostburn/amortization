import { expect, test, type Page } from '@playwright/test';
import type { Container } from 'pixi.js';

async function mountScene(page: Page) {
  // Real HUD layout and WebGL renderer, with controlled mission states.
  await page.route('**/camera-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
    }),
  );
  await page.goto('/camera-fixture');
}

test('keeps the map usable through objective controls, injuries, COMMS, and viewport resizing @smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mountScene(page);
  const result = await page.evaluate(async () => {
    const modules = [
      '/src/render/scene.ts',
      '/src/ui/hud.ts',
      '/src/sim/world.ts',
      '/src/content/missions.ts',
    ];
    const [{ Scene }, { Hud }, { createWorld }, { missions }] = await Promise.all(
      modules.map((path) => import(path)),
    );
    let world = createWorld(missions[3]);
    const hud = new Hud(
      () => {},
      () => {},
      () => {},
    );
    const update = () =>
      hud.update(world, {
        selected: [world.agents[0].id],
        paused: true,
        slow: false,
        sound: false,
        best: null,
      });
    hud.reset(world.mission);
    update();
    const scene = new Scene(hud.stage, world);
    await scene.init();
    scene.app.ticker.add(() => scene.render([world.agents[0].id], 1));
    const settle = async () => {
      // Wait for application updates on both sides of layout/ResizeObserver.
      // Browser animation frames need not each render a frame in a capped ticker.
      for (let i = 0; i < 2; i++)
        await new Promise<void>((resolve) => scene.app.ticker.addOnce(() => resolve()));
    };
    const target = { x: 25, y: 18.4 };
    const snapshot = () => ({
      width: hud.stage.clientWidth,
      height: hud.stage.clientHeight,
      canvasWidth: scene.app.screen.width,
      canvasHeight: scene.app.screen.height,
      scale: scene.camera.scale.x,
      point: scene.screen(target),
      clickable:
        document.elementFromPoint(
          hud.stage.getBoundingClientRect().x + scene.screen(target).x,
          hud.stage.getBoundingClientRect().y + scene.screen(target).y,
        ) === scene.app.canvas,
      zoom: scene.zoom,
      expectedFit: Math.min(
        hud.stage.clientWidth / ((world.mission.width + world.mission.height) * 26 + 80),
        hud.stage.clientHeight / ((world.mission.width + world.mission.height) * 14 + 110),
      ),
    });
    await settle();
    scene.zoomBy(1.3);
    scene.panBy(43, -27);
    const initial = snapshot();
    world.evidence = 'carried';
    world.agents[0].carrying = true;
    update();
    await settle();
    const extraction = snapshot();
    world.escortLocked = false;
    world.escort.recruited = true;
    world.escort.waiting = true;
    update();
    await settle();
    const follow = snapshot();
    world.agents[1].hp = 4;
    update();
    await settle();
    const injured = snapshot();
    world.message =
      'Selected crew heading to STREET. Bring Quill and every surviving operative into the extraction ring before boarding. '.repeat(
        4,
      );
    update();
    await settle();
    const comms = snapshot();
    hud.stage.parentElement!.style.width = `${hud.stage.clientWidth - 120}px`;
    await settle();
    const resized = snapshot();
    const hit = scene.toWorld(initial.point.x, initial.point.y);
    scene.panBy(17, -11);
    const panned = snapshot();
    scene.home();
    const fitted = snapshot();
    world = createWorld(missions[0]);
    // Match main.ts: scene reset precedes the new mission's HUD layout.
    scene.reset(world);
    hud.reset(world.mission);
    update();
    await settle();
    const restarted = snapshot();
    return { initial, extraction, follow, injured, comms, resized, hit, panned, fitted, restarted };
  });
  expect(result.initial.height).toBeGreaterThan(500);
  for (const state of [
    result.initial,
    result.extraction,
    result.follow,
    result.injured,
    result.comms,
  ]) {
    expect(state.height).toBe(result.initial.height);
    expect(state.clickable).toBe(true);
  }
  expect(result.resized.width).toBeLessThan(result.initial.width);
  for (const state of [
    result.extraction,
    result.follow,
    result.injured,
    result.comms,
    result.resized,
  ]) {
    expect(state.canvasWidth).toBe(state.width);
    expect(state.canvasHeight).toBe(state.height);
    expect(state.scale).toBeCloseTo(result.initial.scale, 10);
    expect(state.point.x).toBeCloseTo(result.initial.point.x, 7);
    expect(state.point.y).toBeCloseTo(result.initial.point.y, 7);
  }
  expect(result.hit.x).toBeCloseTo(25, 7);
  expect(result.hit.y).toBeCloseTo(18.4, 7);
  expect(result.panned.point.x).toBeCloseTo(result.initial.point.x + 17, 7);
  expect(result.panned.point.y).toBeCloseTo(result.initial.point.y - 11, 7);
  for (const state of [result.fitted, result.restarted]) {
    expect(state.zoom).toBe(1);
    expect(state.scale).toBeCloseTo(state.expectedFit, 10);
  }
  expect(result.restarted.height).toBe(result.fitted.height);
});

test('shows Quill after either transport unlock, before he is recruited', async ({ page }) => {
  await mountScene(page);
  const result = await page.evaluate(async () => {
    const modules = [
      '/src/render/scene.ts',
      '/src/render/person.ts',
      '/src/ui/hud.ts',
      '/src/sim/world.ts',
      '/src/content/custody.ts',
      '/src/sim/orders.ts',
    ];
    const [
      { Scene },
      { PersonSprite },
      { Hud },
      { createWorld },
      { custody },
      { completeInteraction },
    ] = await Promise.all(modules.map((path) => import(path)));
    const hud = new Hud(
      () => {},
      () => {},
      () => {},
    );
    const scene = new Scene(hud.stage, createWorld(custody));
    await scene.init();
    scene.app.stop();
    const countBodies = (node: Container): number =>
      node.visible
        ? Number(node instanceof PersonSprite) +
          node.children.reduce((n, child) => n + countBodies(child), 0)
        : 0;
    return ['release', 'breach'].map((route) => {
      const world = createWorld(custody);
      scene.reset(world);
      scene.render([], 1);
      const locked = countBodies(scene.camera);
      world.agents[0].disguised = true;
      completeInteraction(world, world.agents[0], route);
      scene.render([], 1);
      const unlocked = countBodies(scene.camera),
        recruited = world.escort.recruited;
      completeInteraction(world, world.agents[0], 'escort');
      scene.render([], 1);
      return { route, locked, unlocked, recruited, following: countBodies(scene.camera) };
    });
  });
  for (const state of result) {
    expect(state.recruited).toBe(false);
    expect(state.unlocked, state.route).toBe(state.locked + 1);
    expect(state.following).toBe(state.unlocked);
  }
});
