import { expect, test, type Page } from '@playwright/test';
import type { Scene, Hit } from '../../src/render/scene';
import type { World } from '../../src/sim/types';
import type { Hud } from '../../src/ui/hud';
import type { Action } from '../../src/input/actions';
import type { Command } from '../../src/sim/commands';

declare global {
  interface Window {
    combatUi: { world: World; scene: Scene; update: () => void };
  }
}

async function mountCombat(page: Page) {
  await page.route('**/combat-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><title>Amortization combat fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
    }),
  );
  await page.goto('http://127.0.0.1:4173/combat-fixture');
  await page.evaluate(async () => {
    const paths = [
      '/src/render/scene.ts',
      '/src/ui/hud.ts',
      '/src/sim/world.ts',
      '/src/content/severance.ts',
      '/src/sim/commands.ts',
      '/src/input/controls.ts',
    ];
    const [{ Scene }, { Hud }, { createWorld }, { severance }, { applyCommand }, { bindControls }] =
      await Promise.all(paths.map((p) => import(p)));
    const world = createWorld(severance) as World;
    // Paused presentation fixture. Live combat/completion and reload timing are tested in sim.
    world.guards = world.guards.filter((g) => g.tactics);
    for (const [i, p] of [...world.agents, ...world.guards].entries()) {
      Object.assign(p, { x: 10 + i * 3, y: 27, previous: { x: 10 + i * 3, y: 27 } });
      p.angle = -Math.PI / 4;
    }
    let selected = world.agents.map((p) => p.id);
    const update = () =>
      hud.update(world, { selected, paused: true, slow: false, sound: false, best: null });
    const command = (c: Command) => {
      applyCommand(world, c);
      update();
    };
    const action = (action: Action) => {
      if (action === 'weapons' || action === 'hold') command({ kind: action, agents: selected });
      if (action === 'all') {
        selected = world.agents.map((p) => p.id);
        // Keep this paused presentation stage fixed. Live follow has its own fixture.
        scene.follow(selected);
        scene.panBy(0, 0);
      }
      update();
    };
    const hud: Hud = new Hud(action, (i: number) => {
      selected = [world.agents[i].id];
      update();
    });
    const scene: Scene = new Scene(hud.stage, world);
    hud.reset(severance);
    await scene.init();
    scene.render(selected, 1);
    scene.showVision = false;
    scene.zoomBy(2.8);
    const center = scene.screen({ x: 17.5, y: 27 });
    scene.panBy(scene.app.screen.width / 2 - center.x, scene.app.screen.height / 2 - center.y);
    bindControls(scene, hud, {
      world: () => world,
      selection: () => selected,
      select: (ids: string[]) => {
        selected = ids;
      },
      action,
      slow: () => {},
      order: (hit: Hit) => {
        if (hit.kind === 'guard') command({ kind: 'attack', agents: selected, target: hit.id });
        if (hit.kind === 'object') command({ kind: 'interact', agents: selected, target: hit.id });
      },
    });
    scene.app.ticker.add(() => {
      update();
      scene.render(selected, 1);
    });
    window.combatUi = { world, scene, update };
    update();
  });
}

