import { afterEach, expect, it, vi } from 'vitest';
import { Music, MusicDirector, MUSIC_PADDING } from '../src/audio/music';
import { depot } from '../src/content/depot';
import { settlement } from '../src/content/settlement';
import { threshold } from '../src/content/threshold';
import { createWorld } from '../src/sim/world';
import { stateHash } from '../src/replay/core';

it('uses fire or pursuit, holds through pauses in firing, then settles despite a latched alarm', () => {
  const world = createWorld(depot),
    director = new MusicDirector();
  expect(director.update(world)).toBe('calm');
  world.alarm = true;
  world.guards[0].mode = 'combat'; // Noise investigation, without a known target.
  expect(director.update(world)).toBe('calm');
  world.shots++;
  expect(director.update(world)).toBe('combat');
  world.time = 9;
  expect(director.update(world)).toBe('combat');
  world.time = 10;
  expect(director.update(world)).toBe('calm');
  world.guards[0].target = world.agents[0].id;
  const before = stateHash(world);
  expect(director.update(world)).toBe('combat');
  expect(stateHash(world)).toBe(before);
  world.guards[0].hp = 0;
  world.time = 20;
  expect(director.update(world)).toBe('calm');
  expect(director.update(createWorld(depot))).toBe('calm');
});

function fixture() {
  const sources: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    loopEnd: number;
  }[] = [];
  const param = () => ({
    value: 1,
    cancelAndHoldAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const context = {
    state: 'running',
    currentTime: 0,
    decodeAudioData: vi.fn(async () => ({})),
    createGain: () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() }),
    createBufferSource: () => {
      const source = {
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        loopEnd: 0,
      };
      sources.push(source);
      return source;
    },
  };
  return {
    context,
    sources,
    music: new Music(context as unknown as AudioContext, {} as AudioNode),
  };
}
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const response = () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
afterEach(() => vi.unstubAllGlobals());

it.each(['pause', 'replacement'] as const)(
  'downloads only for audible night play and late downloads cannot undo %s',
  async (interrupt) => {
    const { music, sources } = fixture();
    const resolves: ((value: ReturnType<typeof response>) => void)[] = [];
    const fetch = vi.fn(
      () =>
        new Promise<ReturnType<typeof response>>((r) => {
          resolves.push(r);
        }),
    );
    vi.stubGlobal('fetch', fetch);
    music.update(createWorld(settlement), true);
    music.update(createWorld(threshold), true);
    music.update(createWorld(depot), false);
    expect(fetch).not.toHaveBeenCalled();
    const world = createWorld(depot);
    music.update(world, true);
    expect(fetch).toHaveBeenCalledTimes(2);
    if (interrupt === 'pause') music.pause();
    else {
      music.reset();
      music.update(createWorld(settlement), true);
    }
    for (const resolve of resolves) resolve(response());
    await flush();
    expect(sources).toHaveLength(0);
    music.reset();
    music.update(createWorld(settlement), true);
    await flush();
    expect(sources).toHaveLength(0);
  },
);

it('changes at the same bar and native tempo, cancels pending starts, and resumes the paused beat', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response()),
  );
  const { context, music, sources } = fixture(),
    world = createWorld(depot);
  music.update(world, true);
  await flush();
  expect(sources).toHaveLength(1);
  expect(sources[0].loopEnd).toBeCloseTo(MUSIC_PADDING + 224 / 3);
  context.currentTime = 1.02; // Three beats after the source began.
  world.shots++;
  music.update(world, true);
  expect(sources).toHaveLength(2);
  const [when, offset] = sources[1].start.mock.calls[0];
  expect(when).toBeCloseTo(0.02 + 4 / 3);
  expect(offset).toBeCloseTo(MUSIC_PADDING + (4 * 60) / 200);
  expect(sources[1].loopEnd).toBeCloseTo(MUSIC_PADDING + (224 * 60) / 200);
  context.currentTime = 1.12; // Pause before that transition can start.
  music.pause();
  expect(sources[1].stop.mock.calls[0][0]).toBeLessThan(when);
  const stops = sources[0].stop.mock.calls.length;
  context.currentTime = 5;
  music.pause();
  expect(sources[0].stop.mock.calls).toHaveLength(stops); // No sliding release deadline.
  music.update(world, true);
  expect(sources).toHaveLength(3);
  expect(sources[2].start.mock.calls[0][1]).toBeCloseTo(MUSIC_PADDING + (3.3 * 60) / 200);
  music.reset();
  music.update(createWorld(depot), true);
  expect(sources.at(-1)!.start.mock.calls[0][1]).toBe(MUSIC_PADDING);
});

it('does not retry a failed download each frame; a new attempt can recover', async () => {
  const fetch = vi.fn(async () => {
    throw new Error('offline');
  });
  vi.stubGlobal('fetch', fetch);
  const { music } = fixture(),
    world = createWorld(depot);
  music.update(world, true);
  await flush();
  for (let i = 0; i < 30; i++) music.update(world, true);
  expect(fetch).toHaveBeenCalledTimes(2);
  music.reset();
  music.update(world, true);
  expect(fetch).toHaveBeenCalledTimes(4);
  await flush();
});
