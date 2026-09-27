import { expect, test, type Page } from '@playwright/test';
import type { World, Rect } from '../../src/sim/types';
import type { Hud } from '../../src/ui/hud';
import type { Scene, Hit } from '../../src/render/scene';
import type { Action } from '../../src/ui/hud';
import type { GuideTarget } from '../../src/ui/objectives';

declare global {
  interface Window {
    feedback: { world: World; hud: Hud; scene: Scene; update: () => void; actions: Action[] };
  }
}

async function mountFeedback(page: Page) {
  // Controlled injuries with the real HUD, command handlers, input bindings and renderer.
  await page.route('**/feedback-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
    }),
  );
  await page.goto('http://127.0.0.1:4173/feedback-fixture');
  await page.evaluate(async () => {
    const modules = [
      '/src/render/scene.ts',
      '/src/ui/hud.ts',
      '/src/sim/world.ts',
      '/src/content/custody.ts',
      '/src/sim/commands.ts',
      '/src/input/controls.ts',
    ];
    const [{ Scene }, { Hud }, { createWorld }, { custody }, { applyCommand }, { bindControls }] =
      await Promise.all(modules.map((path) => import(path)));
    const world = createWorld(custody) as World;
    const selected = [world.agents[3].id],
      actions: Action[] = [];
    Object.assign(world.escort!, { recruited: true, x: 25, y: 15, leader: world.agents[0].id });
    world.escortLocked = false;
    Object.assign(world.agents[0], { x: 25, y: 15, carrying: true });
    Object.assign(world.agents[1], { x: 25, y: 14.5, hp: 20 });
    Object.assign(world.agents[2], { x: 25, y: 14, hp: 48 });
    world.agents[1].order = { kind: 'attack', target: world.guards[0].id };
    const action = (value: Action) => {
      actions.push(value);
      if (value === 'locate-escort') hud.focusObjectives();
      if (value === 'escort-wait') applyCommand(world, { kind: value });
      if (value === 'escort-aid')
        applyCommand(world, { kind: value, agents: world.agents.map((a) => a.id) });
      if (value.startsWith('heal:'))
        applyCommand(world, { kind: 'heal', agents: [world.agents[Number(value.slice(5))].id] });
      update();
    };
    const hud = new Hud(
      action,
      () => {},
      (targets: GuideTarget[], focus: boolean, panel: Rect) => {
        scene.showGuidance(targets, panel);
        if (focus) scene.focusGuidance();
      },
    );
    const scene = new Scene(hud.stage, world);
    const update = () =>
      hud.update(world, {
        selected,
        paused: true,
        slow: false,
        sound: false,
        best: 22,
        fullCrewBest: 40,
      });
    hud.reset(custody);
    update();
    await scene.init();
    scene.app.ticker.add(() => scene.render(selected, 1));
    bindControls(scene, hud, {
      world: () => world,
      selection: () => selected,
      select: () => {},
      order: (hit: Hit) => {
        if (hit.kind === 'ground')
          applyCommand(world, { kind: 'move', agents: selected, point: hit.point });
        update();
      },
      action,
      slow: () => {},
    });
    window.feedback = { world, hud, scene, update, actions };
    // Observe a hit before COMMS gets replaced by another normal notification.
    world.escort!.hp = 27;
    update();
    world.time += 1;
    world.message = 'Morrow opened the delivery gate.';
    update();
  });
}