test('explains equipment and enemy readiness with mouse and touch without growing the sidebars', async ({
  browser,
}, testInfo) => {
  for (const phone of [false, true]) {
    const context = await browser.newContext({
      viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      hasTouch: phone,
      isMobile: phone,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await mountCombat(page);
    await expect(page).toHaveTitle('Amortization combat fixture');
    await expect(page.locator('canvas')).toBeVisible();
    const click = async (name: string) => {
      const button = page.getByRole('button', { name, exact: true });
      if (phone) await button.tap();
      else await button.click();
    };
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (!phone)
        for (const selector of ['.crew-sidebar', '.selection-section', '.mission-sidebar'])
          expect(
            await page.locator(selector).evaluate((e) => e.scrollHeight <= e.clientHeight + 1),
            selector,
          ).toBe(true);
    };
    await expect(page.locator('#selected-equipment')).toHaveText(
      '2 pistols · 1 carbine · 1 shotgun',
    );
    await fits();
    await click('Select Morrow');
    await fits();
    await click('Select Sable');
    await fits();
    await click('Select Rook');
    await expect(page.locator('#selected-equipment')).toContainText('Shotgun · 2/2 · range 3.8');
    await expect(page.locator('#condition-2')).toHaveText('Shotgun visible');
    await click('Draw weapons F');
    await expect(page.locator('#weapons-label')).toHaveText('Stow weapons');
    await page.evaluate(() => {
      const gun = window.combatUi.world.agents[2].armament!;
      gun.rounds = 0;
      gun.reload = 1.2;
      window.combatUi.update();
    });
    await expect(page.locator('#selected-equipment')).toContainText('Reloading 1.2s');
    await expect(page.locator('#health-label-2')).toContainText('↻ 1.2s');
    await click('Stow weapons F');
    await click('Hold S');
    await expect(page.locator('#selected-equipment')).toContainText('Reloading 1.2s');
    await expect(page.locator('#selected-cover')).toContainText('Long gun visible');
    await fits();
    await page.screenshot({
      path: testInfo.outputPath(`${phone ? 'phone' : 'laptop'}-reload.png`),
    });
    await click('Select all Q');
    for (const [index, role, behavior] of [
      [0, 'Carbine sentry', 'Holds a lane'],
      [1, 'Breach officer', 'Closes through screened positions'],
    ] as const) {
      await page.locator('canvas').scrollIntoViewIfNeeded();
      const target = await page.evaluate((i) => {
        const { scene, world } = window.combatUi;
        const point = scene.screen(world.guards[i], 0.5);
        const box = scene.app.canvas.getBoundingClientRect();
        return { x: point.x + box.x, y: point.y + box.y };
      }, index);
      if (phone) await page.touchscreen.tap(target.x, target.y);
      else await page.mouse.move(target.x, target.y);
      await expect(page.locator('.combat-target')).toBeVisible();
      await expect(page.locator('.combat-target')).toHaveAttribute(
        'data-target',
        await page.evaluate((i) => window.combatUi.world.guards[i].id, index),
      );
      await expect(page.locator('#map-location')).toHaveText(role);
      await expect(page.locator('#enemy-behavior')).toContainText(behavior);
      await expect(page.locator('#map-detail')).toContainText('range');
      // Touch release must not clear the description, and inspection must preserve selection.
      await expect(page.locator('#selected-count')).toHaveText('4 / 4');
      await fits();
    }
    await page.screenshot({
      path: testInfo.outputPath(`${phone ? 'phone' : 'laptop'}-inspection.png`),
    });
    expect(
      await page.evaluate(() => window.combatUi.world.agents.map((a) => a.order.kind)),
    ).toEqual(phone ? ['attack', 'attack', 'attack', 'attack'] : ['hold', 'hold', 'hold', 'hold']);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  }
});

test('combat cursors and target brackets follow weapons, geometry and selection under a stationary mouse', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await mountCombat(page);
  await expect(page).toHaveTitle('Amortization combat fixture');
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await page.evaluate(() => {
    const { world, scene } = window.combatUi;
    const a = world.agents[0];
    Object.assign(a, { x: 20, y: 27, previous: { x: 20, y: 27 } });
    scene.render([a.id], 1);
    scene.following = false;
    const p = scene.screen({ x: 21, y: 28 });
    scene.panBy(scene.app.screen.width / 2 - p.x, scene.app.screen.height / 2 - p.y);
  });
  const canvas = page.locator('canvas');
  const point = async (guard = false) =>
    page.evaluate((guard) => {
      const { scene, world } = window.combatUi;
      const p = scene.screen(guard ? world.guards[0] : { x: 19, y: 29 }, guard ? 0.5 : 0);
      const b = scene.app.canvas.getBoundingClientRect();
      return { x: b.x + p.x, y: b.y + p.y };
    }, guard);
  const ground = await point();
  await page.mouse.move(ground.x, ground.y);
  await expect(canvas).toHaveAttribute('data-cursor', 'default');
  await page.keyboard.press('f');
  await expect(canvas).toHaveAttribute('data-cursor', 'combat');
  expect(await canvas.evaluate((c) => getComputedStyle(c).cursor)).toContain('crosshair');
  await page.mouse.down();
  await page.mouse.move(ground.x + 20, ground.y + 20, { steps: 3 });
  await expect(canvas).toHaveAttribute('data-cursor', 'box');
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-cursor', 'combat');
  await page.keyboard.press('f');
  await expect(canvas).toHaveAttribute('data-cursor', 'default');
  const enemy = await point(true);
  await page.mouse.move(enemy.x, enemy.y);
  await expect(canvas).toHaveAttribute('data-cursor', 'attack');
  await expect(page.locator('#enemy-behavior')).toContainText(
    '1 selected operative has a clear line of fire',
  );
  expect(await page.evaluate(() => window.combatUi.world.agents[0].weapon)).toBe(false);
  await page.screenshot({ path: '/tmp/combat-ux/desktop-target.png' });
  await page.mouse.down({ button: 'middle' });
  await expect(canvas).toHaveAttribute('data-cursor', 'pan');
  await expect(page.locator('.combat-target')).toBeHidden();
  await page.mouse.up({ button: 'middle' });
  await page.mouse.click(enemy.x, enemy.y, { button: 'right' });
  expect(await page.evaluate(() => window.combatUi.world.agents[0].order)).toEqual({
    kind: 'attack',
    target: await page.evaluate(() => window.combatUi.world.guards[0].id),
  });
  expect(await page.evaluate(() => window.combatUi.world.agents[0].weapon)).toBe(true);
  await page.evaluate(() => {
    window.combatUi.world.agents[0].x = 10;
  });
  await expect(canvas).toHaveAttribute('data-cursor', 'blocked');
  await expect(page.locator('#enemy-behavior')).toContainText('Out of range');
  await page.evaluate(() => {
    const { world } = window.combatUi;
    world.agents[0].x = 20;
    world.mission = {
      ...world.mission,
      solids: [
        ...world.mission.solids,
        { id: 'test-cover', kind: 'wall', x: 21, y: 26, w: 0.4, h: 2, height: 2 },
      ],
    };
  });
  await expect(page.locator('#enemy-behavior')).toContainText('Line of fire blocked');
  await page.evaluate(() => {
    window.combatUi.world.agents[0].disarmed = true;
  });
  await expect(canvas).toHaveAttribute('data-cursor', 'unarmed');
  await expect(page.locator('#enemy-behavior')).toContainText('Selected crew cannot fire');
  await page.evaluate(() => {
    const { world } = window.combatUi;
    world.mission.solids = world.mission.solids.filter((s) => s.id !== 'test-cover');
  });
  await page.keyboard.press('q');
  await expect(canvas).toHaveAttribute('data-cursor', 'attack');
  // An enemy leaving the hover point must stop looking targeted without a mouse move.
  await page.evaluate(() => {
    window.combatUi.world.guards[0].hp = 0;
  });
  await expect(page.locator('.combat-target')).toBeHidden();
  await expect(canvas).not.toHaveAttribute('data-cursor', 'attack');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
