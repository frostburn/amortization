import { expect, test } from '@playwright/test';

test('night recordings decode gaplessly and stay below mission feedback in the native mixer', async ({
  page,
}) => {
  await page.route('**/music-check', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Music check</title>' }),
  );
  await page.goto('/music-check');
  const result = await page.evaluate(async () => {
    const paths = ['/src/audio/music.ts', '/src/audio/mixer.ts'];
    const [{ MUSIC_TRACKS, MUSIC_BEATS, MUSIC_PADDING }, { Mixer }] = await Promise.all(
      paths.map((p) => import(p)),
    );
    const rate = 24000;
    const decoder = new OfflineAudioContext(2, rate, rate);
    const buffers = await Promise.all(
      Object.values(MUSIC_TRACKS).map(async (track) => {
        const { url, bpm } = track as { url: string; bpm: number };
        const response = await fetch(url);
        if (!response.ok) throw new Error(String(response.status));
        const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
        return { buffer, bpm };
      }),
    );
    const recordings = buffers.map(({ buffer, bpm }) => {
      const data = buffer.getChannelData(0),
        head = Math.round(MUSIC_PADDING * rate),
        tail = head + Math.round(((MUSIC_BEATS * 60) / bpm) * rate) - 1;
      let sum = 0,
        peak = 0;
      for (const sample of data) {
        sum += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
      return {
        duration: buffer.duration,
        expected: 2 * MUSIC_PADDING + (MUSIC_BEATS * 60) / bpm,
        channels: buffer.numberOfChannels,
        peak,
        rms: Math.sqrt(sum / data.length),
        seam: Math.abs(data[head] - data[tail]),
      };
    });
    const render = async (kind: 'music' | 'feedback' | 'both') => {
      const context = new OfflineAudioContext(2, rate * 4, rate),
        mixer = new Mixer(context);
      mixer.volume(1);
      if (kind !== 'feedback') {
        const source = context.createBufferSource();
        source.buffer = buffers[1].buffer;
        source.loop = true;
        source.connect(mixer.music);
        source.start(0, 40);
      }
      if (kind !== 'music') mixer.play('objective', undefined, { when: 0.5 });
      const pcm = (await context.startRendering()).getChannelData(0);
      let peak = 0,
        windowRms = 0;
      for (let start = 0; start + rate / 10 < pcm.length; start += rate / 20) {
        let sum = 0;
        for (let i = start; i < start + rate / 10; i++) sum += pcm[i] ** 2;
        windowRms = Math.max(windowRms, Math.sqrt(sum / (rate / 10)));
      }
      for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
      return { peak, windowRms };
    };
    return {
      recordings,
      music: await render('music'),
      feedback: await render('feedback'),
      combined: await render('both'),
    };
  });
  for (const track of result.recordings) {
    expect(Math.abs(track.duration - track.expected)).toBeLessThan(1 / 24000);
    expect(track.channels).toBe(2);
    expect(track.peak).toBeGreaterThan(0.1);
    expect(track.peak).toBeLessThan(0.8);
    expect(track.rms).toBeGreaterThan(0.01);
    expect(track.seam).toBeLessThan(0.015);
  }
  expect(result.music.windowRms).toBeGreaterThan(0.005);
  expect(result.music.windowRms).toBeLessThan(result.feedback.windowRms * 0.6);
  expect(result.combined.peak).toBeLessThan(0.65);
});

test('music survives pause and pending transitions, while mute, daytime and outcomes silence it', async ({
  page,
}) => {
  await page.route('**/music-lifecycle', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Music lifecycle</title><button>Start</button>',
    }),
  );
  await page.goto('/music-lifecycle');
  await page.evaluate(async () => {
    const paths = [
      '/src/audio/music.ts',
      '/src/audio/mixer.ts',
      '/src/sim/world.ts',
      '/src/content/depot.ts',
      '/src/content/settlement.ts',
      '/src/content/threshold.ts',
    ];
    const [{ Music }, { Mixer }, { createWorld }, { depot }, { settlement }, { threshold }] =
      await Promise.all(paths.map((p) => import(p)));
    const context = new AudioContext(),
      mixer = new Mixer(context),
      music = new Music(context, mixer.music),
      world = createWorld(depot);
    mixer.volume(0.65);
    Object.assign(window, {
      musicCheck: { context, mixer, music, world, createWorld, depot, settlement, threshold },
    });
    document.querySelector('button')!.onclick = async () => {
      await context.resume();
      music.update(world, true);
    };
  });
  await page.locator('button').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const p = (
          window as unknown as { musicCheck: { music: { buffers: Map<string, AudioBuffer> } } }
        ).musicCheck;
        return p.music.buffers.size;
      }),
    )
    .toBe(2);
  const report = await page.evaluate(async () => {
    const { music, world, context, createWorld, depot, settlement, threshold } = (
      window as unknown as {
        musicCheck: {
          music: {
            current: { mood: string; source: AudioBufferSourceNode } | null;
            voices: Set<unknown>;
            beat: number;
            clock: { when: number; beat: number } | null;
            update: (world: object, running: boolean) => void;
            pause: () => void;
            reset: () => void;
          };
          world: { shots: number; time: number; status: string };
          context: AudioContext;
          createWorld: (mission: object) => object;
          depot: object;
          settlement: object;
          threshold: object;
        };
      }
    ).musicCheck;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const initial = music.current?.mood;
    await wait(100);
    world.shots++;
    music.update(world, true);
    const fight = music.current?.mood,
      transition = music.clock!.when;
    const offset = music.clock!.beat,
      pending = transition > context.currentTime;
    music.pause();
    const beat = music.beat;
    // Repeated paused updates must not postpone the source's scheduled stop.
    for (let i = 0; i < 5; i++) {
      music.update(world, false);
      await wait(25);
    }
    const stopped = music.voices.size;
    music.update(world, true);
    const resumed = music.clock!.beat;
    music.update(createWorld(settlement), true);
    await wait(80);
    const day = music.voices.size;
    music.update(createWorld(threshold), true);
    await wait(80);
    const sunset = music.voices.size;
    music.reset();
    music.update(createWorld(depot), true);
    const restarted = music.clock!.beat;
    world.status = 'won';
    music.update(world, true);
    await wait(80);
    const completed = music.voices.size;
    await context.close();
    return {
      initial,
      fight,
      offset,
      future: pending,
      beat,
      stopped,
      resumed,
      day,
      sunset,
      restarted,
      completed,
    };
  });
  expect(report.initial).toBe('calm');
  expect(report.fight).toBe('combat');
  expect(report.offset % 4).toBe(0);
  expect(report.future).toBe(true);
  expect(report.beat).toBeGreaterThan(0);
  expect(report.stopped).toBe(0);
  expect(report.resumed).toBeCloseTo(report.beat, 5);
  expect(report.day).toBe(0);
  expect(report.sunset).toBe(0);
  expect(report.restarted).toBe(0);
  expect(report.completed).toBe(0);
});
