import { controllable } from '../sim/types';
import type { Mission, World } from '../sim/types';
import { missions } from '../content/missions';
import { earnedMedals, medalsFor } from './medals';
import type { MedalId } from './medals';

const KEY = 'amortization.records.v4';
export interface MissionRecord {
  best: number | null;
  fullCrewBest: number | null;
  completions: number;
  medals: MedalId[];
}
export interface Records {
  version: 4;
  missions: Partial<Record<Mission['id'], MissionRecord>>;
}
const empty = (): Records => ({ version: 4, missions: {} });
const validTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const valid = (
  value: unknown,
): value is { best: number; completions: number; fullCrewBest?: unknown; medals?: unknown } => {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  return validTime(d.best) && Number.isSafeInteger(d.completions) && Number(d.completions) > 0;
};
export const missionRecord = (records: Records, id: Mission['id']): MissionRecord =>
  records.missions[id] ?? { best: null, fullCrewBest: null, completions: 0, medals: [] };

export function readRecords(): Records {
  try {
    const raw =
      localStorage.getItem(KEY) ??
      localStorage.getItem('amortization.records.v3') ??
      localStorage.getItem('amortization.records.v2');
    const data = JSON.parse(raw ?? 'null');
    const records = empty();
    if ([2, 3, 4].includes(data?.version) && data.missions && typeof data.missions === 'object') {
      for (const mission of missions) {
        const prior = data.missions[mission.id];
        if (!valid(prior)) continue;
        // Only completion and full-crew medals can be established by old records.
        const fullCrewBest =
          data.version >= 3 && validTime(prior.fullCrewBest) && prior.fullCrewBest >= prior.best
            ? prior.fullCrewBest
            : null;
        const earned = new Set<unknown>(
          data.version === 4 && Array.isArray(prior.medals) ? prior.medals : [],
        );
        earned.add('complete');
        if (fullCrewBest !== null) earned.add('full-crew');
        records.missions[mission.id] = {
          best: prior.best,
          completions: prior.completions,
          fullCrewBest,
          medals: medalsFor(mission)
            .filter((m) => earned.has(m.id))
            .map((m) => m.id),
        };
      }
    } else if (raw === null) {
      const legacy = JSON.parse(localStorage.getItem('amortization.records.v1') ?? 'null');
      if (legacy?.version === 1 && valid(legacy))
        records.missions.depot = {
          best: legacy.best,
          fullCrewBest: null,
          completions: legacy.completions,
          medals: ['complete'],
        };
    }
    return records;
  } catch {
    return empty();
  }
}

export function recordWin(world: World): Records {
  const records = readRecords(),
    { mission, time: seconds } = world,
    alive = world.agents.filter(controllable).length;
  if (world.status !== 'won' || !validTime(seconds) || alive < 1 || alive > 4) return records;
  const prior = missionRecord(records, mission.id),
    earned = new Set([...prior.medals, ...earnedMedals(world)]);
  records.missions[mission.id] = {
    best: Math.min(prior.best ?? Infinity, seconds),
    fullCrewBest:
      alive === 4 ? Math.min(prior.fullCrewBest ?? Infinity, seconds) : prior.fullCrewBest,
    completions: prior.completions + 1,
    medals: medalsFor(mission)
      .filter((m) => earned.has(m.id))
      .map((m) => m.id),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* Gameplay remains available when browser storage is disabled. */
  }
  return records;
}
