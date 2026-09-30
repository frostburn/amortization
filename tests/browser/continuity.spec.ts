import { expect, test } from '@playwright/test';
import type { World } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';

declare global {
  interface Window {
    continuityWorld: World;
    continuityScene: Scene;
  }
}
// Browser plugin not available. Operations -> Continuity -> stairs -> custody -> exit.
// Combat viability is covered by the unmodified guarded command runs in continuity.test.ts.
for (const touch of [false, true])
  test(`Continuity ${touch ? 'touch' : 'desktop'}: floors, split selection and arrest`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 960 },
      hasTouch: touch,
      isMobile: touch,
    });
    await context.grantPermissions(['local-network-access'], { origin: 'http://127.0.0.1:4173' });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route(/\/src\/sim\/world\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/sim/world.ts?original'; import { createWorld as original } from '/src/sim/world.ts?original'; export function createWorld(m) { return window.continuityWorld = original(m); }`,
      }),
    );
    await page.route(/\/src\/render\/scene\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/render/scene.ts?original'; import { Scene as Original } from '/src/render/scene.ts?original'; export class Scene extends Original { constructor(...args) { super(...args); window.continuityScene = this; } }`,
      }),
    );
    const press = (s: string) => (touch ? page.locator(s).tap() : page.locator(s).click());
    const capture = async (name: string) => {
      await page.locator('#stage').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
    };
    const advance = (n: number) =>
      page.evaluate(async (n) => {
        const path = '/src/sim/step.ts',
          { step } = await import(path);
        for (let i = 0; i < n; i++) step(window.continuityWorld);
      }, n);
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await press('dialog [data-action="operations"]');
    await press('[data-action="mission:continuity"]');
    await expect(page.locator('.briefing-orders')).toContainText('upper control room');
    await expect(page.locator('.briefing-routes')).toBeHidden();
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'day');
    await press('[data-action="home"]');
    await capture('exterior');
    await press('[data-agent="0"]');
    await press('[data-action="follow"]');
    // Place just inside the staff entrance; no state mutations during the transitions themselves.
    await page.evaluate(() => {
      const w = window.continuityWorld;
      w.guards = [];
      Object.assign(w.agents[0], { x: 25, y: 19, previous: { x: 25, y: 19 } });
    });
    await press('[data-action="follow"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '0');
    await expect
      .poll(() =>
        page.evaluate(() => (window.continuityScene as unknown as { roofAlpha: number }).roofAlpha),
      )
      .toBeLessThan(0.03);
    await capture('ground');
    // Click the projected stair marker, exactly as a player would.
    await page.locator('#stage').scrollIntoViewIfNeeded();
    const clickMarker = async (id: 'stairs-up' | 'stairs-down') => {
      const p = await page.evaluate((id) => window.continuityScene.markerScreen(id)!, id);
      const bounds = (await page.locator('canvas').boundingBox())!;
      if (touch) await page.touchscreen.tap(bounds.x + p.x, bounds.y + p.y);
      else await page.mouse.click(bounds.x + p.x, bounds.y + p.y, { button: 'right' });
    };
    await clickMarker('stairs-up');
    await advance(120);
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '1');
    await expect(page.locator('#condition-0')).toContainText('UPPER');
    await expect
      .poll(() =>
        page.evaluate(
          () => (window.continuityScene as unknown as { upperAlpha: number }).upperAlpha,
        ),
      )
      .toBeGreaterThan(0.97);
    await capture('upper');
    const visible = await page.evaluate(() => {
      const s = window.continuityScene,
        w = window.continuityWorld,
        p = s.screen(w.agents[0]);
      const point = s.toWorld(p.x, p.y);
      return {
        floor: point.floor,
        x: point.x,
        agentX: w.agents[0].x,
        visible: p.x > 0 && p.x < s.app.screen.width && p.y > 0 && p.y < s.app.screen.height,
      };
    });
    expect(visible.floor).toBe(1);
    expect(visible.x).toBeCloseTo(visible.agentX);
    expect(visible.visible).toBe(true);
    await press('[data-agent="1"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '0');
    await press('[data-agent="0"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '1');
    await expect(page.locator('#arrest-principal')).toBeDisabled();
    await page.evaluate(() => {
      const w = window.continuityWorld;
      w.security!.isolated = ['power-west', 'power-east'];
      Object.assign(w.agents[0], { x: 47, y: 23, previous: { x: 47, y: 23, floor: 1 } });
    });
    await press('[data-action="follow"]');
    await press('#arrest-principal');
    await advance(140);
    await expect(page.locator('#objective-primary')).toHaveText('✓ Kestrel in handcuffs');
    await capture('custody');
    await press('#stairs-down-button');
    await advance(420);
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '0');
    expect(await page.evaluate(() => window.continuityWorld.escort!.floor ?? 0)).toBe(0);
    // Regroup around an upstairs lead must leave downstairs teammates in place,
    // and keep the lead's floor visible even though Morrow is first in the roster.
    await page.evaluate(() => {
      const w = window.continuityWorld;
      for (const [i, y] of [
        [2, 18],
        [3, 12],
      ])
        Object.assign(w.agents[i], {
          x: 26,
          y,
          floor: 1,
          previous: { x: 26, y, floor: 1 },
          order: { kind: 'hold' },
          path: [],
        });
    });
    await press('[data-agent="2"]');
    await press('[data-action="regroup"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '1');
    expect(await page.evaluate(() => window.continuityWorld.agents.map((a) => a.order))).toEqual([
      { kind: 'hold' },
      { kind: 'hold' },
      expect.objectContaining({ kind: 'move', target: expect.objectContaining({ floor: 1 }) }),
      expect.objectContaining({ kind: 'move', target: expect.objectContaining({ floor: 1 }) }),
    ]);
    await advance(90);
    expect(await page.evaluate(() => window.continuityWorld.agents[3].y)).toBeGreaterThan(14);
    // Ordering onto a teammate's body also preserves the target's floor.
    await page.evaluate(() => {
      Object.assign(window.continuityWorld.agents[2], {
        x: 30,
        y: 21,
        previous: { x: 30, y: 21, floor: 1 },
        order: { kind: 'hold' },
        path: [],
      });
    });
    await press('[data-agent="3"]');
    await page.locator('#stage').scrollIntoViewIfNeeded();
    const target = await page.evaluate(() =>
      window.continuityScene.screen(window.continuityWorld.agents[2], 0.5),
    );
    const canvas = (await page.locator('canvas').boundingBox())!;
    if (touch) await page.touchscreen.tap(canvas.x + target.x, canvas.y + target.y);
    else await page.mouse.click(canvas.x + target.x, canvas.y + target.y, { button: 'right' });
    expect(await page.evaluate(() => window.continuityWorld.agents[3].order)).toMatchObject({
      kind: 'move',
      target: { x: 30, y: 21, floor: 1 },
    });
    await advance(120);
    expect(await page.evaluate(() => window.continuityWorld.agents[3].x)).toBeCloseTo(30);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await context.close();
  });
