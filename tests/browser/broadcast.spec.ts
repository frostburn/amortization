import { expect, test, type Page } from '@playwright/test';
import type { Scene } from '../../src/render/scene';
import type { World, Rect } from '../../src/sim/types';
import type { Hud, Action } from '../../src/ui/hud';
import type { GuideTarget } from '../../src/ui/objectives';

declare global {
  interface Window {
    transmission: { world: World; hud: Hud; scene: Scene; advance: (seconds: number) => void };
  }
}

test('launches operation five and keeps LOOP held when a different operative receives UPLINK', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose operation' }).click();
  await page.getByRole('button', { name: /05 .*Public offering/ }).click();
  await expect(page.getByRole('dialog')).toContainText('A patrol checks the server room');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  await page.getByRole('button', { name: 'Hold LOOP', exact: true }).click();
  await expect(page.locator('#broadcast-status')).toHaveText('LOOP held by Vale', {
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await page.getByRole('button', { name: 'Work UPLINK', exact: true }).click();
  await expect(page.locator('#condition-0')).toHaveText('Moving');
  await expect(page.locator('#condition-1')).toHaveText('Holding loop');
  await expect(page.locator('#broadcast-progress-label')).toHaveText('0% · Awaiting UPLINK');
  await page.locator('#objective-primary').hover();
  await expect(page.locator('#guide-detail')).toContainText('Vale holds LOOP');
  await expect(page.locator('canvas')).toHaveAttribute(
    'aria-description',
    'Highlighted mission items: LOOP, UPLINK, KIT.',
  );
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#mission-title')).toHaveText('Public offering');
  await expect(page.locator('#broadcast-status')).toContainText('LOOP open');
  await expect(page.locator('#broadcast-progress')).toHaveAttribute('value', '0');
  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  await page.getByRole('button', { name: /04 .*Protective custody/ }).click();
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await expect(page.locator('#broadcast-controls')).toBeHidden();
  expect(errors).toEqual([]);
});

async function mountTransmission(page: Page) {
  await page.route('**/transmission-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
    }),
  );
  await page.goto('http://127.0.0.1:4173/transmission-fixture');
  await page.evaluate(async () => {
    const paths = [
      '/src/render/scene.ts',
      '/src/ui/hud.ts',
      '/src/sim/world.ts',
      '/src/content/broadcast.ts',
      '/src/sim/commands.ts',
      '/src/sim/step.ts',
    ];
    const [{ Scene }, { Hud }, { createWorld }, { broadcast }, { applyCommand }, { step, STEP }] =
      await Promise.all(paths.map((path) => import(path)));
    const world = createWorld(broadcast) as World;
    // Controlled station positions exercise UI states; full live-patrol runs live in broadcast.test.ts.
    world.guards = [];
    for (const [index, id] of [
      [0, 'upload'],
      [1, 'mask'],
    ] as const) {
      const point = world.mission.landmarks.find((o) => o.id === id)!;
      world.agents[index].x = point.x;
      world.agents[index].y = point.y;
      world.agents[index].previous = { x: point.x, y: point.y };
    }
    let selected = ['agent-1'];
    const update = () =>
      hud.update(world, { selected, paused: true, slow: false, sound: false, best: null });
    const hud = new Hud(
      (action: Action) => {
        if (action === 'work:mask' || action === 'work:upload')
          applyCommand(world, { kind: 'interact', agents: selected, target: action.slice(5) });
        if (action === 'hold') applyCommand(world, { kind: 'hold', agents: selected });
        if (action === 'extract:extract')
          applyCommand(world, {
            kind: 'interact',
            agents: world.agents.map((a) => a.id),
            target: 'extract',
          });
        update();
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
    hud.reset(broadcast);
    update();
    await scene.init();
    scene.app.ticker.add(() => scene.render(selected, 1));
    window.transmission = {
      world,
      hud,
      scene,
      advance: (seconds: number) => {
        for (let i = 0; i < Math.round(seconds / STEP); i++) step(world);
        update();
      },
    };
  });
}

test('shows saved upload, trace and completion states without scrolling laptop mission actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mountTransmission(page);
  const fits = async () => {
    for (const selector of ['.crew-sidebar', '.mission-sidebar']) {
      expect(
        await page.locator(selector).evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);
    }
  };
  await page.getByRole('button', { name: 'Hold LOOP', exact: true }).click();
  await page.evaluate(() => window.transmission.advance(1));
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await page.getByRole('button', { name: 'Work UPLINK', exact: true }).click();
  await page.evaluate(() => window.transmission.advance(8));
  await expect(page.locator('#broadcast-progress-label')).toContainText('Morrow uploading');
  await expect(page.locator('#broadcast-status')).toHaveText('LOOP held by Vale');
  await fits();
  await page.locator('[data-action="hold"]').click();
  const saved = await page.locator('#broadcast-progress').getAttribute('value');
  await page.evaluate(() => window.transmission.advance(2));
  await expect(page.locator('#broadcast-progress-label')).toContainText('Paused · progress saved');
  await expect(page.locator('#broadcast-progress')).toHaveAttribute('value', saved!);
  await page.getByRole('button', { name: 'Select Vale', exact: true }).click();
  await page.locator('[data-action="hold"]').click();
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await page.getByRole('button', { name: 'Work UPLINK', exact: true }).click();
  await page.evaluate(() => window.transmission.advance(7));
  await expect(page.locator('#broadcast-status')).toHaveText('Signal traced · defend UPLINK');
  await expect(page.locator('#broadcast-status')).toHaveClass('danger');
  await expect(page.locator('#mask-button')).toBeDisabled();
  await fits();
  // Keep this a UI fixture after checking trace; live combat is verified separately.
  await page.evaluate(() => {
    window.transmission.world.relayOff = true;
    window.transmission.advance(14);
  });
  await expect(page.locator('#objective-primary')).toHaveText('✓ Audit published');
  await expect(page.locator('#broadcast-progress')).toHaveAttribute('value', '1');
  await expect(page.locator('#broadcast-actions')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Rally crew to VAN', exact: true })).toBeVisible();
  await fits();
  await page.evaluate(() => {
    const { world, hud } = window.transmission;
    world.status = 'won';
    hud.showEnd(world, { best: 100, fullCrewBest: 100, completions: 1 });
  });
  await expect(page.getByRole('dialog')).toContainText('The audit is public.');
  await expect(page.getByRole('dialog')).toContainText('Published');
  await expect(page.getByRole('dialog')).toContainText('Optional LOG');
  expect(errors).toEqual([]);
});

test('keeps transmission actions tappable and locators readable on a phone', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mountTransmission(page);
  await page.getByRole('button', { name: 'Hold LOOP', exact: true }).tap();
  await page.evaluate(() => window.transmission.advance(1));
  await expect(page.locator('#broadcast-status')).toHaveText('LOOP held by Vale');
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).tap();
  await page.getByRole('button', { name: 'Work UPLINK', exact: true }).tap();
  await page.evaluate(() => window.transmission.advance(3));
  await page.locator('#objective-primary').tap();
  await expect(page.locator('#objective-guide')).toBeInViewport();
  await page.getByRole('button', { name: 'Locate UPLINK', exact: true }).tap();
  await expect(page.locator('[data-target="upload"]')).not.toHaveClass(/is-offscreen/);
  await page.screenshot({ path: testInfo.outputPath('phone-transmission.png') });
  await expect(page.locator('#condition-1')).toHaveText('Holding loop');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Close mission guide' }).tap();
  for (const selector of ['#mask-button', '#upload-button'])
    expect((await page.locator(selector).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(errors).toEqual([]);
  await context.close();
});
