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

test('exports real inputs, verifies playback, preserves the live attempt, and restores recent runs @smoke', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Repeated replay/world restores exercise the real renderer at laptop size.
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveTitle('Amortization');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  const exportDialog = page.getByRole('dialog', { name: 'Export attempt', exact: true });
  const viewerDialog = page.getByRole('dialog', { name: 'Replay viewer', exact: true });
  const importButton = page
    .locator('.top-actions')
    .getByRole('button', { name: 'Import replay', exact: true });
  const briefing = page.getByRole('dialog', { name: 'The release clause', exact: true });
  // Import is directly reachable from the initial briefing without opening export.
  await briefing.getByRole('button', { name: 'Import replay', exact: true }).click();
  await expect(viewerDialog).toBeVisible();
  await expect(exportDialog).toBeHidden();
  await expect(viewerDialog.getByLabel('Import a replay bundle')).toBeVisible();
  await expect(page.locator('dialog[data-playtest]')).toHaveCount(2);
  await expect(page.locator('[data-playtest] [role="tab"]')).toHaveCount(0);
  await expect(page.locator('#playtest-export-dialog #playtest-import')).toHaveCount(0);
  await expect(viewerDialog.locator('#playtest-download')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(viewerDialog).toBeHidden();
  await expect(briefing.getByRole('button', { name: 'Import replay', exact: true })).toBeFocused();
  const recording = page.locator('.playtest-button');
  const dot = recording.locator('.playtest-recording-dot');
  await expect(recording).toHaveAttribute('data-recording', 'true');
  await expect(recording).toHaveText('Export attempt · REC');
  await expect(dot).toBeVisible();
  await expect(dot).toHaveCSS('background-color', 'rgb(255, 92, 103)');
  await expect(dot).toHaveCSS('border-radius', '50%');
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Select Morrow', exact: true }).click();
  await page.keyboard.press('f');
  await page.keyboard.press('s');
  await page.locator('canvas').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#pause-label')).toHaveText('Pause');
  // Software WebGL can take more than five wall-clock seconds to render a game second.
  await expect(page.locator('#clock')).not.toHaveText('00:00', { timeout: 15_000 });
  await page.keyboard.down('Tab');
  await expect(page.locator('#time-mode')).toHaveText('SLOW TIME / 20%');
  await page.keyboard.up('Tab');
  await recording.click();
  await expect(exportDialog).toBeVisible();
  await expect(viewerDialog).toBeHidden();
  await expect(page.getByLabel('Import a replay bundle')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Watch replay', exact: true })).toBeHidden();
  await expect(dot).toBeVisible(); // Paused orders still belong to the live recording.
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

  await page.getByRole('button', { name: 'Close export', exact: true }).click();
  await importButton.click();
  await expect(viewerDialog).toBeVisible();
  await expect(exportDialog).toBeHidden();
  await page.getByLabel('Replay source').selectOption('live');
  await expect(page.getByLabel('Replay source')).toHaveValue('live');
  await expect(page.locator('#playtest-replay-note')).toHaveText(bundle.note);
  await expect(page.getByRole('button', { name: 'Download attempt', exact: true })).toBeHidden();
  await expect(page.getByLabel('Player note', { exact: false })).toBeHidden();
  await page.getByRole('button', { name: 'Watch replay', exact: true }).click();
  await expect(recording).toHaveAttribute('data-recording', 'false');
  await expect(recording).toHaveText('Export attempt · replay');
  await expect(dot).toBeHidden();
  await page.getByLabel('Replay speed').selectOption('16');
  await page.locator('canvas').focus();
  await page.keyboard.press('f'); // Live gameplay commands must not alter the replay.
  await page.getByRole('button', { name: 'Play replay', exact: true }).click();
  await expect(page.locator('#replay-status')).toContainText('Replay verified');
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Operations', exact: true })).toBeDisabled();
  await page.locator('canvas').focus();
  await page.keyboard.press('Shift+R');
  await expect(page.locator('#replay-status')).toContainText('Replay verified');
  await page.getByRole('button', { name: 'Return to attempt', exact: true }).click();
  await expect(recording).toHaveAttribute('data-recording', 'true');
  await expect(dot).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Operations', exact: true })).toBeEnabled();
  await expect(page.locator('#pause-label')).toHaveText('Resume');
  await recording.click();
  const again = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download attempt', exact: true }).click();
  const preserved = await bundleFrom(await again);
  expect(preserved.commands).toEqual(bundle.commands);
  expect(preserved.ticks).toBe(bundle.ticks);
  expect(preserved.checkpoints).toEqual(bundle.checkpoints);
  expect(preserved.id).toBe(bundle.id);
  expect(await page.evaluate(() => localStorage.getItem('amortization.records.v2'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('amortization.records.v3'))).toBeNull();
  await page.getByRole('button', { name: 'Close export', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Export attempt', exact: true }).click();
  await page.getByLabel('Attempt', { exact: true }).selectOption(bundle.id);
  await expect(page.getByLabel('Player note', { exact: false })).toHaveValue(bundle.note);
  await page.getByRole('button', { name: 'Close export', exact: true }).click();
  await page.getByRole('button', { name: 'Begin operation' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();

  bundle.build.simulationHash = '0'.repeat(64);
  await importButton.click();
  await page.getByLabel('Import a replay bundle').setInputFiles({
    name: 'older.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.locator('#playtest-viewer-feedback')).toContainText('Imported');
  await expect(page.getByLabel('Replay source')).toHaveValue('imported');
  await expect(page.getByRole('button', { name: 'Watch replay', exact: true })).toBeDisabled();
  await expect(page.locator('#playtest-compatibility')).toContainText('Simulation code differs');
  await page.getByRole('button', { name: 'Close replay viewer', exact: true }).click();
  await recording.click();
  await expect(page.getByLabel('Attempt', { exact: true })).toHaveValue(bundle.id);
  await expect(page.locator('#playtest-attempt option[value="imported"]')).toHaveCount(0);
  await expect(page.getByLabel('Player note', { exact: false })).toHaveValue(bundle.note);
  await expect(page.getByLabel('Import a replay bundle')).toBeHidden();
  await page.getByRole('button', { name: 'Close export', exact: true }).click();
  await importButton.click();
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
  const importButton = page
    .locator('.top-actions')
    .getByRole('button', { name: 'Import replay', exact: true });
  await page
    .getByRole('dialog', { name: 'The release clause', exact: true })
    .getByRole('button', { name: 'Import replay', exact: true })
    .tap();
  await expect(page.getByRole('dialog', { name: 'Replay viewer', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Export attempt', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Close replay viewer', exact: true }).tap();
  await page.getByRole('button', { name: 'Begin operation' }).tap();
  await page.getByRole('button', { name: 'Pause', exact: true }).tap();
  await page.getByRole('button', { name: 'Draw weapons F', exact: true }).tap();
  await page.getByRole('button', { name: /Export attempt ·/ }).tap();
  await expect(page.getByRole('dialog', { name: 'Export attempt', exact: true })).toBeVisible();
  await expect(page.getByLabel('Import a replay bundle')).toBeHidden();
  await page.getByLabel('Player note', { exact: false }).fill('Phone attempt');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download attempt', exact: true }).tap();
  expect((await bundleFrom(await download)).note).toBe('Phone attempt');
  await expect(page.locator('#playtest-storage')).toContainText('could not save');
  await page.getByRole('button', { name: 'Close export', exact: true }).tap();
  await importButton.tap();
  await expect(page.getByRole('button', { name: 'Download attempt', exact: true })).toBeHidden();
  await page.getByLabel('Replay source').selectOption('live');
  await expect(page.getByRole('button', { name: 'Watch replay', exact: true })).toBeEnabled();
  await page.getByLabel('Import a replay bundle').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{}'),
  });
  await expect(page.locator('#playtest-viewer-feedback')).toContainText(
    'Unsupported replay format',
  );
  await expect(page.locator('#playtest-replay-details')).toBeHidden();
  await page.getByRole('button', { name: 'Close replay viewer', exact: true }).tap();
  await page.getByRole('button', { name: /Export attempt ·/ }).tap();
  await expect(page.getByLabel('Player note', { exact: false })).toHaveValue('Phone attempt');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: 'Close export', exact: true }).tap();
  await expect(page.locator('#pause-label')).toHaveText('Resume');
  expect(errors).toEqual([]);
  await context.close();
});
