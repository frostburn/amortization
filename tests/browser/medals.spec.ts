import { expect, test } from '@playwright/test';
import type { Hud } from '../../src/ui/hud';
import type { World } from '../../src/sim/types';

for (const touch of [false, true]) {
  test(`Operations medals: ${touch ? 'touch' : 'desktop'} migration, tooltips and mission launch`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 960 },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        'amortization.records.v3',
        JSON.stringify({
          version: 3,
          missions: { depot: { best: 55, fullCrewBest: 70, completions: 3 } },
        }),
      );
    });
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await expect(page.getByRole('dialog')).toContainText('The release clause');
    const choose = page.getByRole('button', { name: 'Choose operation', exact: true });
    if (touch) await choose.tap();
    else await choose.click();
    const dialog = page.getByRole('dialog', { name: 'Operations', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.operation-card')).toHaveCount(10);
    const first = dialog.locator('[data-operation="depot"]');
    await expect(first).toContainText('Full crew: 01:10 · Any crew: 00:55');
    await expect(first.locator('[data-earned="true"]')).toHaveCount(2);
    const unearned = first.locator('[data-medal="quiet"]');
    await expect(unearned.locator('.medal-emblem')).toHaveCSS('opacity', '0.42');
    if (touch) await unearned.tap();
    else await unearned.hover();
    const tip = page.getByRole('tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Unearned');
    await expect(tip).toContainText('without ever triggering the site alarm');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#mission-title')).toHaveText('The release clause');
    if (touch) {
      await unearned.tap();
      await expect(tip).toBeHidden();
    } else {
      await page.mouse.move(5, 5);
      await unearned.focus();
      await expect(tip).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(tip).toBeHidden();
      await expect(dialog).toBeVisible();
    }
    const last = dialog.locator('[data-operation="injunction"]');
    const untraced = last.locator('[data-medal="untraced"]');
    if (!touch) {
      await untraced.focus(); // Native focus scrolls through the long Operations list.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(tip).toBeVisible();
      await expect(tip).toContainText('A partner on LOOP masks the upload');
      await page.keyboard.press('Escape');
    }
    await untraced.scrollIntoViewIfNeeded();
    if (touch) await untraced.tap();
    else await untraced.hover();
    await expect(tip).toContainText('A partner on LOOP masks the upload');
    const box = (await tip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(touch ? 390 : 1440);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(touch ? 844 : 960);
    await page.screenshot({ path: `/tmp/amortization-medals-${touch ? 'touch' : 'desktop'}.png` });
    await page.keyboard.press('Escape');
    await first.scrollIntoViewIfNeeded();
    await expect(first.locator('[data-medal="full-crew"]')).toHaveAttribute('data-earned', 'true');
    await page.screenshot({
      path: `/tmp/amortization-medals-overview-${touch ? 'touch' : 'desktop'}.png`,
    });
    const launch = last.locator('[data-action="mission:injunction"]');
    if (touch) await launch.tap();
    else await launch.click();
    await expect(page.getByRole('dialog')).toContainText('An order is only paper');
    await expect(page.locator('#mission-title')).toHaveText('Stay of execution');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await page.locator('vite-error-overlay').count()).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('winning debrief awards persist and a later casualty cannot erase medals', async ({
  page,
}) => {
  await page.route('**/medals-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Amortization medals fixture</title><link rel="stylesheet" href="/src/ui/style.css"><div id="app"></div>',
    }),
  );
  await page.goto('/medals-fixture');
  await page.evaluate(async () => {
    const paths = [
      '/src/ui/hud.ts',
      '/src/ui/storage.ts',
      '/src/sim/world.ts',
      '/src/sim/orders.ts',
      '/src/sim/step.ts',
    ];
    const [
      { Hud },
      { recordWin, missionRecord, readRecords },
      { createWorld },
      { interact, landmark },
      { step },
    ] = await Promise.all(paths.map((p) => import(p)));
    const w = createWorld() as World;
    // Finish a controlled extraction through the real order and step functions.
    // This isolates award/UI behavior from the separate live-patrol replay test.
    w.guards = [];
    w.time = 60;
    w.escort!.recruited = true;
    w.escort!.leader = w.agents[0].id;
    const van = landmark(w, 'extract');
    for (const a of [...w.agents, w.escort!]) Object.assign(a, { x: van.x, y: van.y });
    interact(
      w,
      w.agents.map((a) => a.id),
      'extract',
    );
    for (let i = 0; i < 60 && w.status === 'playing'; i++) step(w);
    if (w.status !== 'won') throw Error('Fixture extraction failed');
    let records = recordWin(w);
    const hud = new Hud(
      (action: string) => {
        if (action === 'operations') hud.showOperations(records);
      },
      () => {},
      () => {},
    ) as Hud;
    hud.showEnd(
      w,
      missionRecord(records, w.mission.id),
      false,
      missionRecord(records, w.mission.id).medals,
    );
    Object.assign(window, {
      medalFixture: {
        hud,
        w,
        recordCostlyWin: () => {
          w.agents[1].hp = 0;
          w.time = 50;
          records = recordWin(w);
          hud.showOperations(readRecords());
        },
      },
    });
  });
  await expect(page.getByRole('dialog')).toContainText('Account settled.');
  await expect(page.getByRole('button', { name: 'Next operation' })).toBeFocused();
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(page.getByRole('region', { name: 'Medals this run' })).toContainText('5 new');
  await expect(page.locator('.debrief-medals [data-new="true"]')).toHaveCount(5);
  await page.screenshot({ path: '/tmp/amortization-medals-awards.png' });
  await page.getByRole('button', { name: 'Operations', exact: true }).last().click();
  await expect(page.locator('[data-operation="depot"] [data-earned="true"]')).toHaveCount(5);
  await page.evaluate(() =>
    (
      window as unknown as { medalFixture: { recordCostlyWin: () => void } }
    ).medalFixture.recordCostlyWin(),
  );
  const depot = page.locator('[data-operation="depot"]');
  await expect(depot.locator('[data-earned="true"]')).toHaveCount(5);
  await expect(depot).toContainText('Any crew: 00:50');
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose operation', exact: true }).click();
  await expect(page.locator('[data-operation="depot"] [data-earned="true"]')).toHaveCount(5);
});

test('watching a winning human replay does not award medals', async ({ page }) => {
  test.setTimeout(35_000);
  await page.goto('/');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Import replay', exact: true })
    .click();
  await page
    .getByLabel('Import a replay bundle')
    .setInputFiles('tests/replays/injunction-quiet-d4da9148.replay.json');
  await page.getByRole('button', { name: 'Watch replay', exact: true }).click();
  await page.getByLabel('Replay speed').selectOption('16');
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.locator('#replay-status')).toContainText('Replay verified', {
    timeout: 25_000,
  });
  expect(await page.evaluate(() => localStorage.getItem('amortization.records.v4'))).toBeNull();
  await page.getByRole('button', { name: 'Return to attempt', exact: true }).click();
  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  await expect(page.locator('.medal-total')).toHaveText(/^0 \/ /);
});
