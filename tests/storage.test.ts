import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { missionRecord, readRecords, recordWin } from '../src/ui/storage';
let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
});
afterEach(() => vi.unstubAllGlobals());
it('migrates depot records and keeps mission times independent', () => {
  data.set('amortization.records.v1', JSON.stringify({ version: 1, best: 40, completions: 2 }));
  expect(missionRecord(readRecords(), 'depot')).toEqual({
    best: 40,
    fullCrewBest: null,
    completions: 2,
  });
  recordWin('archive', 65, 4);
  const records = recordWin('archive', 70, 3);
  expect(missionRecord(records, 'archive')).toEqual({ best: 65, fullCrewBest: 65, completions: 2 });
  expect(missionRecord(records, 'depot')).toEqual({ best: 40, fullCrewBest: null, completions: 2 });
  recordWin('transfer', 82, 3);
  expect(missionRecord(readRecords(), 'transfer')).toEqual({
    best: 82,
    fullCrewBest: null,
    completions: 1,
  });
  expect(missionRecord(readRecords(), 'archive')).toEqual({
    best: 65,
    fullCrewBest: 65,
    completions: 2,
  });
  recordWin('custody', 95, 4);
  recordWin('broadcast', 108, 4);
  recordWin('severance', 120, 4);
  expect(missionRecord(readRecords(), 'severance')).toEqual({
    best: 120,
    fullCrewBest: 120,
    completions: 1,
  });
  expect(missionRecord(readRecords(), 'broadcast')).toEqual({
    best: 108,
    fullCrewBest: 108,
    completions: 1,
  });
  expect(missionRecord(readRecords(), 'custody')).toEqual({
    best: 95,
    fullCrewBest: 95,
    completions: 1,
  });
  expect(missionRecord(readRecords(), 'transfer')).toEqual({
    best: 82,
    fullCrewBest: null,
    completions: 1,
  });
});
it('ignores malformed records and survives unavailable storage', () => {
  data.set('amortization.records.v2', '{');
  expect(readRecords().missions).toEqual({});
  vi.stubGlobal('localStorage', {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
  });
  expect(recordWin('archive', 60, 4).missions.archive?.best).toBe(60);
});

it('migrates v2 without inventing survivors and keeps a faster costly win separate', () => {
  data.set(
    'amortization.records.v2',
    JSON.stringify({ version: 2, missions: { depot: { best: 22, completions: 3 } } }),
  );
  expect(missionRecord(readRecords(), 'depot')).toEqual({
    best: 22,
    fullCrewBest: null,
    completions: 3,
  });
  recordWin('depot', 40, 4);
  recordWin('depot', 18, 2);
  expect(missionRecord(readRecords(), 'depot')).toEqual({
    best: 18,
    fullCrewBest: 40,
    completions: 5,
  });
  recordWin('depot', 35, 4);
  expect(missionRecord(readRecords(), 'depot')).toEqual({
    best: 18,
    fullCrewBest: 35,
    completions: 6,
  });
});

it('rejects impossible survivor counts and invalid full-crew times', () => {
  data.set(
    'amortization.records.v3',
    JSON.stringify({
      version: 3,
      missions: {
        depot: { best: 20, completions: 1, fullCrewBest: 10 },
        archive: { best: 30, completions: 1, fullCrewBest: 'fast' },
      },
    }),
  );
  expect(missionRecord(readRecords(), 'depot').fullCrewBest).toBeNull();
  expect(missionRecord(readRecords(), 'archive').fullCrewBest).toBeNull();
  for (const alive of [0, 5, 2.5])
    expect(recordWin('transfer', 50, alive).missions.transfer).toBeUndefined();
});
