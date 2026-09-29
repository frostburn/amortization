import { expect, test } from '@playwright/test';
import type { Container, Text } from 'pixi.js';
import type { Scene } from '../../src/render/scene';
import type { World } from '../../src/sim/types';

declare global {
  interface Window {
    detentionScenery: { world: World; scene: Scene };
  }
}

test('detention scenery keeps console labels apart, mounts lights on the wall and preserves van hits', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/detention-scenery', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Amortization / detention scenery</title><style>body{margin:0}#stage{width:100vw;height:100vh}canvas{display:block}</style><div id="stage"></div>',
    }),
  );
  await page.goto('/detention-scenery');
  await page.evaluate(async () => {
    const paths = ['/src/render/scene.ts', '/src/sim/world.ts', '/src/content/personnel.ts'];
    const [{ Scene }, { createWorld }, { personnel }] = await Promise.all(
      paths.map((p) => import(p)),
    );
    const world = createWorld(personnel),
      scene = new Scene(document.querySelector('#stage')!, world);
    await scene.init();
    scene.render(['agent-0'], 1);
    scene.following = false;
    window.detentionScenery = { world, scene };
  });
  await expect(page).toHaveTitle('Amortization / detention scenery');
  await expect(page.locator('canvas')).toBeVisible();
  for (const scale of [0.55, 0.95, 1.8, 3]) {
    const result = await page.evaluate((scale) => {
      const { scene, world } = window.detentionScenery;
      scene.zoomBy(scale / scene.camera.scale.x);
      const p = scene.screen({ x: 10, y: 23 });
      scene.panBy(innerWidth / 2 - p.x, innerHeight / 2 - p.y);
      scene.render(['agent-0'], 1);
      scene.app.render();
      const labels: { text: string; x: number; y: number; w: number; h: number }[] = [];
      const collect = (node: Container) => {
        if (!node.visible) return;
        if ('text' in node) {
          const b = node.getBounds();
          labels.push({ text: (node as Text).text, x: b.x, y: b.y, w: b.width, h: b.height });
        }
        node.children.forEach(collect);
      };
      collect(scene.camera);
      const marker = scene.markerScreen('access-intake')!;
      const nearby = labels.filter(
        (l) => Math.hypot(l.x + l.w / 2 - marker.x, l.y - marker.y) < 100 * scale,
      );
      const overlaps = nearby.flatMap((a, i) =>
        nearby
          .slice(i + 1)
          .filter((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)
          .map((b) => [a.text, b.text]),
      );
      const van = world.mission.solids.find((s) => s.kind === 'van')!;
      const roof = scene.screen({ x: van.x + van.w / 2, y: van.y + van.h / 2 }, van.height);
      const wall = world.mission.solids.find((s) => s.id === 'north')!;
      const scenery = (scene as unknown as { scenery: { footprint: unknown; root: Container }[] })
        .scenery;
      const bounds = scenery.find((s) => s.footprint === wall)!.root.getBounds();
      const vertices = [wall.x, wall.x + wall.w].flatMap((x) =>
        [wall.y, wall.y + wall.h].flatMap((y) =>
          [0, wall.height].map((z) => scene.screen({ x, y }, z)),
        ),
      );
      return {
        overlaps,
        tags: nearby.map((l) => l.text),
        hit: scene.hit(roof.x, roof.y, true),
        wallBounds: { x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom },
        wallExpected: {
          x: Math.min(...vertices.map((p) => p.x)),
          y: Math.min(...vertices.map((p) => p.y)),
          right: Math.max(...vertices.map((p) => p.x)),
          bottom: Math.max(...vertices.map((p) => p.y)),
        },
      };
    }, scale);
    expect(result.tags).toEqual(expect.arrayContaining(['INTAKE', 'CELLS']));
    expect(result.overlaps).toEqual([]);
    expect(result.hit).toEqual({ kind: 'object', id: 'extract' });
    expect(result.wallBounds.x).toBeGreaterThanOrEqual(result.wallExpected.x - 1);
    expect(result.wallBounds.y).toBeGreaterThanOrEqual(result.wallExpected.y - 1);
    expect(result.wallBounds.right).toBeLessThanOrEqual(result.wallExpected.right + 1);
    expect(result.wallBounds.bottom).toBeLessThanOrEqual(result.wallExpected.bottom + 1);
    if (scale === 0.95 || scale === 1.8)
      await page.screenshot({ path: `/tmp/personnel-review/scenery-${scale}.png` });
  }
  await page.evaluate(() => {
    const { scene } = window.detentionScenery;
    scene.zoomBy(1.5 / scene.camera.scale.x);
    const p = scene.screen({ x: 20, y: 6.35 }, 0.75);
    scene.panBy(innerWidth / 2 - p.x, innerHeight / 2 - p.y);
    scene.render(['agent-0'], 1);
    scene.app.render();
  });
  await page.screenshot({ path: '/tmp/personnel-review/wall-lights.png' });
  expect(errors).toEqual([]);
});
