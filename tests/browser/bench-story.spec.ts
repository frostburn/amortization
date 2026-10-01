import { expect, test } from '@playwright/test';

// Browser plugin unavailable. A saved, costly victory is replayed through the
// actual touch Operations flow; the earlier full-crew record must not resurrect anyone.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test('finale story replays the latest surviving cast after a reload', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (localStorage.getItem('amortization.records.v4')) return;
    localStorage.setItem(
      'amortization.records.v4',
      JSON.stringify({
        version: 4,
        missions: {
          bench: {
            best: 100,
            fullCrewBest: 100,
            completions: 2,
            medals: ['complete', 'full-crew'],
            ending: { survivors: ['vale', 'sable'], holt: 'eliminated' },
          },
        },
      }),
    );
  });
  await page.goto('/');
  await expect(page).toHaveTitle('Amortization');
  const open = async () => {
    await page.locator('dialog [data-action="operations"]').tap();
    await page.locator('[data-story-entry="bench"]').tap();
    await expect(page.locator('#story-dialog h2')).toHaveText('Off duty');
    await expect(page.locator('[data-story-sound]')).toHaveText('Sound off');
  };
  await open();
  const scene = page.locator('#story-dialog'),
    speakers = new Set<string>(),
    lines: string[] = [];
  while (await scene.isVisible()) {
    speakers.add((await scene.locator('.story-speaker').textContent())!);
    const line = (await scene.locator('.story-readable').textContent())!;
    lines.push(line);
    await scene.locator('.story-stage').tap();
    if (line.includes('We won’t forget.'))
      await page.screenshot({ path: testInfo.outputPath('remembered.png') });
    await expect(scene.locator('[data-story-control="next"]')).toBeInViewport({ ratio: 1 });
    await scene.locator('[data-story-control="next"]').tap();
  }
  expect([...speakers]).toEqual(['Iona Voss', 'Vale', 'Sable', 'Mara Quill']);
  expect(lines.join(' ')).toContain('to Morrow and Rook. They should be here.');
  expect(lines.join(' ')).toContain('Holt and Dacre are gone.');
  await expect(page.locator('[data-story-entry="bench"]')).toContainText('Replay scene');
  await page.reload();
  await open();
  await scene.locator('.story-stage').tap();
  await scene.locator('[data-story-control="next"]').tap();
  await expect(scene.locator('.story-speaker')).toHaveText('Vale');
  await expect(scene.locator('.story-portrait')).toHaveCSS('background-position', '100% 0%');
  await scene.locator('.story-stage').tap();
  await page.screenshot({ path: testInfo.outputPath('vale.png') });
  expect(await scene.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
