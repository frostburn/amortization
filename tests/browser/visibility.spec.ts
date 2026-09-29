import { expect, test } from '@playwright/test';
import type { Scene } from '../../src/render/scene';
import type { PersonSprite } from '../../src/render/person';
import type { World } from '../../src/sim/types';

test('off-screen poses sleep and refresh on paused pan, zoom and interpolated re-entry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.route('**/visibility-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Amortization / visibility</title><style>body{margin:0}#stage{width:100vw;height:100vh}</style><div id="stage"></div>',
    }),
  );
  await page.goto('/visibility-fixture');
  const result = await page.evaluate(async () => {
    const paths = [
      '/src/render/scene.ts',
      '/src/render/person.ts',
      '/src/content/settlement.ts',
      '/src/sim/world.ts',
    ];
    const [{ Scene }, { PersonSprite }, { settlement }, { createWorld }] = await Promise.all(
      paths.map((p) => import(p)),
    );
    const world = createWorld(settlement) as World,
      scene = new Scene(document.querySelector('#stage')!, world) as Scene;
    const calls = new Map<string, { sprite: PersonSprite; hp: number; x: number; alpha: number }>();
    const original = PersonSprite.prototype.pose;
    PersonSprite.prototype.pose = function (
      this: PersonSprite,
      ...args: Parameters<PersonSprite['pose']>
    ) {
      const [p, alpha] = args;
      original.apply(this, args);
      calls.set(p.id, { sprite: this, hp: p.hp, x: p.x, alpha });
    };
    await scene.init();
    scene.app.ticker.stop();
    scene.render([], 1, 0);
    scene.following = false;
    const centre = (p: { x: number; y: number }) => {
      const screen = scene.screen(p);
      scene.panBy(innerWidth / 2 - screen.x, innerHeight / 2 - screen.y);
    };
    scene.zoomBy(1 / scene.camera.scale.x);
    centre(world.agents[0]);
    calls.clear();
    scene.render([], 1, 0);
    const nearDrawn = calls.has(world.agents[0].id),
      far = world.guards.find((g) => !calls.has(g.id))!,
      culledCount = world.guards.filter((g) => !calls.has(g.id)).length;
    centre(far);
    scene.render([], 1, 0);
    const sprite = calls.get(far.id)!.sprite,
      aliveGeometry = sprite.geometry,
      firstVisible = sprite.parent!.visible;
    centre(world.agents[0]);
    calls.clear();
    scene.render([], 1, 0);
    const hidden = !sprite.parent!.visible;
    far.hp = 0;
    far.x += 0.5;
    far.previous = { x: far.x, y: far.y };
    for (let i = 0; i < 8; i++) scene.render([], 1, 0);
    const slept = !calls.has(far.id);
    // No simulation tick: a paused camera move must pick up the new fallen pose.
    centre(far);
    scene.render([], 1, 0);
    scene.app.render();
    const refreshed = calls.get(far.id)!,
      returned =
        sprite.parent!.visible &&
        sprite.geometry !== aliveGeometry &&
        refreshed.hp === 0 &&
        refreshed.x === far.x;
    const frozenWorld = JSON.stringify(world);
    const zooms = [0.55, 1.8, 3].map((scale) => {
      scene.zoomBy(scale / scene.camera.scale.x);
      centre(far);
      calls.clear();
      scene.render([], 1, 0);
      scene.app.render();
      return sprite.parent!.visible && calls.has(far.id);
    });
    // A currently distant operative can still be on screen in the interpolated frame.
    scene.zoomBy(1 / scene.camera.scale.x);
    centre(world.agents[0]);
    far.previous = { x: world.agents[0].x, y: world.agents[0].y };
    calls.clear();
    scene.render([], 0, 0);
    const interpolated = sprite.parent!.visible && calls.get(far.id)?.alpha === 0;
    far.previous = { x: far.x, y: far.y };
    const unchanged = JSON.stringify(world) === frozenWorld;
    PersonSprite.prototype.pose = original;
    return {
      nearDrawn,
      culledCount,
      firstVisible,
      hidden,
      slept,
      returned,
      zooms,
      interpolated,
      unchanged,
    };
  });
  expect(result).toMatchObject({
    nearDrawn: true,
    firstVisible: true,
    hidden: true,
    slept: true,
    returned: true,
    zooms: [true, true, true],
    interpolated: true,
    unchanged: true,
  });
  expect(result.culledCount).toBeGreaterThan(0);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
