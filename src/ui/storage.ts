const KEY = 'amortization.records.v1';
interface Records {
  version: 1;
  best: number | null;
  completions: number;
}
const empty = (): Records => ({ version: 1, best: null, completions: 0 });
export function readRecords(): Records {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!data || typeof data !== 'object') return empty();
    const d = data as Record<string, unknown>;
    if (
      d.version !== 1 ||
      typeof d.best !== 'number' ||
      !Number.isFinite(d.best) ||
      d.best <= 0 ||
      typeof d.completions !== 'number' ||
      !Number.isInteger(d.completions) ||
      d.completions < 0
    )
      return empty();
    return { version: 1, best: d.best, completions: d.completions };
  } catch {
    return empty();
  }
}
export function recordWin(seconds: number): Records {
  const records = readRecords();
  records.best = Math.min(records.best ?? Infinity, seconds);
  records.completions++;
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* Gameplay remains available when browser storage is disabled. */
  }
  return records;
}
