import { expect, test } from '@playwright/test';

// Browser plugin unavailable. A saved, costly victory is replayed through the
// actual touch Operations flow; obsolete cast data must not alter the fixed scene.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test('finale story keeps the full cast despite old outcome data and reloads', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000);
  await page
    .context()
    .grantPermissions(['local-network-access'], { origin: 'http://127.0.0.1:4173' });
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
    if (line.includes('Glasses up.'))
      await page.screenshot({ path: testInfo.outputPath('celebration.png') });
    await expect(scene.locator('[data-story-control="next"]')).toBeInViewport({ ratio: 1 });
    await scene.locator('[data-story-control="next"]').tap();
  }
  expect([...speakers]).toEqual(['Iona Voss', 'Morrow', 'Vale', 'Rook', 'Sable', 'Mara Quill']);
  expect(lines.join(' ')).not.toMatch(/They should be here|We won’t forget|another chair/);
  expect(lines.join(' ')).toContain('No one upstairs is giving orders anymore.');
  await expect(page.locator('[data-story-entry="bench"]')).toContainText('Replay scene');
  await page.reload();
  await open();
  await scene.locator('.story-stage').tap();
  await scene.locator('[data-story-control="next"]').tap();
  await expect(scene.locator('.story-speaker')).toHaveText('Morrow');
  await expect(scene.locator('.story-portrait')).toHaveCSS('background-position', '0% 0%');
  await scene.locator('.story-stage').tap();
  await page.screenshot({ path: testInfo.outputPath('morrow.png') });
  expect(await scene.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});
