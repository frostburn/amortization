import { findPath, intersects } from './navigation';
import { inside } from './types';
import type { Mission, Vec, World } from './types';

const perimeters = new WeakMap<Mission, Mission>();

/** Prefer the public perimeter when both ends of an extraction order are outside.
 * Ordinary move orders still use exactly the ground the player chose. */
export function extractionPath(w: World, from: Vec, to: Vec): Vec[] {
  const direct = findPath(w, from, to),
    area = w.mission.restricted;
  if (
    !w.mission.perimeterExtraction ||
    inside(from, area) ||
    inside(to, area) ||
    !direct.some((p, i) => intersects(i ? direct[i - 1] : from, p, area))
  )
    return direct;
  let perimeter = perimeters.get(w.mission);
  if (!perimeter) {
    perimeter = { ...w.mission, solids: [] };
    perimeters.set(w.mission, perimeter);
  }
  // Keep a stable mission identity for the grid cache, while reflecting geometry edits.
  Object.assign(perimeter, w.mission, {
    solids: [...w.mission.solids, { ...area, id: 'public-perimeter', kind: 'wall', height: 0 }],
  });
  const outside = findPath({ ...w, mission: perimeter }, from, to);
  return outside.length ? outside : direct;
}
