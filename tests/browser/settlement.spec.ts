import { expect, test } from '@playwright/test';
import type { World } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';

declare global {
  interface Window {
    settlementWorld: World;
    settlementScene: Scene;
  }
}
for (const touch of [false, true]) {
  test(`Value date: ${touch ? 'touch' : 'desktop'} daylight, progressive objectives and paired release`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      hasTouch: touch,
      isMobile: touch,
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
        body: `export * from '/src/sim/world.ts?original'; import { createWorld as original } from '/src/sim/world.ts?original'; export function createWorld(m) { return window.settlementWorld = original(m); }`,
      }),
    );
    await page.route(/\/src\/render\/scene\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/render/scene.ts?original'; import { Scene as Original } from '/src/render/scene.ts?original'; export class Scene extends Original { constructor(...args) { super(...args); window.settlementScene = this; } }`,
      }),
    );
    const press = (selector: string) =>
      touch ? page.locator(selector).tap() : page.locator(selector).click();
    const frame = () =>
      page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await press('dialog [data-action="operations"]');
    await press('[data-action="mission:settlement"]');
    await expect(page.locator('#mission-dialog')).toContainText(
      'Daylight extends human sight by 50%',
    );
    await expect(page.locator('.briefing-advice')).not.toHaveAttribute('open');
    await page.screenshot({ path: testInfo.outputPath('briefing.png') });
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'day');
    await expect(page.locator('#mission-title')).toHaveText('Value date');
    await expect(page.locator('#reconcile-button')).toBeDisabled();
    await expect(page.locator('#settlement-actions')).toBeHidden();
    const scale = await page.evaluate(() => window.settlementScene.camera.scale.x);
    expect(scale).toBeGreaterThan(0.75);
    await page.locator('#stage').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('daylight-follow.png') });
    await press('[data-action="home"]');
    await frame();
    await page.screenshot({ path: testInfo.outputPath('daylight-overview.png') });
    await press('#objective-primary');
    await expect(page.locator('#guide-locations')).toContainText('REGISTER');
    await press('[data-dismiss-guide]');
    await press('[data-action="follow"]');
    // Stage the genuine live world at the work areas, then issue real HUD commands.
    // Untouched guarded completions and exact replays are covered in the simulation suite.
    await page.evaluate(() => {
      const w = window.settlementWorld;
      w.guards = [];
      const p = w.mission.landmarks.find((o) => o.id === 'reconcile')!;
      Object.assign(w.agents[0], { x: p.x, y: p.y, previous: { x: p.x, y: p.y }, carrying: true });
      w.evidence = 'carried';
    });
    await press('[data-agent="0"]');
    await press('#reconcile-button');
    expect(await page.evaluate(() => window.settlementWorld.agents[0].order)).toEqual({
      kind: 'interact',
      target: 'reconcile',
    });
    await page.evaluate(async () => {
      const path = '/src/sim/step.ts';
      const { step } = await import(path);
      for (let i = 0; i < 190; i++) step(window.settlementWorld);
    });
    await expect(page.locator('#reconcile-button')).toBeHidden();
    await expect(page.locator('#settlement-actions')).toBeVisible();
    await expect(page.locator('#countersign-button')).toBeDisabled();
    await expect(page.locator('#settle-button')).toBeEnabled();
    await page.evaluate(() => {
      const w = window.settlementWorld;
      for (const [i, target] of [
        [0, 'settle'],
        [1, 'countersign'],
      ] as const) {
        const p = w.mission.landmarks.find((o) => o.id === target)!;
        Object.assign(w.agents[i], { x: p.x, y: p.y, previous: { x: p.x, y: p.y } });
      }
    });
    await press('#settle-button');
    await press('[data-agent="1"]');
    await expect(page.locator('#settle-button')).toBeDisabled();
    await press('#countersign-button');
    await page.evaluate(async () => {
      const path = '/src/sim/step.ts';
      const { step } = await import(path);
      for (let i = 0; i < 90; i++) step(window.settlementWorld);
    });
    await expect(page.locator('#settlement-status')).toContainText('Vale countersigns for Morrow');
    const progress = await page.evaluate(() => window.settlementWorld.settlement!.progress);
    expect(progress).toBeGreaterThan(1);
    await press('[data-action="hold"]');
    expect(await page.evaluate(() => window.settlementWorld.settlement!.signer)).toBeNull();
    await expect(page.locator('#settlement-status')).toContainText('Send a separate operative');
    await press('#countersign-button');
    await page.evaluate(async () => {
      const path = '/src/sim/step.ts';
      const { step } = await import(path);
      for (let i = 0; i < 420; i++) step(window.settlementWorld);
    });
    await expect(page.locator('#objective-primary')).toContainText('Repayments released');
    await expect(page.locator('#settlement-actions')).toBeHidden();
    await expect(page.locator('#exit-button-extract')).toBeEnabled();
    await expect(page.locator('#mission-outcome')).toBeHidden();
    // Camera selection keeps the daytime scale when switching across the split team.
    await press('[data-agent="0"]');
    expect(await page.evaluate(() => window.settlementScene.camera.scale.x)).toBeCloseTo(scale, 1);
    await page.locator('#stage').scrollIntoViewIfNeeded();
    await frame();
    await page.screenshot({ path: testInfo.outputPath('repayments-released.png') });
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await press('.topbar [data-action="operations"]');
    await press('[data-action="mission:depot"]');
    await press('[data-action="begin"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'night');
    expect(errors).toEqual([]);
    await context.close();
  });
}
