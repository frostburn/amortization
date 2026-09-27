import { distance } from './types';
import type { Vec, World } from './types';
import { BODY_RADIUS, canWalk, nearestFree } from './navigation';

/** Fit the squad around one anchor; an offset must never send someone across a wall. */
export function formationTargets(world: World, agents: Vec[], target: Vec): Vec[] {
  if (agents.length < 2) return agents.map(() => nearestFree(world, target));
  const approach = [...agents].sort((a, b) => distance(a, target) - distance(b, target))[0];
  const anchor = nearestFree(world, target, approach);
  const assigned: Vec[] = [];
  for (let i = 0; i < agents.length; i++) {
    const desired = {
      x: anchor.x + ((i % 2) - 0.5) * 0.8,
      y: anchor.y + (Math.floor(i / 2) - 0.5) * 0.8,
    };
    const fits = (p: Vec) =>
      canWalk(world, anchor, p) && assigned.every((q) => distance(p, q) >= BODY_RADIUS * 2 - 1e-7);
    if (fits(desired)) {
      assigned.push(desired);
      continue;
    }
    const candidates: Vec[] = [];
    for (let y = -4; y <= 4; y++)
      for (let x = -4; x <= 4; x++)
        candidates.push({ x: anchor.x + x * 0.4, y: anchor.y + y * 0.4 });
    candidates.sort((a, b) => distance(a, desired) - distance(b, desired));
    // Bodies may share a destination when a doorway cannot fit four separate slots.
    assigned.push(candidates.find(fits) ?? anchor);
  }
  return assigned;
}
