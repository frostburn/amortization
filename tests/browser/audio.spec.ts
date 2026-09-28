import { expect, test } from '@playwright/test';

for (const touch of [false, true]) {
  test(`sound controls: ${touch ? 'touch' : 'desktop'} gesture, mute and remembered volume`, async ({
    browser,
  }) => {
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
      const Original = window.AudioContext;
      const state = { contexts: 0, resumes: 0 };
      Object.assign(window, { audioProbe: state });
      window.AudioContext = class extends Original {
        constructor(options?: AudioContextOptions) {
          super(options);
          state.contexts++;
        }
        resume() {
          state.resumes++;
          return super.resume();
        }
      };
    });
    const press = async (label: string) => {
      const button =
        label === 'Begin operation'
          ? page.locator('dialog [data-action="begin"]')
          : page.getByRole('button', { name: label, exact: true });
      if (touch) await button.tap();
      else await button.click();
    };
    await page.goto('/');
    await expect(page).toHaveTitle('Amortization');
    await expect(page.getByRole('dialog')).toContainText('The release clause');
    expect(
      await page.evaluate(
        () => (window as unknown as { audioProbe: { contexts: number } }).audioProbe.contexts,
      ),
    ).toBe(0);
    await press('Begin operation');
    await press('Pause');
    await press('Sound off');
    await expect(page.getByRole('button', { name: 'Sound on', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const volume = page.getByRole('slider', { name: 'Sound volume' });
    const bounds = (await volume.boundingBox())!;
    const point = { x: bounds.x + bounds.width * 0.35, y: bounds.y + bounds.height / 2 };
    if (touch) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    const chosen = Number(await volume.inputValue());
    expect(chosen).toBeGreaterThan(20);
    expect(chosen).toBeLessThan(45);
    await expect(volume).toHaveAttribute('aria-valuetext', `${chosen}%`);
    await volume.focus();
    await page.keyboard.press('ArrowRight');
    await expect(volume).toHaveValue(String(chosen + 1));
    await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
    await press('Sound on');
    await expect(page.getByRole('button', { name: 'Sound off', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { audioProbe: { contexts: number; resumes: number } }).audioProbe,
      ),
    ).toEqual({ contexts: 1, resumes: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/amortization-sound-${touch ? 'touch' : 'desktop'}.png` });
    await page.reload();
    await expect(volume).toHaveValue(String(chosen + 1));
    await expect(page.locator('#sound-button')).toHaveText('Sound off');
    expect(
      await page.evaluate(
        () => (window as unknown as { audioProbe: { contexts: number } }).audioProbe.contexts,
      ),
    ).toBe(0);
    expect(await page.locator('vite-error-overlay').count()).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('native audio mixing keeps stereo, limits a volley, and releases cancelled loops', async ({
  page,
}) => {
  await page.route('**/audio-fixture', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><title>Amortization audio fixture</title>',
    }),
  );
  await page.goto('/audio-fixture');
  const result = await page.evaluate(async () => {
    const path = '/src/audio/mixer.ts';
    const { Mixer } = await import(path);
    const context = new OfflineAudioContext(2, 48000, 48000),
      mixer = new Mixer(context);
    mixer.volume(1);
    const sameBuffer = mixer.buffer('pistol', 0) === mixer.buffer('pistol', 0);
    const left = { pan: -0.8, gain: 0.7, cutoff: 14000 };
    const charge = mixer.play('charge', left)!;
    mixer.stop(charge, 0.1);
    for (let i = 0; i < 60; i++) mixer.play('pistol', left, { when: 0.2, variant: 0 });
    const admitted = mixer.activeVoices;
    // Critical feedback can replace a low-priority tail, without new PCM allocations.
    mixer.play('alarm', { pan: 0, gain: 0.1, cutoff: 14000 }, { when: 0.2 });
    const samples = await context.startRendering();
    const power = [0, 0];
    let peak = 0,
      final = 0;
    for (let channel = 0; channel < 2; channel++) {
      const data = samples.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        peak = Math.max(peak, Math.abs(data[i]));
        if (i > 9600 && i < 16000) power[channel] += data[i] ** 2;
        if (i > 46000) final += data[i] ** 2;
      }
    }
    // Render a separate cancelled loop to measure silence after its release.
    const short = new OfflineAudioContext(2, 24000, 48000),
      stopped = new Mixer(short);
    stopped.volume(1);
    const loop = stopped.play('charge')!;
    stopped.stop(loop, 0.1);
    const tail = await short.startRendering();
    let afterCancel = 0;
    for (const x of tail.getChannelData(0).slice(9600))
      afterCancel = Math.max(afterCancel, Math.abs(x));
    return { sameBuffer, admitted, max: mixer.maxVoices, peak, power, final, afterCancel };
  });
  expect(result.sameBuffer).toBe(true);
  expect(result.admitted).toBeLessThanOrEqual(result.max);
  expect(result.peak).toBeGreaterThan(0.05);
  expect(result.peak).toBeLessThan(0.96);
  expect(result.power[0]).toBeGreaterThan(result.power[1] * 4);
  expect(result.afterCancel).toBeLessThan(0.00001);
});

test('muting, pausing, replay acceleration and world changes stop live sustained audio', async ({
  page,
}) => {
  await page.route('**/sound-lifecycle', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><meta charset="utf-8"><title>Amortization sound lifecycle</title><button id="enable">Enable sound</button>',
    }),
  );
  await page.goto('/sound-lifecycle');
  await page.evaluate(async () => {
    const paths = ['/src/audio/sound.ts', '/src/sim/world.ts', '/src/content/mandate.ts'];
    const [{ Sound }, { createWorld }, { mandate }] = await Promise.all(
      paths.map((p) => import(p)),
    );
    const sound = new Sound(),
      world = createWorld(mandate),
      view = { centre: { x: 3, y: 3 }, width: 800, scale: 1 };
    const probe = { sound, world, view, createWorld, mandate };
    Object.assign(window, { lifecycle: probe });
    sound.reset(world);
    document.querySelector('#enable')!.addEventListener('click', () => sound.toggle());
  });
  await page.locator('#enable').click();
  const result = await page.evaluate(async () => {
    // The fixture owns the engine; no debug hooks are added to the shipped app.
    const { sound, world, view, createWorld, mandate } = (
      window as unknown as {
        lifecycle: {
          sound: {
            enabled: boolean;
            update: (...args: unknown[]) => void;
            reset: (w: unknown) => void;
            toggle: () => Promise<void>;
            mixer: { activeVoices: number };
            loops: Map<string, unknown>;
          };
          world: {
            agents: { armament: { charging?: { target: string; remaining: number } } }[];
            sounds: unknown[];
          };
          view: unknown;
          createWorld: (mission: unknown) => unknown;
          mandate: unknown;
        };
      }
    ).lifecycle;
    await new Promise((r) => setTimeout(r, 100));
    world.agents[3].armament.charging = { target: 'guard-0', remaining: 1 };
    sound.update(world, view, true);
    const charging = [...sound.loops.keys()];
    sound.update(world, view, false);
    const paused = sound.loops.size;
    sound.update(world, view, true);
    sound.update(world, view, true, false);
    const accelerated = sound.loops.size;
    sound.update(world, view, true);
    delete world.agents[3].armament.charging;
    sound.update(world, view, true);
    const cancelled = [...sound.loops.keys()];
    sound.reset(createWorld(mandate));
    const reset = sound.loops.size;
    await sound.toggle();
    await new Promise((r) => setTimeout(r, 60));
    return {
      charging,
      paused,
      accelerated,
      cancelled,
      reset,
      enabled: sound.enabled,
      voices: sound.mixer.activeVoices,
    };
  });
  expect(result.charging).toContain('charge:agent-3:guard-0');
  expect(result.paused).toBe(0);
  expect(result.accelerated).toBe(0);
  expect(result.cancelled).toEqual(['room']);
  expect(result.reset).toBe(0);
  expect(result.enabled).toBe(false);
  expect(result.voices).toBe(0);
});
