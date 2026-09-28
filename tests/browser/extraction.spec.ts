import { expect, test } from '@playwright/test';

test('explains why a whole-crew rally must wait for the held archive shutter', async ({ page }) => {
  // Mount the production HUD with a controlled doorway state, without a running game loop.
  await page.route('**/extraction-hud', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<div id="app"></div>',
    }),
  );
  await page.goto('/extraction-hud');
  const result = await page.evaluate(async () => {
    const modules = [
      '/src/ui/hud.ts',
      '/src/sim/world.ts',
      '/src/content/archive.ts',
      '/src/sim/orders.ts',
    ];
    const [{ Hud }, { createWorld }, { archive }, { completeInteraction, landmark }] =
      await Promise.all(modules.map((path) => import(path)));
    const w = createWorld(archive),
      carrier = w.agents[0],
      operator = w.agents[1];
    const actions: string[] = [];
    const hud = new Hud(
      (action: string) => actions.push(action),
      () => {},
      () => {},
    );
    hud.reset(archive);
    const shunt = landmark(w, 'override');
    Object.assign(operator, { x: shunt.x, y: shunt.y });
    completeInteraction(w, operator, 'override');
    Object.assign(carrier, { x: 26, y: 11.5, carrying: true });
    w.evidence = 'carried';
    const update = () =>
      hud.update(w, {
        selected: [carrier.id],
        paused: true,
        slow: false,
        sound: false,
        best: null,
      });
    update();
    const button = document.querySelector<HTMLButtonElement>('#exit-button-extract')!;
    const blocked = button.disabled,
      reason = document.querySelector('#exit-status-extract')!.textContent;
    button.click();
    const blockedActions = [...actions];
    carrier.y = 13;
    update();
    const enabled = !button.disabled;
    button.click();
    return { blocked, reason, blockedActions, enabled, actions, operatorOrder: operator.order };
  });
  expect(result.blocked).toBe(true);
  expect(result.reason).toContain('Move Morrow outside the archive');
  expect(result.reason).toContain('Keep SHUNT held');
  expect(result.blockedActions).toEqual([]);
  expect(result.enabled).toBe(true);
  expect(result.actions).toEqual(['extract:extract']);
  expect(result.operatorOrder).toEqual({ kind: 'interact', target: 'override' });
});

test('locked vehicle clicks explain the missing objective without issuing orders on mouse or touch @smoke', async ({
  browser,
}) => {
  for (const touch of [false, true]) {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 960 },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.getByRole('button', { name: 'Begin operation' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Extraction', exact: true })).toBeHidden();
    const map = (await page.locator('canvas').boundingBox())!;
    const scale = Math.min(map.width / (58 * 26 + 80), map.height / (58 * 14 + 110));
    // Aim at the van roof, away from its floating VAN marker.
    const x = map.x + map.width / 2 + ((3 - 22.1) * 26 - 3 * 26) * scale;
    const y = map.y + map.height / 2 + ((3 + 22.1) * 14 - 1.55 * 25 - 29 * 14 + 25) * scale;
    if (touch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y, { button: 'right' });
    await expect(page.locator('#message')).toContainText('Extraction locked: recruit Voss');
    for (let i = 0; i < 4; i++)
      await expect(page.locator(`#condition-${i}`)).toHaveText('Concealed');
    await expect(page.locator('#guide-detail')).toContainText('Extraction locked: recruit Voss');
    await expect(page.locator('canvas')).toHaveAttribute(
      'aria-description',
      'Highlighted mission items: VOSS, KIT.',
    );
    await expect(page.getByRole('button', { name: 'Rally crew to VAN', exact: true })).toBeHidden();
    await expect(page.locator('#pause-label')).toHaveText('Resume');
    await expect(page.locator('#selected-count')).toHaveText('4 / 4');
    await expect(page.getByRole('dialog', { name: 'Account settled.' })).toBeHidden();
    expect(errors).toEqual([]);
    await context.close();
  }
});

test('picks the nearest overlapping marker and maps both custody vehicles to the correct exit', async ({
  page,
}) => {
  await page.goto('/');
  const hits = await page.evaluate(async () => {
    const sceneModule = '/src/render/scene.ts',
      worldModule = '/src/sim/world.ts',
      missionsModule = '/src/content/missions.ts';
    const [{ Scene }, { createWorld }, { missions }] = await Promise.all([
      import(sceneModule),
      import(worldModule),
      import(missionsModule),
    ]);
    const result: string[] = [];
    for (const mission of missions) {
      const world = createWorld(mission);
      const scene = new Scene(document.createElement('div'), world);
      const exits = mission.landmarks.filter(
        (o: { id: string }) => o.id === 'extract' || o.id === 'alternate',
      );
      for (const exit of exits) {
        // A witness marker just beside VAN must not steal a click on VAN itself.
        if (world.escort)
          Object.assign(world.escort, { x: exit.x + 0.2, y: exit.y, recruited: true });
        const marker = scene.screen(exit, 1.45);
        result.push(scene.hit(marker.x, marker.y, true).id);
      }
      for (const van of mission.solids.filter((s: { kind: string }) => s.kind === 'van')) {
        const roof = scene.screen({ x: van.x + van.w / 2, y: van.y + van.h / 3 }, van.height);
        result.push(scene.hit(roof.x, roof.y, true).id);
      }
    }
    return result;
  });
  expect(hits).toEqual([
    'extract',
    'extract', // depot marker and vehicle
    'extract',
    'extract', // archive
    'extract',
    'extract', // transfer
    'extract',
    'alternate',
    'alternate',
    'extract', // custody markers, service van, street van
    'extract',
    'extract', // broadcast marker and vehicle
    'extract',
    'extract', // severance marker and vehicle
    'extract',
    'extract', // clearinghouse marker and vehicle
    'extract',
    'extract', // authorisation works marker and vehicle
  ]);
});
