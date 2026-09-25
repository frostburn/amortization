import type { Mission } from '../sim/types';

const KEY = 'amortization.records.v2';
export interface MissionRecord {
  best: number | null;
  completions: number;
}
export interface Records {
  version: 2;
  missions: Partial<Record<Mission['id'], MissionRecord>>;
}
const empty = (): Records => ({ version: 2, missions: {} });
const valid = (value: unknown): value is MissionRecord => {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.best === 'number' &&
    Number.isFinite(d.best) &&
    d.best > 0 &&
    typeof d.completions === 'number' &&
    Number.isInteger(d.completions) &&
    d.completions > 0
  );
};
export const missionRecord = (records: Records, id: Mission['id']): MissionRecord =>
  records.missions[id] ?? { best: null, completions: 0 };

export function readRecords(): Records {
  try {
    const raw = localStorage.getItem(KEY);
    const data = JSON.parse(raw ?? 'null');
    const records = empty();
    if (data?.version === 2 && data.missions && typeof data.missions === 'object') {
      for (const id of ['depot', 'archive'] as const)
        if (valid(data.missions[id])) records.missions[id] = { ...data.missions[id] };
    } else if (raw === null) {
      const legacy = JSON.parse(localStorage.getItem('amortization.records.v1') ?? 'null');
      if (legacy?.version === 1 && valid(legacy))
        records.missions.depot = { best: legacy.best, completions: legacy.completions };
    }
    return records;
  } catch {
    return empty();
  }
}
export function recordWin(id: Mission['id'], seconds: number): Records {
  const records = readRecords();
  if (!Number.isFinite(seconds) || seconds <= 0) return records;
  const prior = missionRecord(records, id);
  records.missions[id] = {
    best: Math.min(prior.best ?? Infinity, seconds),
    completions: prior.completions + 1,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* Gameplay remains available when browser storage is disabled. */
  }
  return records;
}
