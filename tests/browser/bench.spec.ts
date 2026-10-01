import { expect, test } from '@playwright/test';
import type { World } from '../../src/sim/types';
import type { Scene } from '../../src/render/scene';

declare global {
  interface Window {
    benchWorld: World;
    benchScene: Scene;
  }
}

// Browser plugin unavailable: repository Playwright drives the real app.
// Presentation fixtures complement the unchanged, fully guarded command runs.
for (const touch of [false, true])
  test(`The Bench ${touch ? 'touch' : 'desktop'}: command, seals, custody and rooftop departure`, async ({
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
        body: `export * from '/src/sim/world.ts?original'; import {createWorld as original} from '/src/sim/world.ts?original'; export function createWorld(m) { return window.benchWorld=original(m); }`,
      }),
    );
    await page.route(/\/src\/render\/scene\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/render/scene.ts?original'; import {Scene as Original} from '/src/render/scene.ts?original'; export class Scene extends Original { constructor(...args) { super(...args); window.benchScene=this; } }`,
      }),
    );
    const press = (s: string) => (touch ? page.locator(s).tap() : page.locator(s).click());
    const advance = (n: number) =>
      page.evaluate(async (n) => {
        const path = '/src/sim/step.ts',
          { step } = await import(path);
        for (let i = 0; i < n; i++) step(window.benchWorld);
      }, n);
    const capture = async (name: string) => {
      await page.locator('#stage').scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
    };
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await press('dialog [data-action="operations"]');
    await press('[data-action="mission:bench"]');
    await expect(page.locator('.briefing-orders')).toContainText('Defeat Dacre');
    await expect(page.locator('.briefing-orders')).toContainText('rooftop HELI');
    await expect(page.locator('.briefing-routes')).toBeHidden();
    await expect(page.locator('dialog [data-action="begin"]')).toBeInViewport({ ratio: 1 });
    await press('[data-action="begin"]');
    await press('[data-action="pause"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'fluorescent');
    expect(await page.evaluate(() => window.benchScene.camera.scale.x)).toBeGreaterThan(0.75);
    await expect(page.locator('#arrest-principal')).toBeDisabled();
    await capture('arrival');
    await press('[data-action="home"]');
    await capture('tower-overview');
    await press('#objective-primary');
    await press('[data-locate-target="dacre"]');
    await press('[data-dismiss-guide]');
    await page.evaluate(() => {
      const w = window.benchWorld,
        b = w.guards[3];
      b.marshal!.target = { x: 27, y: 25 };
      b.marshal!.remaining = 1.7;
    });
    await expect(page.locator('.map-timer[data-target="dacre"]')).toContainText('Crossfire order');
    await capture('dacre');
    await page.evaluate(() => {
      const w = window.benchWorld;
      for (const g of w.guards) g.hp = 0;
      w.relayOff = true;
      for (const [i, id] of ['seal-west', 'seal-east'].entries()) {
        const p = w.mission.landmarks.find((o) => o.id === id)!;
        Object.assign(w.agents[i], { x: p.x, y: p.y, previous: { x: p.x, y: p.y } });
      }
    });
    await advance(1);
    await press('[data-agent="0"]');
    await press('[data-action="work:seal-west"]');
    await advance(30);
    await press('[data-agent="1"]');
    await press('[data-action="work:seal-east"]');
    await advance(60);
    await press('[data-action="follow"]');
    await expect(page.locator('.map-timer[data-target="seal-east"]')).toContainText('Held by Vale');
    await capture('seals');
    await advance(100);
    await expect(page.locator('#bench-status')).toHaveText('The Bench is open.');
    await press('[data-agent="0"]');
    await press('#arrest-principal');
    await advance(360);
    await expect(page.locator('#principal-status')).toContainText('Holt in custody');
    await expect(page.locator('#escort-wait-label')).toContainText('Severin Holt');
    await press('[data-action="follow"]');
    await capture('holt-cuffed');
    // Split-team switching is a real portrait interaction across the two storeys.
    await page.evaluate(() => {
      const w = window.benchWorld,
        a = w.agents[2],
        p = w.mission.building!.stairs[0];
      Object.assign(a, { x: p.x, y: p.y, previous: { x: p.x, y: p.y } });
    });
    await press('[data-agent="2"]');
    await press('#stairs-up-button');
    await advance(30);
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '1');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'sunset');
    await press('[data-agent="0"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '0');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'fluorescent');
    await press('[data-agent="2"]');
    await expect(page.locator('#stage')).toHaveAttribute('data-floor', '1');
    await expect(page.locator('#stage')).toHaveAttribute('data-theme', 'sunset');
    // Stage the already-tested walk to the helipad for close visual inspection.
    await page.evaluate(() => {
      const w = window.benchWorld;
      for (const [i, a] of w.agents.entries())
        Object.assign(a, {
          x: 37 + (i % 2),
          y: 18 + Math.floor(i / 2),
          floor: 1,
          previous: { x: 37 + (i % 2), y: 18 + Math.floor(i / 2), floor: 1 },
          order: { kind: 'hold' },
          path: [],
        });
      Object.assign(w.escort!, {
        x: 37,
        y: 20,
        floor: 1,
        previous: { x: 37, y: 20, floor: 1 },
        path: [],
      });
    });
    await press('[data-action="all"]');
    await press('[data-action="follow"]');
    await capture('helicopter');
    await expect(page.locator('#exit-button-extract')).toBeEnabled();
    await page.locator('#stage').scrollIntoViewIfNeeded();
    const helicopter = await page.evaluate(() => {
      const w = window.benchWorld,
        scene = window.benchScene;
      const p = scene.screen(w.mission.finale!.helicopter, 1.4);
      const box = document.querySelector('#stage')!.getBoundingClientRect();
      return { x: p.x + box.x, y: p.y + box.y, hit: scene.hit(p.x, p.y, true) };
    });
    expect(helicopter.hit).toEqual({ kind: 'object', id: 'extract' });
    if (touch) await page.touchscreen.tap(helicopter.x, helicopter.y);
    else await page.mouse.click(helicopter.x, helicopter.y, { button: 'right' });
    await advance(30);
    await expect(page.locator('#stage')).toHaveAttribute('data-aftermath', /boarding|departing/);
    await expect(page.locator('#mission-dialog')).toBeHidden();
    await expect(page.locator('#outcome-next')).toBeHidden();
    await press('#outcome-results');
    await expect(page.locator('#mission-dialog')).toContainText('The helicopter clears the tower.');
    await expect(page.locator('#mission-dialog .results')).toContainText('In custody');
    await expect(page.locator('dialog [data-action="restart"]')).toBeVisible();
    await expect(page.locator('dialog [data-action="next"]')).toHaveCount(0);
    if (touch) await page.touchscreen.tap(8, 8);
    else await page.mouse.click(8, 8);
    await expect(page.locator('#stage')).toHaveAttribute('data-aftermath', 'departed', {
      timeout: 15000,
    });
    expect(
      await page.evaluate(() => {
        const s = window.benchScene as unknown as {
          aftermath: { boarded: Set<string>; helicopterFlight: number; van: unknown };
        };
        return {
          boarded: s.aftermath.boarded.size,
          flight: s.aftermath.helicopterFlight,
          van: s.aftermath.van,
        };
      }),
    ).toEqual({ boarded: 5, flight: 1, van: undefined });
    await expect(page.locator('#mission-dialog')).toBeHidden();
    await capture('departed');
    await press('#outcome-results');
    await press('[data-action="story:bench"]');
    await expect(page.locator('#story-dialog')).toContainText('Off duty');
    await expect(page.locator('[data-story-sound]')).toHaveText('Sound off');
    const speakers = new Set<string>(),
      lines: string[] = [];
    const scene = page.locator('#story-dialog');
    while (await scene.isVisible()) {
      speakers.add((await scene.locator('.story-speaker').textContent())!);
      lines.push((await scene.locator('.story-readable').textContent())!);
      await press('#story-dialog .story-stage');
      if ((await scene.locator('.story-speaker').textContent()) === 'Rook') {
        await expect(scene.locator('.story-portrait')).toHaveCSS('background-position', '0% 100%');
        await page.screenshot({ path: testInfo.outputPath('homecoming-rook.png') });
      }
      await expect(scene.locator('[data-story-control="next"]')).toBeInViewport({ ratio: 1 });
      expect(await scene.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
      await press('[data-story-control="next"]');
    }
    expect([...speakers]).toEqual(['Iona Voss', 'Morrow', 'Vale', 'Rook', 'Sable', 'Ren Quill']);
    expect(lines.join(' ')).toContain('No one upstairs is giving orders anymore.');
    expect(lines.at(-1)).toContain('Glasses up.');
    await expect(page.locator('[data-story-entry="bench"]')).toContainText('Replay scene');
    if (!touch) {
      await press('dialog [data-action="restart"]');
      await press('[data-action="pause"]');
      await page.evaluate(() => {
        const w = window.benchWorld;
        for (const g of w.guards) g.hp = 0;
        w.finale!.open = true;
        w.relayOff = true;
        for (const [i, a] of w.agents.entries())
          Object.assign(a, {
            x: 36 + (i % 2),
            y: 13 + Math.floor(i / 2),
            previous: { x: 36 + (i % 2), y: 13 + Math.floor(i / 2) },
          });
      });
      await press('#attack-principal');
      expect(await page.evaluate(() => window.benchWorld.agents[0].order)).toEqual({
        kind: 'attack',
        target: 'holt',
      });
      await advance(180);
      await expect(page.locator('#principal-status')).toContainText('Holt eliminated');
      await page.evaluate(() => {
        const w = window.benchWorld;
        for (const a of w.agents)
          Object.assign(a, {
            x: 37.5,
            y: 18,
            floor: 1,
            previous: { x: 37.5, y: 18, floor: 1 },
            path: [],
            order: { kind: 'hold' },
          });
      });
      await press('[data-action="follow"]');
      await press('#exit-button-extract');
      await advance(30);
      await press('#outcome-results');
      await expect(page.locator('#mission-dialog .results')).toContainText('Eliminated');
      await expect(page.locator('#mission-dialog .results')).toContainText('4 / 4');
      await press('[data-story-entry="bench"]');
      for (let i = 0; i < 5; i++) {
        await press('#story-dialog .story-stage');
        await press('[data-story-control="next"]');
      }
      await expect(scene.locator('.story-speaker')).toHaveText('Ren Quill');
      await expect(scene.locator('.story-readable')).toContainText(
        'No one upstairs is giving orders anymore.',
      );
      await press('[data-story-control="close"]');
    }
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
    await context.close();
  });
