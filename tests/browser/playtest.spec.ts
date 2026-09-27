import { expect, test } from '@playwright/test';
import type { Download } from '@playwright/test';
import { buildInfo } from '../../scripts/build-info';
import { parseReplay, verifyReplay } from '../../src/replay/core';

async function bundleFrom(download: Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return parseReplay(Buffer.concat(chunks).toString('utf8'));
}

test('exports real inputs, verifies playback, preserves the live attempt, and restores recent runs', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Amortization');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await page.keyboard.press('f');
  await page.keyboard.press('s');
  await page.locator('canvas').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#clock')).not.toHaveText('00:00');
  await page.keyboard.down('Tab');
  await expect(page.locator('#time-mode')).toHaveText('SLOW TIME / 20%');
  await page.keyboard.up('Tab');
  await page.getByRole('button', { name: /Playtest ·/ }).click();
  await expect(page.getByRole('dialog', { name: 'Playtesting', exact: true })).toBeVisible();
  await page
    .getByLabel('Player note', { exact: false })
    .fill('F / S / Space in this note must not issue orders.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download attempt', exact: true }).click();
  const bundle = await bundleFrom(await download);
  expect(bundle.commands.map((e) => e.command)).toEqual([
    { kind: 'weapons', agents: ['agent-0'] },
    { kind: 'hold', agents: ['agent-0'] },
  ]);
  expect(bundle.timing.activeSeconds).toBeGreaterThan(0);
  expect(bundle.timing.planningSeconds).toBeGreaterThan(0);
  expect(bundle.note).toContain('must not issue orders');
  expect(verifyReplay(bundle, buildInfo(process.cwd())).error).toBeNull();

  await page.getByRole('button', { name: 'Watch replay', exact: true }).click();
  await page.getByLabel('Replay speed').selectOption('16');
  await page.locator('canvas').focus();
  await page.keyboard.press('f'); // Live gameplay commands must not alter the replay.
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.locator('#replay-status')).toContainText('Replay verified');
  await page.getByRole('button', { name: 'Return to attempt', exact: true }).click();
  await expect(page.locator('#pause-label')).toHaveText('Resume');
  await page.getByRole('button', { name: /Playtest ·/ }).click();
  const again = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download attempt', exact: true }).click();
  const preserved = await bundleFrom(await again);
  expect(preserved.commands).toEqual(bundle.commands);
  expect(preserved.ticks).toBe(bundle.ticks);
  expect(preserved.checkpoints).toEqual(bundle.checkpoints);
  expect(await page.evaluate(() => localStorage.getItem('amortization.records.v2'))).toBeNull();
  await page.getByRole('button', { name: 'Close playtesting' }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Playtest / export attempt', exact: true }).click();
  await page.getByLabel('Attempt', { exact: true }).selectOption(bundle.id);
  await expect(page.getByLabel('Player note', { exact: false })).toHaveValue(bundle.note);

  bundle.build.simulationHash = '0'.repeat(64);
  await page.getByLabel('Import a replay bundle').setInputFiles({
    name: 'older.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.locator('#playtest-feedback')).toContainText('Imported');
  await expect(page.getByRole('button', { name: 'Watch replay', exact: true })).toBeDisabled();
  await expect(page.locator('#playtest-compatibility')).toContainText('Simulation code differs');
  await page.getByRole('button', { name: 'Try current rules', exact: true }).click();
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.locator('#replay-status')).toContainText('Current rules finished');
  expect(errors).toEqual([]);
});

test('phone playtesting supports notes, downloads, and a clear malformed-import error', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage denied', 'QuotaExceededError');
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Begin operation' }).tap();
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await page.getByRole('button', { name: 'Draw weapons F', exact: true }).tap();
  await page.getByRole('button', { name: /Playtest ·/ }).tap();
  await page.getByLabel('Player note', { exact: false }).fill('Phone attempt');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download attempt', exact: true }).tap();
  expect((await bundleFrom(await download)).note).toBe('Phone attempt');
  await expect(page.locator('#playtest-storage')).toContainText('could not save');
  await page.getByLabel('Import a replay bundle').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.locator('#playtest-feedback')).toContainText('Unsupported replay format');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Close playtesting' }).tap();
  await expect(page.locator('#pause-label')).toHaveText('Resume');
  expect(errors).toEqual([]);
  await context.close();
});
