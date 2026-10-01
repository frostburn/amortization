import { afterEach, expect, it, vi } from 'vitest';
import { createWorld } from '../src/sim/world';
import { readRecords, recordWin } from '../src/ui/storage';
import { sceneFor, storyUnlocked } from '../src/ui/story';
import { revealSchedule } from '../src/ui/story-reveal';
import { benchScene } from '../src/content/mission-copy';
import { CREW } from '../src/sim/crew';

afterEach(() => vi.unstubAllGlobals());

it('gives every surviving crew combination a homecoming without resurrecting anyone', () => {
  for (let mask = 1; mask < 16; mask++) {
    const survivors = CREW.filter((_, i) => mask & (1 << i)).map((a) => a.id);
    for (const holt of ['custody', 'eliminated'] as const) {
      const scene = benchScene({ survivors, holt });
      for (const a of CREW)
        expect(scene.beats.some((beat) => beat.speaker === a.id)).toBe(survivors.includes(a.id));
      const text = scene.beats.map((beat) => beat.text).join(' ');
      expect(text).toContain('Glasses up.');
      expect(text).toContain(
        holt === 'custody' ? 'Holt is in custody.' : 'Holt and Dacre are gone.',
      );
      expect(text.includes('We won’t forget.')).toBe(survivors.length < 4);
      expect(scene.beats.every((beat) => revealSchedule(beat.text, beat.speaker).length > 0)).toBe(
        true,
      );
    }
  }
});

it('replays legacy finale records without inventing casualties or the chairman’s fate', () => {
  const record = { best: 100, fullCrewBest: null as number | null, completions: 1, medals: [] };
  const records = { version: 4 as const, missions: { bench: record } };
  const unknown = sceneFor('bench', records);
  expect(unknown.beats.every((b) => b.speaker === 'voss' || b.speaker === 'mara')).toBe(true);
  record.fullCrewBest = 100;
  const full = sceneFor('bench', records);
  expect(CREW.every((a) => full.beats.some((b) => b.speaker === a.id))).toBe(true);
  expect(full.beats.map((b) => b.text).join(' ')).not.toMatch(
    /Holt is in custody|Holt and Dacre are gone/,
  );
});

it('reveals whole graphemes with silent punctuation and individual reading cadence', () => {
  const text = 'A\u0308 👩‍🔧, wait. Yes!';
  const fast = revealSchedule(text, 'voss'),
    slow = revealSchedule(text, 'holt');
  expect(fast[0].end).toBe(2);
  expect(fast[2].end).toBe(8); // The joined emoji is one visual unit.
  expect(fast.at(-1)!.end).toBe(text.length);
  expect(fast.filter((p) => p.key)).toHaveLength(8);
  expect(fast.every((p, i) => i === 0 || p.at > fast[i - 1].at)).toBe(true);
  expect(slow.at(-1)!.at).toBeGreaterThan(fast.at(-1)!.at * 1.3);
  const sentence = fast.findIndex((p) => text[p.end - 1] === '.');
  expect(fast[sentence + 1].at - fast[sentence].at).toBeGreaterThan(200);
});

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
