import { expect, test } from '@playwright/test';
import type { World } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';

declare global {
  interface Window {
    thresholdWorld: World;
    thresholdScene: Scene;
  }
}

// Browser plugin unavailable: use the repository's real app with Playwright.
// These presentation fixtures complement the unmodified guarded command runs.
for (const touch of [false, true])
  test(`Threshold ${touch ? 'touch' : 'desktop'}: sunset, key guidance and lift departure`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120000);
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
        body: `export * from '/src/sim/world.ts?original'; import { createWorld as original } from '/src/sim/world.ts?original'; export function createWorld(m) { return window.thresholdWorld = original(m); }`,
      }),
    );
    await page.route(/\/src\/render\/scene\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/render/scene.ts?original'; import { Scene as Original } from '/src/render/scene.ts?original'; export class Scene extends Original { constructor(...args) { super(...args); window.thresholdScene = this; } }`,
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
        for (let i = 0; i < n; i++) step(window.thresholdWorld);
      }, n);
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await press('dialog [data-action="operations"]');
    await press('[data-action="mission:threshold"]');
    await expect(page.locator('.briefing-orders')).toContainText('Board LIFT with KEY');
    await expect(page.locator('.briefing-optional')).toHaveCount(0);
    await expect(page.locator('.briefing-rules')).toContainText('night sight ranges');
    await expect(page.locator('.briefing-routes')).toBeHidden();
    await expect(page.locator('dialog [data-action="begin"]')).toBeInViewport({ ratio: 1 });
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'sunset');
    expect(await page.evaluate(() => window.thresholdScene.camera.scale.x)).toBeGreaterThan(0.75);
    await expect(page.locator('#lift-button')).toBeDisabled();
    await expect(page.locator('#exit-button-extract')).toBeDisabled();
    await capture('arrival');
    await press('#objective-primary');
    await expect(page.locator('#guide-locations')).toContainText('KEY');
    await expect(page.locator('#guide-locations')).toContainText('LINK');
    await press('[data-dismiss-guide]');
    await press('[data-action="home"]');
    await capture('overview');
    await page.evaluate(() => {
      const w = window.thresholdWorld;
      w.guards = [];
      w.alarm = true;
      w.alarmTime = w.time;
      Object.assign(w.agents[0], { x: 22.5, y: 9, previous: { x: 22.5, y: 9 } });
    });
    await press('[data-agent="0"]');
    await press('[data-action="follow"]');
    const radio = page.locator('.map-timer[data-target="relay"]');
    await expect(radio).toContainText('Patrol 1');
    await expect(radio).toContainText('6.0s');
    const orderRadio = await page.evaluate(() => {
      const p = window.thresholdScene.markerScreen('relay')!;
      const box = document.querySelector('#stage')!.getBoundingClientRect();
      return { x: p.x + box.x, y: p.y + box.y };
    });
    if (touch) await page.touchscreen.tap(orderRadio.x, orderRadio.y);
    else await page.mouse.click(orderRadio.x, orderRadio.y, { button: 'right' });
    expect(await page.evaluate(() => window.thresholdWorld.agents[0].order)).toEqual({
      kind: 'interact',
      target: 'relay',
    });
    await advance(60);
    await expect(radio).toContainText('Disable');
    await expect(radio.locator('b')).toHaveText(['4.0s', '3.0s']);
    expect(
      await radio.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.tagName;
      }),
    ).toBe('CANVAS');
    await capture('radio-timers');
    const width = (await radio.boundingBox())!.width;
    await press('[data-action="zoom-in"]');
    await expect(radio).toHaveCSS('width', `${width}px`);
    // Rendering and camera changes cannot advance a paused simulation timer.
    await expect(radio.locator('b')).toHaveText(['4.0s', '3.0s']);
    await page.evaluate(() => {
      const scene = window.thresholdScene;
      scene.panBy(0, 10 - scene.markerScreen('relay')!.y);
    });
    // A marker at the upper map edge places its card below, never over the diamond.
    await expect
      .poll(async () => {
        const box = await radio.boundingBox();
        const anchor = await page.evaluate(
          () =>
            window.thresholdScene.markerScreen('relay')!.y +
            document.querySelector('#stage')!.getBoundingClientRect().y,
        );
        return !!box && box.y > anchor;
      })
      .toBe(true);
    await press('[data-action="follow"]');
    await advance(95);
    await expect(radio).toHaveCount(0);
    await expect(page.locator('#archive-escape')).toBeVisible();
    await press('#archive-cut-button');
    await advance(150);
    const cut = page.locator('.map-timer[data-target="breach"]');
    await expect(cut).toContainText('Cut lock');
    await capture('inside-cut-timer');
    await advance(220);
    await expect(cut).toHaveCount(0);
    expect(await page.evaluate(() => window.thresholdWorld.shutterBreached)).toBe(true);
    await page.evaluate(() => {
      const w = window.thresholdWorld,
        link = w.mission.landmarks.find((o) => o.id === 'key-lift')!;
      w.guards = [];
      Object.assign(w.agents[0], {
        x: link.x,
        y: link.y,
        previous: { x: link.x, y: link.y },
        carrying: true,
      });
      w.evidence = 'carried';
    });
    await press('[data-agent="1"]');
    await expect(page.locator('#lift-button')).toBeDisabled();
    await press('[data-agent="0"]');
    await expect(page.locator('#lift-button')).toBeEnabled();
    await press('[data-action="follow"]');
    await capture('lobby-closed');
    await press('#lift-button');
    expect(await page.evaluate(() => window.thresholdWorld.agents[0].order)).toEqual({
      kind: 'interact',
      target: 'key-lift',
    });
    await advance(60);
    await expect(page.locator('.map-timer[data-target="key-lift"]')).toContainText('Link key');
    await capture('link-timer');
    await advance(95);
    await expect(page.locator('.map-timer[data-target="key-lift"]')).toHaveCount(0);
    await expect(page.locator('#lift-button')).toBeHidden();
    await expect(page.locator('#objective-primary')).toContainText('Lift arriving');
    await expect(page.locator('#exit-button-extract')).toBeDisabled();
    // LIFT lies beyond the narrow phone viewport when following the LINK worker.
    // Use the player's locator to bring the actual destination onto the map.
    await press('#objective-primary');
    await press('[data-locate-target="extract"]');
    await expect(page.locator('.objective-locator[data-target="extract"]')).toHaveClass(
      /has-timer/,
    );
    await press('[data-dismiss-guide]');
    await expect(page.locator('.map-timer[data-target="extract"]')).toContainText('Arrives');
    await capture('lift-timer');
    await advance(550);
    await expect(page.locator('#objective-primary')).toContainText('Service lift ready');
    await expect(page.locator('#exit-button-extract')).toBeEnabled();
    await expect(page.locator('.map-timer[data-target="extract"]')).toContainText('Open · waiting');
    await press('[data-action="drop"]');
    await expect(page.locator('#exit-button-extract')).toBeDisabled();
    await expect(page.locator('#exit-status-extract')).toContainText('carry KEY');
    // E uses the nearest actionable object: the dropped physical key at LINK.
    await press('[data-action="interact"]');
    await advance(30);
    await expect(page.locator('#exit-button-extract')).toBeEnabled();
    await page.evaluate(() => {
      const w = window.thresholdWorld;
      for (const [i, a] of w.agents.entries())
        Object.assign(a, {
          x: 47 + (i % 2),
          y: 8.3 + Math.floor(i / 2),
          previous: { x: 47 + (i % 2), y: 8.3 + Math.floor(i / 2) },
          order: { kind: 'hold' },
          path: [],
        });
    });
    await press('[data-action="all"]');
    await press('[data-action="follow"]');
    await capture('lobby-open');
    await press('#exit-button-extract');
    await advance(30);
    await expect(page.locator('#stage')).toHaveAttribute('data-aftermath', /boarding|departing/);
    await expect(page.locator('.map-timer')).toHaveCount(0);
    await expect(page.locator('#mission-dialog')).toBeHidden();
    await press('#outcome-results');
    await expect(page.locator('#mission-dialog')).toContainText('Dacre has joined Holt');
    if (touch) await page.touchscreen.tap(8, 8);
    else await page.mouse.click(8, 8);
    await expect(page.locator('#stage')).toHaveAttribute('data-aftermath', 'departed', {
      timeout: 12000,
    });
    await expect(page.locator('#mission-dialog')).toBeHidden();
    await capture('departure');
    const outcome = await page.evaluate(() => {
      const s = window.thresholdScene as unknown as {
        aftermath: { liftClosed: number; van: unknown; boarded: Set<string> };
      };
      return {
        closed: s.aftermath.liftClosed,
        van: s.aftermath.van,
        boarded: s.aftermath.boarded.size,
      };
    });
    expect(outcome).toEqual({ closed: 1, van: undefined, boarded: 4 });
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await context.close();
  });
