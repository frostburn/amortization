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
  expect(missionRecord(readRecords(), 'depot')).toEqual({ best: 40, completions: 2 });
  recordWin('archive', 65);
  const records = recordWin('archive', 70);
  expect(missionRecord(records, 'archive')).toEqual({ best: 65, completions: 2 });
  expect(missionRecord(records, 'depot')).toEqual({ best: 40, completions: 2 });
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
  expect(recordWin('archive', 60).missions.archive?.best).toBe(60);
});
