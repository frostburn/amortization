import { expect, test, type Page } from '@playwright/test';
import type { World, Rect } from '../../src/sim/types';
import type { Hud, Action } from '../../src/ui/hud';
import type { Scene } from '../../src/render/scene';
import type { Command } from '../../src/sim/commands';
import type { GuideTarget } from '../../src/ui/objectives';

declare global {
  interface Window {
    demolition: {
      world: World;
      hud: Hud;
      scene: Scene;
      advance: (seconds: number) => void;
      command: (command: Command) => void;
    };
  }
}

test('launches Severance, queues separate planters, and resets its controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Amortization');
  await page.getByRole('button', { name: 'Choose operation' }).click();
  await page.getByRole('button', { name: /06 .*Severance/ }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Completed charges stay armed without a timer',
  );
  await expect(page.locator('[data-loadout]')).toContainText('Rook — Shotgun; Sable — Carbine');
  await expect(page.locator('[data-loadout]')).toContainText('Morrow or Vale can take KIT');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await page.getByRole('button', { name: 'Plant WEST', exact: true }).click();
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  await page.getByRole('button', { name: 'Plant EAST', exact: true }).click();
  await expect(page.locator('#charge-west-status')).toHaveText('Morrow · approaching');
  await expect(page.locator('#charge-east-status')).toHaveText('Vale · approaching');
  await expect(
    page.getByRole('button', { name: 'Detonate both cores', exact: true }),
  ).toBeDisabled();
  await page.locator('#objective-primary').hover();
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-description',
    'Highlighted mission items: WEST, EAST, KIT.',
  );
  await expect(page.locator('#guide-detail')).toContainText('five seconds each');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#objective-primary')).toHaveText('○ Plant charges · 0 / 2');
  await expect(page.locator('#charge-west-status')).toHaveText('5s · free hands');
  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  await page.getByRole('button', { name: /05 .*Public offering/ }).click();
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await expect(page.locator('#demolition-controls')).toBeHidden();
  await expect(page.locator('#broadcast-controls')).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

async function mountDemolition(page: Page) {
  await page.route('**/demolition-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
    }),
  );
  await page.goto('http://127.0.0.1:4173/demolition-fixture');
  await page.evaluate(async () => {
    const paths = [
      '/src/ui/hud.ts',
      '/src/render/scene.ts',
      '/src/sim/world.ts',
      '/src/content/severance.ts',
      '/src/sim/commands.ts',
      '/src/sim/step.ts',
    ];
    const [{ Hud }, { Scene }, { createWorld }, { severance }, { applyCommand }, { step, STEP }] =
      await Promise.all(paths.map((p) => import(p)));
    const world = createWorld(severance) as World;
    // Controlled UI states; the simulation suite retains every guard in both full routes.
    world.guards = [];
    world.relayOff = true;
    world.gateOpen = true;
    for (const [index, id] of [
      [0, 'charge-west'],
      [1, 'charge-east'],
    ] as const) {
      const p = world.mission.landmarks.find((o) => o.id === id)!;
      Object.assign(world.agents[index], { x: p.x, y: p.y, previous: { x: p.x, y: p.y } });
    }
    Object.assign(world.agents[2], { x: 18.4, y: 5.6, previous: { x: 18.4, y: 5.6 } });
    world.agents[3].carrying = true;
    world.evidence = 'carried';
    let selected = [world.agents[0].id];
    const update = () =>
      hud.update(world, { selected, paused: true, slow: false, sound: false, best: null });
    const command = (c: Command) => {
      applyCommand(world, c);
      update();
    };
    const hud = new Hud(
      (action: Action) => {
        if (action === 'plant:charge-west' || action === 'plant:charge-east')
          command({
            kind: 'interact',
            agents: selected,
            target: action === 'plant:charge-west' ? 'charge-west' : 'charge-east',
          });
        if (action === 'detonate') command({ kind: 'detonate' });
        if (action === 'extract:extract')
          command({ kind: 'interact', agents: world.agents.map((a) => a.id), target: 'extract' });
      },
      (index: number) => {
        selected = [world.agents[index].id];
        update();
      },
      (targets: GuideTarget[], focus: boolean, panel: Rect) => {
        scene.showGuidance(targets, panel);
        if (focus) scene.focusGuidance();
      },
    );
    const scene = new Scene(hud.stage, world);
    hud.reset(severance);
    update();
    await scene.init();
    scene.app.ticker.add(() => scene.render(selected, 1));
    window.demolition = {
      world,
      hud,
      scene,
      command,
      advance: (seconds: number) => {
        for (let i = 0; i < Math.round(seconds / STEP); i++) step(world);
        update();
      },
    };
  });
}

