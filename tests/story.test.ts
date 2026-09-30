import { afterEach, expect, it, vi } from 'vitest';
import { createWorld } from '../src/sim/world';
import { readRecords, recordWin } from '../src/ui/storage';
import { storyUnlocked } from '../src/ui/story';

afterEach(() => vi.unstubAllGlobals());

it('unlocks scenes from existing completion records without requiring a new campaign', () => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) =>
      key === 'amortization.records.v2'
        ? JSON.stringify({ version: 2, missions: { clearing: { best: 120, completions: 2 } } })
        : null,
  });
  const records = readRecords();
  expect(storyUnlocked('opening', records)).toBe(true);
  expect(storyUnlocked('clearing', records)).toBe(true);
  expect(storyUnlocked('depot', records)).toBe(false);
  expect(storyUnlocked('mandate', records)).toBe(false);
});

it('requires a win but still awards a scene with casualties or unavailable storage', () => {
  vi.stubGlobal('localStorage', {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
  });
  const world = createWorld();
  world.time = 60;
  world.agents[1].hp = 0;
  for (const status of ['playing', 'lost', 'won'] as const) {
    world.status = status;
    const records = recordWin(world);
    expect(storyUnlocked('opening', records)).toBe(true);
    expect(storyUnlocked('depot', records)).toBe(status === 'won');
  }
});
