import { expect, test } from '@playwright/test';
import { missions } from '../../src/content/missions';
import { missionCopy } from '../../src/content/mission-copy';
import type { World } from '../../src/sim/types';

test('story entry stays optional and completed operations expose their reward @smoke', async ({
  page,
}) => {
  const errors: string[] = [],
    artRequests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (request) => {
    if (request.url().includes('/assets/story/')) artRequests.push(request.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      'amortization.records.v2',
      JSON.stringify({ version: 2, missions: { depot: { best: 100, completions: 1 } } }),
    ),
  );
  await page.goto('/');
  await expect(page).toHaveTitle('Amortization');
  await expect(page.locator('#boot-screen')).toHaveCount(0);
  const mission = page.locator('#mission-dialog'),
    scene = page.locator('#story-dialog');
  await expect(mission.getByRole('button', { name: 'Begin operation' })).toBeFocused();
  await expect(scene).toBeHidden();
  expect(artRequests).toEqual([]);
  await mission.locator('[data-story-entry="opening"]').click();
  await expect(scene.locator('.story-speaker')).toHaveText('Iona Voss');
  await scene.locator('.story-stage').click();
  await expect(scene.locator('.story-page')).toHaveText('1 / 6');
  await expect(scene).toHaveAttribute('data-revealing', 'false');
  await scene.getByRole('button', { name: 'Next', exact: false }).click();
  await expect(scene.locator('.story-speaker')).toHaveText('Morrow');
  await scene.getByRole('button', { name: 'Close scene' }).click();
  await expect(mission).toBeVisible();
  await mission.getByRole('button', { name: 'Choose operation' }).click();
  await expect(mission.locator('[data-operation="archive"] [data-story-entry]')).toHaveCount(0);
  await mission.locator('[data-story-entry="depot"]').click();
  await expect(scene.getByRole('heading')).toHaveText(missionCopy.depot.scene.title);
  await scene.getByRole('button', { name: 'Close scene' }).click();
  await expect(mission.locator('[data-story-entry="depot"]')).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const touch of [false, true]) {
  test(`optional story: ${touch ? 'touch' : 'desktop'} loading, rewards and replay`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000); // Extended completion/reload journey; outside routine smoke CI.
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage(),
      errors: string[] = [],
      artRequests: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('request', (request) => {
      if (request.url().includes('/assets/story/')) artRequests.push(request.url());
    });
    // Delay only the game module to observe the genuinely independent first paint.
    let release!: () => void;
    const loaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/src\/main\.ts$/, async (route) => {
      await loaded;
      await route.continue();
    });
    await page.route(/\/src\/sim\/world\.ts$/, (route) =>
      route.fulfill({
        contentType: 'application/javascript',
        body: `export * from '/src/sim/world.ts?story-original';
        import { createWorld as real } from '/src/sim/world.ts?story-original';
        export function createWorld(mission) { const world = real(mission); window.storyWorld = world; return world; }`,
      }),
    );
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page).toHaveTitle('Amortization');
    await expect(page.locator('#boot-screen')).toContainText('Opening the operations desk');
    await expect(page.locator('#boot-screen')).toBeVisible();
    expect(artRequests).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('loading.png') });
    release();
    await expect(page.locator('#boot-screen')).toHaveCount(0);
    const mission = page.locator('#mission-dialog'),
      scene = page.locator('#story-dialog');
    await expect(mission.getByRole('button', { name: 'Begin operation' })).toBeFocused();
    await expect(scene).toBeHidden();
    expect(artRequests).toEqual([]);
    await mission.locator('[data-story-entry="opening"]').click();
    await expect(scene).toBeVisible();
    await expect(scene.locator('.story-speaker')).toHaveText('Iona Voss');
    await expect(scene.locator('.story-page')).toHaveText('1 / 6');
    const initialWorld = await page.evaluate(() =>
      JSON.stringify((window as unknown as { storyWorld: World }).storyWorld),
    );
    await page.keyboard.press('Shift+R');
    await page.keyboard.press('f');
    expect(
      await page.evaluate(() =>
        JSON.stringify((window as unknown as { storyWorld: World }).storyWorld),
      ),
    ).toBe(initialWorld);
    await scene.locator('.story-stage').click();
    await scene.getByRole('button', { name: 'Next', exact: false }).click();
    await expect(scene.locator('.story-speaker')).toHaveText('Morrow');
    await scene.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(scene.locator('.story-page')).toHaveText('1 / 6');
    await scene.getByRole('button', { name: 'Sound off', exact: true }).click();
    await expect(scene.getByRole('button', { name: 'Sound on', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await scene.getByRole('button', { name: 'Sound on', exact: true }).click();
    await scene.locator('.story-stage').click();
    await page.screenshot({ path: testInfo.outputPath('opening.png') });
    if (touch) await page.touchscreen.tap(8, 8);
    else await page.keyboard.press('Escape');
    await expect(scene).toBeHidden();
    await expect(mission).toBeVisible();
    await expect(mission.locator('[data-story-entry="opening"]')).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('amortization.story.v1'))).toBeNull();
    await mission.getByRole('button', { name: 'Begin operation' }).click();
    // Complete through the real extraction path; a casualty still earns the scene.
    await page.evaluate(async () => {
      const path = '/src/sim/orders.ts';
      const { interact, landmark } = await import(path);
      const w = (window as unknown as { storyWorld: World }).storyWorld;
      w.time = 60;
      w.guards.forEach((g) => (g.hp = 0));
      w.agents[1].hp = 0;
      w.escort!.recruited = true;
      w.escort!.leader = w.agents[0].id;
      const van = landmark(w, 'extract');
      for (const p of [...w.agents, w.escort!]) Object.assign(p, { x: van.x, y: van.y });
      interact(
        w,
        w.agents.filter((a) => a.hp > 0).map((a) => a.id),
        'extract',
      );
    });
    await expect(page.locator('#outcome-results')).toBeVisible();
    await page.locator('#outcome-results').click();
    await expect(mission).toContainText('Account settled.');
    await expect(scene).toBeHidden();
    const reward = mission.locator('[data-story-entry="depot"]');
    await expect(reward).toContainText('Watch scene');
    const records = await page.evaluate(() => localStorage.getItem('amortization.records.v4'));
    await reward.click();
    for (let i = 1; i < missionCopy.depot.scene.beats.length; i++) {
      await scene.locator('.story-stage').click();
      await scene.locator('[data-story-control="next"]').click();
    }
    await scene.locator('.story-stage').click();
    await expect(scene.locator('.story-speaker')).toHaveText('Severin Holt');
    await expect(scene.locator('.story-line')).toBeInViewport({ ratio: 1 });
    await expect(scene.getByRole('button', { name: 'Finish scene' })).toBeInViewport({ ratio: 1 });
    const rect = (await scene.boundingBox())!;
    expect(rect.height).toBeLessThanOrEqual(page.viewportSize()!.height - 30);
    expect(await scene.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('chairman.png') });
    await scene.getByRole('button', { name: 'Finish scene' }).click();
    await expect(scene).toBeHidden();
    await expect(reward).toContainText('Replay scene');
    expect(await page.evaluate(() => localStorage.getItem('amortization.records.v4'))).toBe(
      records,
    );
    await page.reload();
    await expect(scene).toBeHidden();
    await mission.getByRole('button', { name: 'Choose operation' }).click();
    await expect(mission.locator('[data-story-entry="depot"]')).toContainText('Replay scene');
    await expect(mission.locator('[data-operation="archive"] [data-story-entry]')).toHaveCount(0);
    await mission.locator('[data-story-entry="depot"]').click();
    await expect(scene.locator('.story-page')).toHaveText('1 / 6');
    await expect(scene.getByRole('button', { name: 'Sound off', exact: true })).toBeVisible();
    expect(await page.locator('vite-error-overlay').count()).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('existing completions unlock all scenes; every portrait and setting loads', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000); // Full fifteen-operation catalogue; outside routine smoke CI.
  // The catalogue sweep also exercises the instant, accessible reading mode.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    (ids) =>
      localStorage.setItem(
        'amortization.records.v2',
        JSON.stringify({
          version: 2,
          missions: Object.fromEntries(ids.map((id) => [id, { best: 100, completions: 1 }])),
        }),
      ),
    missions.map((m) => m.id),
  );
  await page.goto('/');
  const mission = page.locator('#mission-dialog'),
    scene = page.locator('#story-dialog');
  await mission.getByRole('button', { name: 'Choose operation' }).click();
  await expect(mission.locator('[data-story-entry]')).toHaveCount(missions.length + 1);
  const decoded = new Set<string>();
  for (const m of missions) {
    await mission.locator(`[data-story-entry="${m.id}"]`).click();
    await expect(scene.getByRole('heading')).toHaveText(missionCopy[m.id].scene.title);
    for (let i = 0; i < missionCopy[m.id].scene.beats.length; i++) {
      const assets = await scene
        .locator('.story-portrait, .story-background')
        .evaluateAll((elements) =>
          elements.map((e) => (e as HTMLElement).style.backgroundImage.slice(5, -2)),
        );
      for (const url of assets) {
        if (decoded.has(url)) continue;
        const loaded = await page.evaluate(async (url) => {
          const image = new Image();
          image.src = url;
          try {
            await image.decode();
            return image.naturalWidth > 0;
          } catch {
            return false;
          }
        }, url);
        expect(loaded, `${m.id} beat ${i}: ${url}`).toBe(true);
        decoded.add(url);
      }
      if (m.id === 'countermand' && i === 5)
        await page.screenshot({ path: testInfo.outputPath('continuity-director.png') });
      await scene.locator('[data-story-control="next"]').click();
    }
    await expect(scene).toBeHidden();
    await expect(mission.locator(`[data-story-entry="${m.id}"]`)).toContainText('Replay scene');
  }
  expect(errors).toEqual([]);
});

test('module failure leaves the loading screen with a usable retry', async ({ page }) => {
  await page.route(/\/src\/main\.ts$/, (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#boot-screen')).toContainText('Could not open the operation.');
  await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible();
  await page.unroute(/\/src\/main\.ts$/);
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await expect(page.locator('#boot-screen')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Begin operation' })).toBeVisible();
});
