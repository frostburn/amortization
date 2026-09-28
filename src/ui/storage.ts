import type { Mission } from '../sim/types';
import { missions } from '../content/missions';

const KEY = 'amortization.records.v3';
export interface MissionRecord {
  best: number | null;
  fullCrewBest: number | null;
  completions: number;
}
export interface Records {
  version: 3;
  missions: Partial<Record<Mission['id'], MissionRecord>>;
}
const empty = (): Records => ({ version: 3, missions: {} });
const validTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const valid = (
  value: unknown,
): value is { best: number; completions: number; fullCrewBest?: unknown } => {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return (
    validTime(d.best) &&
    typeof d.completions === 'number' &&
    Number.isInteger(d.completions) &&
    d.completions > 0
  );
};
export const missionRecord = (records: Records, id: Mission['id']): MissionRecord =>
  records.missions[id] ?? { best: null, fullCrewBest: null, completions: 0 };

export function readRecords(): Records {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem('amortization.records.v2');
    const data = JSON.parse(raw ?? 'null');
    const records = empty();
    if (
      (data?.version === 2 || data?.version === 3) &&
      data.missions &&
      typeof data.missions === 'object'
    ) {
      for (const { id } of missions)
        if (valid(data.missions[id])) {
          const prior = data.missions[id];
          records.missions[id] = {
            best: prior.best,
            completions: prior.completions,
            // Older records never stored survivors; do not invent full-crew wins.
            fullCrewBest:
              data.version === 3 &&
              validTime(prior.fullCrewBest) &&
              prior.fullCrewBest >= prior.best
                ? prior.fullCrewBest
                : null,
          };
        }
    } else if (raw === null) {
      const legacy = JSON.parse(localStorage.getItem('amortization.records.v1') ?? 'null');
      if (legacy?.version === 1 && valid(legacy))
        records.missions.depot = {
          best: legacy.best,
          fullCrewBest: null,
          completions: legacy.completions,
        };
    }
    return records;
  } catch {
    return empty();
  }
}
export function recordWin(id: Mission['id'], seconds: number, alive: number): Records {
  const records = readRecords();
  if (!validTime(seconds) || !Number.isInteger(alive) || alive < 1 || alive > 4) return records;
  const prior = missionRecord(records, id);
  records.missions[id] = {
    best: Math.min(prior.best ?? Infinity, seconds),
    fullCrewBest:
      alive === 4 ? Math.min(prior.fullCrewBest ?? Infinity, seconds) : prior.fullCrewBest,
    completions: prior.completions + 1,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* Gameplay remains available when browser storage is disabled. */
  }
  return records;
}
