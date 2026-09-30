import { expect, test } from '@playwright/test';

interface AudioProbe {
  contexts: number;
  keys: number;
  active: number;
}

for (const touch of [false, true]) {
  test(`story typing: ${touch ? 'touch' : 'desktop'} reveal, mute, interruption and reduced motion`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const context = await browser.newContext({
      viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
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
      localStorage.setItem('amortization.sound.v1', 'true');
      const Original = window.AudioContext,
        probe: AudioProbe = { contexts: 0, keys: 0, active: 0 };
      Object.assign(window, { typingProbe: probe });
      window.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          probe.contexts++;
        }
        createBufferSource() {
          const source = super.createBufferSource(),
            start = source.start.bind(source);
          source.start = (...args) => {
            // All dialogue keys are shorter than the 120 ms confirmation cue.
            if (source.buffer && source.buffer.duration < 0.119) {
              probe.keys++;
              probe.active++;
              source.addEventListener('ended', () => probe.active--, { once: true });
            }
            start(...args);
          };
          return source;
        }
      };
    });
    const probe = () =>
      page.evaluate(() => ({ ...(window as unknown as { typingProbe: AudioProbe }).typingProbe }));
    const press = async (selector: string) => {
      if (touch) await page.locator(selector).tap();
      else await page.locator(selector).click();
    };
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await expect(page.getByRole('button', { name: 'Begin operation' })).toBeVisible();
    expect((await probe()).contexts).toBe(0);
    await press('[data-story-entry="opening"]');
    const scene = page.locator('#story-dialog'),
      visible = scene.locator('[data-story-revealed]');
    await expect(scene).toHaveAttribute('data-revealing', 'true');
    const full = await scene.locator('.story-readable').textContent();
    await expect.poll(async () => (await visible.textContent())!.length).toBeGreaterThan(0);
    expect((await visible.textContent())!.length).toBeLessThan(full!.length);
    await expect.poll(async () => (await probe()).keys).toBeGreaterThan(0);
    const before = (await scene.locator('.story-line').boundingBox())!;
    await page.screenshot({ path: testInfo.outputPath('typing.png') });
    await press('#story-dialog .story-stage');
    await expect(scene).toHaveAttribute('data-revealing', 'false');
    await expect(visible).toHaveText(full!);
    await expect(scene.locator('.story-page')).toHaveText('1 / 6');
    const after = (await scene.locator('.story-line').boundingBox())!;
    expect(Math.abs(after.height - before.height)).toBeLessThan(1);
    const revealed = await probe();
    await expect.poll(async () => (await probe()).active).toBe(0);
    await page.waitForTimeout(180);
    expect((await probe()).keys).toBe(revealed.keys);

    await press('#story-dialog [data-story-control="next"]');
    await expect(scene.locator('.story-speaker')).toHaveText('Morrow');
    await press('#story-dialog [data-story-sound]');
    await expect(scene.locator('[data-story-sound]')).toHaveText('Sound off');
    const muted = await probe();
    await page.waitForTimeout(180);
    expect((await probe()).keys).toBe(muted.keys);
    // Restart while muted: text still reveals, without creating silent sources.
    await press('#story-dialog [data-story-control="restart"]');
    await expect.poll(async () => (await visible.textContent())!.length).toBeGreaterThan(0);
    expect((await probe()).keys).toBe(muted.keys);
    await press('#story-dialog [data-story-sound]');
    await expect.poll(async () => (await probe()).keys).toBeGreaterThan(muted.keys);

    // Pausing the reader keeps their place and cancels pending audio. Resuming
    // does not consume the hidden time or schedule a catch-up burst.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const pausedText = await visible.textContent(),
      pausedKeys = (await probe()).keys;
    await page.waitForTimeout(180);
    expect(await visible.textContent()).toBe(pausedText);
    expect((await probe()).keys).toBe(pausedKeys);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(async () => (await probe()).keys).toBeGreaterThan(pausedKeys);

    // Navigation interrupts the old line. The first right arrow only reveals;
    // it cannot accidentally skip a line or finish a scene.
    await page.keyboard.press('ArrowRight');
    await expect(scene.locator('.story-page')).toHaveText('1 / 6');
    await expect(scene).toHaveAttribute('data-revealing', 'false');
    await page.keyboard.press('ArrowRight');
    await expect(scene.locator('.story-page')).toHaveText('2 / 6');
    await page.keyboard.press('ArrowLeft');
    await expect(scene.locator('.story-page')).toHaveText('1 / 6');
    if (touch) await page.touchscreen.tap(8, 8);
    else await page.keyboard.press('Escape');
    await expect(scene).toBeHidden();
    const closed = (await probe()).keys;
    await expect.poll(async () => (await probe()).active).toBe(0);
    await page.waitForTimeout(180);
    expect((await probe()).keys).toBe(closed);
    expect(await page.evaluate(() => localStorage.getItem('amortization.story.v1'))).toBeNull();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await press('[data-story-entry="opening"]');
    await expect(scene).toHaveAttribute('data-revealing', 'false');
    await expect(visible).toHaveText(full!);
    expect((await probe()).keys).toBe(closed);
    expect((await probe()).contexts).toBe(1);
    expect(await scene.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await expect(scene.locator('[data-story-control="next"]')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: testInfo.outputPath('revealed.png') });
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}
