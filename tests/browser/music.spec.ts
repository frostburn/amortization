import { expect, test } from '@playwright/test';
import type { ScorePlayer } from '../../src/audio/score/player';

test('native synthesis stays quiet, loops, and changes arrangements without duplicating held notes', async ({
  page,
}) => {
  await page.route('**/music-check', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Music check</title>' }),
  );
  await page.goto('/music-check');
  const result = await page.evaluate(async () => {
    const paths = ['/src/audio/score/index.ts', '/src/audio/mixer.ts'];
    const [{ ScorePlayer, score }, { Mixer }] = await Promise.all(paths.map((p) => import(p)));
    const rate = 24000;
    const render = async (kind: 'music' | 'feedback' | 'both', startBeat = 112) => {
      const context = new OfflineAudioContext(2, rate * 8, rate),
        mixer = new Mixer(context);
      mixer.volume(1);
      let player: ScorePlayer | undefined;
      if (kind !== 'feedback') {
        player = new ScorePlayer(context, mixer.music, score, startBeat, 'calm', false);
        for (let t = 0; t < 8; t += 0.025) {
          player!.setMood(t >= 2 && t < 5 ? 'combat' : 'calm');
          player!.tick(t);
        }
      }
      if (kind !== 'music') mixer.play('objective', undefined, { when: 0.5 });
      const buffer = await context.startRendering(),
        pcm = buffer.getChannelData(0);
      let peak = 0,
        windowRms = 0,
        silentWindows = 0;
      for (let start = rate; start + rate / 10 < pcm.length; start += rate / 20) {
        let sum = 0;
        for (let i = start; i < start + rate / 10; i++) sum += pcm[i] ** 2;
        const rms = Math.sqrt(sum / (rate / 10));
        windowRms = Math.max(windowRms, rms);
        if (rms < 0.00001) silentWindows++;
      }
      // Include feedback's initial transient when comparing foreground level.
      let feedbackRms = 0;
      for (let i = rate / 2; i < rate * 0.6; i++) feedbackRms += pcm[i] ** 2;
      feedbackRms = Math.sqrt(feedbackRms / (rate / 10));
      for (const sample of pcm) peak = Math.max(peak, Math.abs(sample));
      player?.dispose();
      return { peak, windowRms, feedbackRms, silentWindows, remaining: player?.activeVoices ?? 0 };
    };
    return {
      music: await render('music'),
      feedback: await render('feedback'),
      combined: await render('both'),
      wrap: await render('music', 220),
    };
  });
  expect(result.music.windowRms).toBeGreaterThan(0.005);
  expect(result.music.windowRms).toBeLessThan(result.feedback.feedbackRms * 0.6);
  expect(result.combined.peak).toBeLessThan(0.65);
  expect(result.music.silentWindows).toBe(0);
  expect(result.wrap.silentWindows).toBe(0);
  expect(result.music.remaining).toBe(0);
  expect(result.wrap.remaining).toBe(0);
});

test('live music releases all nodes on pause, retains position, and stays silent for other themes', async ({
  page,
}) => {
  await page.route('**/music-lifecycle', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Music lifecycle</title><button>Start</button>',
    }),
  );
  await page.goto('/music-lifecycle');
  const report = await page.evaluate(async () => {
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
    await context.resume();
    music.update(world, true);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 100 && !music.player; i++) await wait(25);
    if (!music.player) throw new Error('Music did not start');
    const first = music.player as ScorePlayer;
    world.shots++;
    music.update(world, true);
    await wait(100);
    const transition = first.transport.transition;
    music.pause();
    const beat = music.beat;
    for (let i = 0; i < 5; i++) {
      music.update(world, false);
      await wait(25);
    }
    const stopped = first.activeVoices;
    music.update(world, true);
    const resumed = music.player.transport.clock.beat;
    const second = music.player as ScorePlayer;
    music.update(createWorld(settlement), true);
    await wait(80);
    const day = second.activeVoices;
    music.update(createWorld(threshold), true);
    const sunset = music.player;
    music.reset();
    music.update(createWorld(depot), true);
    const restarted = music.player.transport.clock.beat;
    const third = music.player as ScorePlayer;
    world.status = 'won';
    music.update(world, true);
    await wait(80);
    const completed = third.activeVoices;
    await context.close();
    return { pending: transition?.beat, beat, stopped, resumed, day, sunset, restarted, completed };
  });
  expect(report.pending! % 4).toBe(0);
  expect(report.beat).toBeGreaterThan(0);
  expect(report.stopped).toBe(0);
  expect(report.resumed).toBeCloseTo(report.beat, 2);
  expect(report.day).toBe(0);
  expect(report.sunset).toBeNull();
  expect(report.restarted).toBe(0);
  expect(report.completed).toBe(0);
});
