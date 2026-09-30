import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { missions } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import { missionRecord, readRecords, recordWin } from '../src/ui/storage';
import type { Mission } from '../src/sim/types';

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());
function win(id: Mission['id'], seconds: number, alive = 4) {
  const w = createWorld(missions.find((m) => m.id === id)!);
  w.status = 'won';
  w.time = seconds;
  w.agents.forEach((a, i) => {
    a.hp = i < alive ? 100 : 0;
    a.captive = false;
  });
  return w;
}

it.each(missions)(
  'keeps full-crew records and earned medals across later costly wins for $id',
  ({ id }) => {
    const quiet = win(id, 100);
    quiet.disguiseTaken = true;
    recordWin(quiet);
    const loud = win(id, 110);
    loud.alarm = true;
    loud.guards[0].hp = 0;
    recordWin(loud);
    recordWin(win(id, 90, 2));
    const record = missionRecord(readRecords(), id);
    expect(record).toMatchObject({ best: 90, fullCrewBest: 100, completions: 3 });
    expect(record.medals).toEqual(
      expect.arrayContaining([
        'complete',
        'full-crew',
        'quiet',
        ...(id === 'bench' ? [] : ['nonlethal']),
        'no-kit',
        'live-alarm',
      ]),
    );
    expect(new Set(record.medals).size).toBe(record.medals.length);
    expect(data.has('amortization.records.v4')).toBe(true);
  },
);

it('migrates v1 and v2 without inventing survivors or historical challenge conditions', () => {
  data.set('amortization.records.v1', JSON.stringify({ version: 1, best: 40, completions: 2 }));
  expect(missionRecord(readRecords(), 'depot')).toEqual({
    best: 40,
    fullCrewBest: null,
    completions: 2,
    medals: ['complete'],
  });
  data.set(
    'amortization.records.v2',
    JSON.stringify({
      version: 2,
      missions: { depot: { best: 22, completions: 3, medals: ['nonlethal'] } },
    }),
  );
  expect(missionRecord(readRecords(), 'depot')).toEqual({
    best: 22,
    fullCrewBest: null,
    completions: 3,
    medals: ['complete'],
  });
  recordWin(win('archive', 65));
  expect(missionRecord(readRecords(), 'depot')).toMatchObject({
    best: 22,
    completions: 3,
    medals: ['complete'],
  });
  expect(missionRecord(readRecords(), 'archive')).toMatchObject({
    best: 65,
    fullCrewBest: 65,
    completions: 1,
  });
});

it('backfills only supported medals from v3 while preserving both records', () => {
  data.set(
    'amortization.records.v3',
    JSON.stringify({
      version: 3,
      missions: {
        depot: { best: 20, fullCrewBest: 35, completions: 4 },
        archive: { best: 30, fullCrewBest: null, completions: 1 },
        transfer: { best: 40, fullCrewBest: 10, completions: 1 },
      },
    }),
  );
  expect(missionRecord(readRecords(), 'depot')).toEqual({
    best: 20,
    fullCrewBest: 35,
    completions: 4,
    medals: ['complete', 'full-crew'],
  });
  expect(missionRecord(readRecords(), 'archive').medals).toEqual(['complete']);
  expect(missionRecord(readRecords(), 'transfer').fullCrewBest).toBeNull();
  recordWin(win('depot', 18, 2));
  expect(missionRecord(readRecords(), 'depot')).toEqual({
    best: 18,
    fullCrewBest: 35,
    completions: 5,
    medals: ['complete', 'full-crew'],
  });
});

it('filters duplicate, unknown and inapplicable medals from saved data', () => {
  data.set(
    'amortization.records.v4',
    JSON.stringify({
      version: 4,
      missions: {
        depot: {
          best: 20,
          fullCrewBest: 20,
          completions: 1,
          medals: ['quiet', 'quiet', '<script>', {}, 'untraced'],
        },
        archive: { best: -1, completions: 2, medals: ['complete'] },
      },
    }),
  );
  expect(missionRecord(readRecords(), 'depot').medals).toEqual(['complete', 'full-crew', 'quiet']);
  expect(readRecords().missions.archive).toBeUndefined();
});

it('does not award unfinished or failed attempts, even with a completed objective', () => {
  const w = win('injunction', 100);
  w.broadcast!.progress = w.mission.broadcast!.duration;
  for (const status of ['playing', 'lost'] as const) {
    w.status = status;
    expect(recordWin(w).missions.injunction).toBeUndefined();
  }
  w.status = 'won';
  for (const time of [0, -1, NaN, Infinity]) {
    w.time = time;
    expect(recordWin(w).missions.injunction).toBeUndefined();
  }
  expect(data.size).toBe(0);
});

it('ignores malformed data and keeps winning available when storage is blocked', () => {
  data.set('amortization.records.v4', '{');
  expect(readRecords().missions).toEqual({});
  vi.stubGlobal('localStorage', {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
  });
  expect(recordWin(win('archive', 60)).missions.archive).toMatchObject({
    best: 60,
    medals: expect.arrayContaining(['complete', 'full-crew']),
  });
});
