import { expect, test } from '@playwright/test';

test('orders the whole selection to the vehicle using either mouse or touch', async ({
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
    const map = (await page.locator('canvas').boundingBox())!;
    const scale = Math.min(map.width / (58 * 26 + 80), map.height / (58 * 14 + 110));
    // Aim at the van roof, away from its floating VAN marker.
    const x = map.x + map.width / 2 + ((3 - 22.1) * 26 - 3 * 26) * scale;
    const y = map.y + map.height / 2 + ((3 + 22.1) * 14 - 1.55 * 25 - 29 * 14 + 25) * scale;
    if (touch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y, { button: 'right' });
    await expect(page.locator('#message')).toContainText('Selected crew heading to VAN');
    for (let i = 0; i < 4; i++) await expect(page.locator(`#condition-${i}`)).toHaveText('Moving');
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.locator('#message')).toContainText('Bring Voss out alive', { timeout: 8000 });
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
  ]);
});
