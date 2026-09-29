import { expect, test } from '@playwright/test';
import type { Scene } from '../../src/render/scene';
import type { World } from '../../src/sim/types';

declare global {
  interface Window {
    vanRun: { scene: Scene; world: World };
  }
}

for (const touch of [false, true]) {
  test(`SERVICE van leaves nose first in the reported human run (${touch ? 'touch' : 'desktop'})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1200, height: 850 },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('**/van-departure', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>Amortization / SERVICE departure</title><style>body{margin:0}#stage{width:100vw;height:100vh}canvas{display:block}</style><div id="stage"></div>',
      }),
    );
    await page.goto('/van-departure');
    const initial = await page.evaluate(async () => {
      const paths = ['/src/render/scene.ts', '/src/replay/core.ts', '/src/render/van.ts'];
      const [{ Scene }, { ReplayPlayer }, { vanDeparture }] = await Promise.all(
        paths.map((p) => import(p)),
      );
      const bundle = await (
        await fetch('/tests/replays/custody-medals-service-f7d67b5a.replay.json')
      ).json();
      const player = new ReplayPlayer(bundle, bundle.build);
      while (!player.done) player.advance();
      if (player.error) throw Error(player.error);
      const world = player.world,
        scene = new Scene(document.querySelector('#stage')!, world);
        await scene.init();
        scene.render([], 1, 0);
        scene.following = false;
        scene.zoomBy((innerWidth < 600 ? 1.5 : 2.5) / scene.camera.scale.x);
      const van = world.mission.solids.find((s: { id: string }) => s.id === 'service-van')!;
      const p = scene.screen({ x: van.x + van.w / 2, y: van.y + van.h / 2 }, van.height / 2);
      scene.panBy(innerWidth / 2 - p.x, innerHeight / 2 - p.y);
      scene.render([], 1, 0);
      scene.app.render();
      window.vanRun = { world, scene };
      return {
        heading: vanDeparture(van, world.mission),
        world: JSON.stringify(world),
        exit: world.extractedAt,
      };
    });
    expect(initial.heading).toMatchObject({ axis: 'y', direction: -1 });
    expect(initial.exit).toBe('alternate');
    await expect(page).toHaveTitle('Amortization / SERVICE departure');
    await expect(page.locator('canvas')).toBeVisible();
    await page.screenshot({ path: `/tmp/service-van-parked-${touch ? 'touch' : 'desktop'}.png` });
    const departure = await page.evaluate(() => {
      const { scene } = window.vanRun;
      // Advance presentation frames until the passengers have boarded, then
      // capture the van while moving along the north street.
      for (let i = 0; i < 60; i++) {
        scene.render([], 1, 0.1, true);
        if (document.querySelector<HTMLElement>('#stage')!.dataset.aftermath === 'departing') break;
      }
      for (let i = 0; i < 10; i++) scene.render([], 1, 0.1, true);
      scene.app.render();
      const ending = (
        scene as unknown as {
          aftermath: { offset: { x: number; y: number }; boarded: Set<string> };
        }
      ).aftermath;
      return { offset: ending.offset, boarded: ending.boarded.size };
    });
    expect(departure.boarded).toBe(5);
    expect(departure.offset.x).toBe(0);
    expect(departure.offset.y).toBeLessThan(-1);
    await expect(page.locator('#stage')).toHaveAttribute('data-aftermath', 'departing');
    await page.screenshot({
      path: `/tmp/service-van-departing-${touch ? 'touch' : 'desktop'}.png`,
    });
    await page.evaluate(() => {
      for (let i = 0; i < 160; i++) window.vanRun.scene.render([], 1, 0.1, true);
      window.vanRun.scene.app.render();
    });
    await expect(page.locator('#stage')).toHaveAttribute('data-aftermath', 'departed');
    expect(await page.evaluate(() => JSON.stringify(window.vanRun.world))).toBe(initial.world);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