test('shows planting, unsafe crew, detonation and extraction on laptop and phone', async ({
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
    await mountDemolition(page);
    const fits = async () => {
      if (phone)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      else
        for (const selector of ['.crew-sidebar', '.mission-sidebar'])
          expect(
            await page.locator(selector).evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
          ).toBe(true);
    };
    const click = async (name: string) => {
      const button = page.getByRole('button', { name, exact: true });
      if (phone) await button.tap();
      else await button.click();
    };
    await expect(page.getByRole('button', { name: 'VAN locked', exact: true })).toBeDisabled();
    for (const selector of ['#charge-west-button', '#charge-east-button', '#detonate-button'])
      expect((await page.locator(selector).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await click('Plant WEST');
    await page.evaluate(() => window.demolition.advance(2));
    await click('Select Vale');
    await click('Plant EAST');
    await page.evaluate(() => window.demolition.advance(3.1));
    await expect(page.getByRole('button', { name: 'WEST armed', exact: true })).toBeDisabled();
    await expect(page.locator('#charge-east-status')).toContainText('Vale ·');
    await page.evaluate(() => window.demolition.advance(2.1));
    await expect(page.locator('#detonation-status')).toContainText('Morrow, Vale, Rook');
    await expect(
      page.getByRole('button', { name: 'Detonate both cores', exact: true }),
    ).toBeDisabled();
    await fits();
    if (!phone) await page.screenshot({ path: testInfo.outputPath('laptop-armed.png') });
    await page.evaluate(() => {
      window.demolition.command({
        kind: 'move',
        agents: ['agent-0', 'agent-1'],
        point: { x: 24, y: 14 },
      });
      window.demolition.advance(12);
    });
    await expect(page.locator('#detonation-status')).toContainText('Move Rook outside');
    await expect(page.locator('#detonation-status')).not.toContainText('Morrow');
    await page.locator('#objective-primary')[phone ? 'tap' : 'click']();
    await expect(page.locator('#guide-detail')).toContainText('including unselected operatives');
    await click('Locate WEST');
    await expect(page.locator('[data-target="charge-west"]')).not.toHaveClass(/is-offscreen/);
    if (phone) await page.screenshot({ path: testInfo.outputPath('phone-blast-guide.png') });
    await click('Close mission guide');
    await page.evaluate(() => {
      window.demolition.command({ kind: 'move', agents: ['agent-2'], point: { x: 18, y: 14 } });
      window.demolition.advance(4);
    });
    await expect(
      page.getByRole('button', { name: 'Detonate both cores', exact: true }),
    ).toBeEnabled();
    if (phone) await click('Detonate both cores');
    else {
      await page.getByRole('button', { name: 'Detonate both cores', exact: true }).focus();
      await page.keyboard.press('Space');
    }
    await page.evaluate(() => window.demolition.advance(1));
    await expect(page.locator('#objective-primary')).toHaveText('✓ Debt backups destroyed');
    await expect(page.locator('#plant-actions')).toBeHidden();
    await fits();
    if (!phone) {
      await page.locator('[data-action="home"]').evaluate(() => window.demolition.scene.home());
      await page.screenshot({ path: testInfo.outputPath('laptop-destroyed.png') });
    }
    await click('Rally crew to VAN');
    await page.evaluate(() => window.demolition.advance(60));
    expect(await page.evaluate(() => window.demolition.world.status)).toBe('won');
    await page.evaluate(() =>
      window.demolition.hud.showEnd(window.demolition.world, {
        best: 100,
        fullCrewBest: 100,
        medals: [],
        completions: 1,
      }),
    );
    await expect(page.getByRole('dialog')).toContainText('The debt backups are gone.');
    await expect(page.getByRole('dialog')).toContainText('Optional register');
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  }
});
