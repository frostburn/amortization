import { expect, test } from '@playwright/test';
import type { World } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';

declare global {
  interface Window {
    countermandWorld: World;
    countermandScene: Scene;
  }
}
// Browser plugin not available. Validate through the repository's Playwright flow:
// Operations -> Countermand -> locate/carry/file RECALL -> unlock extraction.
for (const touch of [false, true]) {
  test(`Countermand: ${touch ? 'touch' : 'desktop'} objectives, equipment, filing and split camera`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      hasTouch: touch,
      isMobile: touch,
      deviceScaleFactor: touch ? 2 : 1,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route(/\/src\/sim\/world\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/sim/world.ts?original'; import { createWorld as original } from '/src/sim/world.ts?original'; export function createWorld(m) { return window.countermandWorld = original(m); }`,
      }),
    );
    await page.route(/\/src\/render\/scene\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/render/scene.ts?original'; import { Scene as Original } from '/src/render/scene.ts?original'; export class Scene extends Original { constructor(...args) { super(...args); window.countermandScene = this; } }`,
      }),
    );
    const press = (selector: string) =>
      touch ? page.locator(selector).tap() : page.locator(selector).click();
    const capture = async (name: string) => {
      await page.locator('#stage').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `${process.env.AMORTIZATION_QA_DIR ?? '/tmp'}/countermand-${touch ? 'touch' : 'desktop'}-${name}.png`,
      });
    };
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await press('dialog [data-action="operations"]');
    await press('[data-action="mission:countermand"]');
    const dialog = page.locator('#mission-dialog');
    await expect(dialog.locator('.briefing-orders')).toContainText('nine uninterrupted seconds');
    await expect(dialog.locator('.briefing-routes')).toBeHidden();
    const rect = (await dialog.boundingBox())!;
    expect(rect.height).toBeLessThanOrEqual(660);
    await expect(dialog.locator('[data-action="begin"]')).toBeInViewport({ ratio: 1 });
    await dialog.getByText('Equipment & controls', { exact: true }).click();
    await expect(dialog.locator('[data-loadout]')).toContainText('Support gun');
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'day');
    await expect(page.locator('#recall-button')).toBeDisabled();
    const scale = await page.evaluate(() => window.countermandScene.camera.scale.x);
    expect(scale).toBeGreaterThan(0.75);
    await capture('follow');
    await press('#objective-primary');
    await expect(page.locator('#guide-locations')).toContainText('RECALL');
    await press('[data-dismiss-guide]');
    await press('[data-action="home"]');
    await capture('overview');
    // Presentation fixture: live, unmodified guarded completions are in the sim suite.
    await page.evaluate(() => {
      const w = window.countermandWorld;
      const file = w.mission.landmarks.find((o) => o.id === 'file-recall')!;
      Object.assign(w.agents[0], {
        x: file.x,
        y: file.y,
        previous: { x: file.x, y: file.y },
        carrying: true,
      });
      w.evidence = 'carried';
      w.guards = [];
    });
    await press('[data-action="follow"]');
    await press('[data-agent="0"]');
    await expect(page.locator('#recall-button')).toBeEnabled();
    await expect(page.locator('#objective-primary')).toHaveText('○ Bring RECALL to FILE');
    const snapped = await page.evaluate(() => {
      const s = window.countermandScene,
        p = s.screen(window.countermandWorld.agents[0]);
      return {
        x: p.x,
        y: p.y,
        w: s.app.screen.width,
        h: s.app.screen.height,
        scale: s.camera.scale.x,
      };
    });
    expect(snapped.x).toBeGreaterThan(0);
    expect(snapped.x).toBeLessThan(snapped.w);
    expect(snapped.y).toBeGreaterThan(0);
    expect(snapped.y).toBeLessThan(snapped.h);
    expect(snapped.scale).toBeCloseTo(scale, 1);
    await press('#recall-button');
    expect(await page.evaluate(() => window.countermandWorld.agents[0].order)).toEqual({
      kind: 'interact',
      target: 'file-recall',
    });
    const advance = async (ticks: number) =>
      page.evaluate(async (ticks) => {
        const path = '/src/sim/step.ts';
        const { step } = await import(path);
        for (let i = 0; i < ticks; i++) step(window.countermandWorld);
      }, ticks);
    await advance(90);
    await expect(page.locator('#recall-status')).toContainText('Morrow filing');
    await expect
      .poll(() => page.locator('#recall-progress').evaluate((e: HTMLProgressElement) => e.value))
      .toBeCloseTo(1 / 3, 2);
    await capture('filing');
    await press('[data-action="hold"]');
    await expect(page.locator('#recall-progress')).toHaveJSProperty('value', 0);
    await press('[data-agent="1"]');
    await expect(page.locator('#recall-button')).toBeDisabled();
    await press('[data-agent="0"]');
    await press('#recall-button');
    await advance(275);
    await expect(page.locator('#objective-primary')).toHaveText('✓ Seizure dispatches cancelled');
    await expect(page.locator('#recall-button')).toBeHidden();
    await expect(page.locator('#exit-button-extract')).toBeEnabled();
    await press('[data-action="drop"]');
    await expect(page.locator('#exit-button-extract')).toBeDisabled();
    await expect(page.locator('#exit-status-extract')).toContainText('carry RECALL');
    // Render the new full uniform palettes, shield, box magazine, pressure and fallen pose.
    await press('[data-agent="2"]');
    await page.evaluate(async () => {
      const paths = ['/src/sim/world.ts?original', '/src/content/countermand.ts'];
      const [{ createWorld }, { countermand }] = await Promise.all(paths.map((p) => import(p)));
      const source = createWorld(countermand) as World,
        w = window.countermandWorld;
      w.guards = source.guards.slice(0, 2);
      const posed = [w.agents[2], ...w.guards];
      for (const [i, p] of posed.entries()) {
        Object.assign(p, {
          x: 29 + i * 2.2,
          y: 43,
          previous: { x: 29 + i * 2.2, y: 43 },
          angle: Math.PI / 4,
          path: [],
        });
        if ('shield' in p && p.shield) p.shield.angle = Math.PI / 4;
      }
      w.agents[2].weapon = true;
      w.agents[2].pressure = 0.5;
      w.guards[1].pressure = 0.85;
      const s = window.countermandScene;
      s.showVision = false;
      s.render([w.agents[2].id], 1);
      s.zoomBy(2);
      const c = s.screen({ x: 31.2, y: 43 });
      s.panBy(s.app.screen.width / 2 - c.x, s.app.screen.height / 2 - c.y + 25);
    });
    const modelFrame = () =>
      page.evaluate(() => {
        const s = window.countermandScene;
        s.render([window.countermandWorld.agents[2].id], 1);
        s.app.render();
      });
    await modelFrame();
    await expect(page.locator('#condition-2')).toHaveText('Suppressed');
    await capture('equipment');
    await page.evaluate(() => {
      window.countermandWorld.guards[0].disoriented = 1;
    });
    await modelFrame();
    await capture('lowered-shield');
    await page.evaluate(() => {
      window.countermandWorld.guards[0].hp = 0;
    });
    await modelFrame();
    await capture('fallen-shield');
    await page.evaluate(() => {
      const w = window.countermandWorld,
        g = w.guards[0];
      g.hp = g.maxHp;
      delete g.disoriented;
      g.cooldown = 0.3;
      w.agents[2].cooldown = 0.1;
      w.agents[2].armament!.settle = 0;
      w.guards[1].cooldown = 0.1;
      w.guards[1].armament!.settle = 0;
      w.traces = [
        { from: { x: g.x, y: g.y }, to: { x: g.x + 4, y: g.y + 4 }, life: 0.1, hostile: true },
      ];
    });
    await modelFrame();
    await capture('firing');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await press('.topbar [data-action="operations"]');
    await press('[data-action="mission:depot"]');
    await press('[data-action="begin"]');
    await expect(page.locator('#recall-controls')).toBeHidden();
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'night');
    await context.close();
  });
}
