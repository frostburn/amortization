import { controllable, disoriented, distance } from './types';
import type { Guard, World } from './types';
import { sees } from './awareness';

export const CREDENTIAL_RANGE = 4;
export const CREDENTIAL_TIME = 2.5;

/** A local, visible check. Leaving sight/range cancels it; no global identity scan. */
export function inspectCredentials(w: World, g: Guard, dt: number) {
  if (g.tactics?.role !== 'inspector') return null;
  const suspect =
    !disoriented(g) &&
    w.agents.find(
      (a) =>
        controllable(a) &&
        a.disguised &&
        !g.known.includes(a.id) &&
        distance(g, a) <= CREDENTIAL_RANGE &&
        sees(w, g, a),
    );
  if (!suspect) {
    delete g.inspection;
    return null;
  }
  if (g.inspection?.target !== suspect.id) g.inspection = { target: suspect.id, progress: 0 };
  g.inspection.progress = Math.min(CREDENTIAL_TIME, g.inspection.progress + dt);
  return g.inspection.progress >= CREDENTIAL_TIME ? suspect.id : null;
}