async function aidFlow(page: Page, touch = false) {
  const use = async (selector: string) => {
    const button = page.locator(selector);
    if (touch) await button.tap();
    else await button.click();
  };
  await expect(page.locator('#escort-alert')).toHaveText('Mara under fire');
  await expect(page.locator('#message')).toHaveText('Morrow opened the delivery gate.');
  await expect(page.locator('#escort-controls')).toHaveClass(/under-fire/);
  await expect(page.locator('#escort-aid-button')).toHaveText("Treat Mara · Vale's dressing");
  await expect(page.locator('[data-agent="1"]')).toHaveClass(/wounded/);
  await expect(page.locator('#health-label-1')).toHaveText('20 / 100 HP');
  await expect(page.locator('#best')).toHaveText('Full crew: 00:40 · Any crew: 00:22');
  const orders = await page.evaluate(() => window.feedback.world.agents.map((a) => a.order));
  await use('#escort-focus');
  await expect(page.locator('[data-target="escort"] .locator-ring')).toBeVisible();
  await expect(page.locator('#guide-title')).toContainText('Mara');
  await page.evaluate(() => window.feedback.hud.clearGuide());
  await use('#escort-aid-button');
  await expect(page.locator('#escort-status')).toContainText('75 / 75');
  await expect(page.locator('#escort-aid-button')).toBeHidden();
  await expect(page.locator('#aid-1')).toBeHidden();
  await expect(page.locator('#health-label-1')).toHaveText('20 / 100 HP');
  await use('#aid-2');
  await expect(page.locator('#health-label-2')).toHaveText('100 / 100 HP');
  await expect(page.locator('.crew-aid:visible')).toHaveCount(0);
  if (touch) await use('#escort-wait-button');
  else {
    await page.locator('#escort-wait-button').focus();
    await page.keyboard.press('Space');
  }
  await expect(page.locator('#escort-status')).toContainText('waiting');
  await use('#escort-wait-button');
  await expect(page.locator('#escort-status')).toContainText('following');
  await expect(page.locator('[data-agent="3"]')).toHaveAttribute('aria-pressed', 'true');
  for (let i = 0; i < 3; i++)
    await expect(page.locator(`[data-agent="${i}"]`)).toHaveAttribute('aria-pressed', 'false');
  const result = await page.evaluate(() => ({
    orders: window.feedback.world.agents.map((a) => a.order),
    dressings: window.feedback.world.agents.map((a) => a.medkit),
    actions: window.feedback.actions,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(result.orders).toEqual(orders);
  expect(result.dressings).toEqual([true, false, false, true]);
  expect(result.actions).not.toContain('pause');
  expect(result.overflow).toBe(false);
  // The relocated controls and injury state leave ordinary map orders accessible.
  await page.locator('canvas').scrollIntoViewIfNeeded();
  const ground = await page.evaluate(async () => {
    const { scene, world } = window.feedback;
    scene.home();
    scene.render(
      world.agents.map((a) => a.id),
      1,
    );
    await new Promise(requestAnimationFrame);
    const p = scene.screen({ x: 6, y: 11 }),
      r = scene.app.canvas.getBoundingClientRect();
    return { x: r.x + p.x, y: r.y + p.y, kind: scene.hit(p.x, p.y).kind };
  });
  expect(ground.kind).toBe('ground');
  if (touch) await page.touchscreen.tap(ground.x, ground.y);
  else await page.mouse.click(ground.x, ground.y, { button: 'right' });
  expect(await page.evaluate(() => window.feedback.world.agents[3].order.kind)).toBe('move');
}

test('keeps witness danger visible and supports aid, locate and keyboard wait without cancelling orders', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await mountFeedback(page);
  await page.screenshot({ path: testInfo.outputPath('desktop-feedback.png') });
  await aidFlow(page);
  // No nearby dressing: a disabled action explains what is missing.
  await page.evaluate(() => {
    const { world, update } = window.feedback;
    world.escort!.hp = 40;
    world.time += 4;
    update();
  });
  await expect(page.locator('#escort-aid-button')).toBeDisabled();
  await expect(page.locator('#escort-aid-hint')).toContainText('free hands and a dressing');
  await page.evaluate(() => {
    window.feedback.world.time += 4;
    window.feedback.update();
  });
  await expect(page.locator('#escort-alert')).toHaveText('Locate Mara');
  // Direct targeting warns even before a fresh hit; cover suppresses stale targets.
  await page.evaluate(() => {
    const { world, update } = window.feedback;
    Object.assign(world.guards[0], { x: 24.5, y: 15, mode: 'combat', target: world.escort!.id });
    update();
  });
  await expect(page.locator('#escort-alert')).toHaveText('Mara under fire');
  await page.evaluate(() => {
    const { world, update } = window.feedback;
    Object.assign(world.guards[0], { x: 25, y: 12.7 });
    update();
  });
  await expect(page.locator('#escort-alert')).toHaveText('Locate Mara');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('keeps witness and first-aid actions usable by touch on a phone', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await mountFeedback(page);
  await page.screenshot({ path: testInfo.outputPath('phone-feedback.png'), fullPage: true });
  await expect(page.locator('#objective-group-primary #escort-controls')).toBeVisible();
  await expect(page.locator('#objective-group-extract #extraction-controls')).toBeVisible();
  for (const id of ['escort-focus', 'escort-wait-button', 'escort-aid-button', 'aid-1', 'aid-2'])
    expect((await page.locator(`#${id}`).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await aidFlow(page, true);
  expect(errors).toEqual([]);
  await context.close();
});
