import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { Music, MusicDirector } from '../src/audio/music';
import { Transport } from '../src/audio/score/transport';
import { pitchAt } from '../src/audio/score/player';
import data from '../src/audio/score/negative-carry.json';
import type { Score, ScoreNote } from '../src/audio/score/types';
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
  world.guards[0].mode = 'combat';
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
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
afterEach(() => vi.restoreAllMocks());

it.each(['pause', 'replacement'] as const)(
  'a late score import cannot undo %s; pause retains musical position',
  async (interrupt) => {
    const players: { beat: number; stop: ReturnType<typeof vi.fn> }[] = [];
    class FakePlayer {
      transport = { beatAt: () => 3.3 };
      stop = vi.fn();
      setMood = vi.fn();
      constructor(_context: unknown, _output: unknown, _score: unknown, beat: number) {
        players.push({ beat, stop: this.stop });
      }
    }
    type Module = typeof import('../src/audio/score');
    let resolve!: (module: Module) => void;
    const module = { score: data, ScorePlayer: FakePlayer } as unknown as Module;
    const load = vi.fn(
      () =>
        new Promise<Module>((r) => {
          resolve = r;
        }),
    );
    const music = new Music(
      { state: 'running', currentTime: 0 } as AudioContext,
      {} as AudioNode,
      load,
    );
    music.update(createWorld(settlement), true);
    music.update(createWorld(threshold), true);
    music.update(createWorld(depot), false);
    expect(load).not.toHaveBeenCalled();
    const world = createWorld(depot);
    music.update(world, true);
    expect(load).toHaveBeenCalledTimes(1);
    if (interrupt === 'pause') music.pause();
    else {
      music.reset();
      music.update(createWorld(settlement), true);
    }
    resolve(module);
    await flush();
    expect(players).toHaveLength(0);
    music.update(world, true);
    expect(players).toHaveLength(1);
    music.pause();
    music.pause();
    expect(players[0].stop).toHaveBeenCalledTimes(1);
    music.update(world, true);
    expect(players[1].beat).toBe(3.3);
    music.reset();
    music.update(world, true);
    expect(players[2].beat).toBe(0);
    expect(load).toHaveBeenCalledTimes(1);
  },
);

it('bounds failed module retries while keeping effects usable', async () => {
  const load = vi.fn(async () => {
    throw new Error('offline');
  });
  const music = new Music({ state: 'running' } as AudioContext, {} as AudioNode, load),
    world = createWorld(depot);
  music.update(world, true);
  await flush();
  for (let i = 0; i < 30; i++) music.update(world, true);
  expect(load).toHaveBeenCalledTimes(1);
  music.reset();
  music.update(world, true);
  await flush();
  expect(load).toHaveBeenCalledTimes(2);
});

const note = (beat: number, duration: number, mask = 3): ScoreNote => ({
  beat,
  duration,
  mask,
  voice: 0,
  fx: false,
  pitch: { initial: 0, curves: [] },
});
function transport(notes: ScoreNote[], beat = 0) {
  const played: {
    note: ScoreNote;
    start: number;
    from: number;
    when: number;
    retime: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  }[] = [];
  const score = { ...data, beats: 16, notes } as unknown as Score;
  const clock = new Transport(score, beat, 0.02, 'calm', (note, start, from, when) => {
    const voice = { note, start, from, when, retime: vi.fn(), release: vi.fn() };
    played.push(voice);
    return voice;
  });
  return { clock, played };
}
it('switches at one bar, retains common held notes, and retimes their release at the new tempo', () => {
  const { clock, played } = transport([note(0, 8), note(2, 6, 1), note(2, 6, 2), note(4, 1, 2)]);
  for (let t = 0; t < 0.9; t += 0.025) clock.advance(t, 'calm');
  clock.advance(0.9, 'combat');
  expect(clock.transition?.beat).toBe(4);
  const boundary = 0.02 + 4 / 3;
  expect(clock.transition?.when).toBeCloseTo(boundary);
  for (let t = 0.9; t <= boundary - 0.08; t += 0.025) clock.advance(t, 'combat');
  expect(played.filter((p) => p.note.mask === 3)).toHaveLength(1);
  expect(played[0].retime).toHaveBeenCalledWith(4);
  const calm = played.find((p) => p.note.mask === 1)!;
  expect(calm.release).toHaveBeenCalledWith(boundary);
  const joining = played.find((p) => p.note.mask === 2 && p.start === 2)!;
  expect(joining.from).toBe(4);
  expect(joining.when).toBeCloseTo(boundary);
  // Advance normally so the intentional long-stall recovery is not triggered.
  for (let t = boundary; t <= boundary + 1.2; t += 0.05) clock.advance(t, 'combat');
  expect(played[0].release).toHaveBeenCalledTimes(1);
  expect(played[0].release.mock.calls[0][0]).toBeCloseTo(boundary + (4 * 60) / 200);
  expect(clock.beatAt(boundary + 0.6)).toBeCloseTo(6);
});
it('cancels uncommitted changes, wraps the form without restarting voices, and skips stalled percussion', () => {
  const { clock, played } = transport([
    note(0, 1),
    note(15, 3),
    { ...note(3, 0.5), pitch: undefined },
  ]);
  for (let t = 0; t < 0.5; t += 0.025) clock.advance(t, 'calm');
  clock.advance(0.5, 'combat');
  expect(clock.transition).not.toBeNull();
  clock.advance(0.6, 'calm');
  expect(clock.transition).toBeNull();
  clock.advance(2, 'calm'); // Skip the missed drum, not catch it up.
  expect(played.some((p) => !p.note.pitch)).toBe(false);
  for (let t = 2; t < 6; t += 0.025) clock.advance(t, 'calm');
  expect(played.filter((p) => p.start === 15)).toHaveLength(1);
  expect(played.filter((p) => p.start === 16)).toHaveLength(1);
  expect(played.find((p) => p.start === 15)!.release.mock.calls[0][0]).toBeCloseTo(0.02 + 18 / 3);
});
it('resumes inside a held melody at the current pitch; authored arrangements share most voices', () => {
  const { played } = transport([note(0, 8), { ...note(2, 3), pitch: undefined }], 3);
  expect(played).toHaveLength(1);
  expect(played[0].from).toBe(3);
  for (const [index, name] of ['negative-carry', 'negative-carry-combat'].entries()) {
    const source = readFileSync(new URL(`../music/${name}.xenpaper.json`, import.meta.url));
    expect(createHash('sha256').update(source).digest('hex')).toBe(data.sources[index]);
  }
  const score = data as unknown as Score;
  expect(score.beats).toBe(224);
  expect(score.bpm).toEqual({ calm: 180, combat: 200 });
  expect(score.notes.filter((n) => n.mask === 3).length).toBeGreaterThan(550);
  expect(score.notes.every((n) => n.beat >= 0 && n.beat < score.beats)).toBe(true);
  const glide = score.notes.find((n) => n.pitch?.curves.length)!;
  const curve = glide.pitch!.curves[0];
  expect(pitchAt(glide.pitch!, curve.offset)).toBeCloseTo(curve.values[0]);
  expect(pitchAt(glide.pitch!, curve.offset + curve.duration)).toBeCloseTo(curve.values.at(-1)!);
  for (const recipe of [...score.recipes, score.effect])
    for (const command of [...recipe.on, ...recipe.off])
      expect(Number.isFinite(command[3])).toBe(true);
});
