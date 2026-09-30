import { position, floorOf } from './types';
import { findPath, lineClear, obstacles, passable } from './navigation';
import { distance, living } from './types';
import type { Guard, Vec, World } from './types';
import { GUNFIRE_HEARING, sees } from './vision';

/** A hit supplies a fixed incoming-fire position, even beyond hearing range.
 * It does not identify the shooter or track their subsequent unseen movement. */
export function receiveFire(w: World, g: Guard, from: Vec) {
  // Audible shots already enter the normal combat/cover response. Bridge the
  // unhandled gap for a direct hit whose source cannot be heard or seen.
  if (!living(g) || g.turret || distance(g, from) <= GUNFIRE_HEARING || sees(w, g, from)) return;
  const source = position(from);
  if (!g.incoming) {
    g.incoming = { source, until: 0, nextMove: 0, goal: null };
    g.path = [];
  }
  g.incoming.source = source;
  g.incoming.until = Math.max(g.incoming.until, w.time + 5);
  g.mode = 'combat';
  g.lastSeen = source;
  g.searchTime = 10;
  g.repath = 0;
  if (!g.reported && g.radio <= 0) g.radio = 2.5;
}

/** Local physical cover only: inspect at most six nearby obstacles, try at most
 * three short paths, and keep the chosen route through subsequent shots. */
export function evadeFire(w: World, g: Guard): boolean {
  const fire = g.incoming;
  if (!fire) return false;
  if (w.time >= fire.until) {
    delete g.incoming;
    return false;
  }
  g.lastSeen = fire.source;
  if (!lineClear(w, g, fire.source)) {
    g.path = [];
    return true;
  }
  if (fire.goal && g.path.length && !lineClear(w, fire.goal, fire.source)) return true;
  if (w.time < fire.nextMove) return false;
  fire.nextMove = w.time + 1;
  fire.goal = null;
  const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
  const nearby = obstacles(w, floorOf(g))
    .map((r) => ({
      r,
      d: distance(g, {
        ...position(g),
        x: clamp(g.x, r.x, r.x + r.w),
        y: clamp(g.y, r.y, r.y + r.h),
      }),
    }))
    .filter(({ d }) => d <= 8)
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  const candidates: Vec[] = [...(g.tactics?.posts ?? [])];
  for (const { r } of nearby) {
    const left = r.x - 0.35,
      right = r.x + r.w + 0.35,
      top = r.y - 0.35,
      bottom = r.y + r.h + 0.35;
    for (const x of [left, r.x + r.w / 2, right])
      for (const y of [top, r.y + r.h / 2, bottom])
        if (x === left || x === right || y === top || y === bottom) candidates.push({ x, y });
    const x = clamp(g.x, r.x, r.x + r.w),
      y = clamp(g.y, r.y, r.y + r.h);
    candidates.push({ x, y: top }, { x, y: bottom }, { x: left, y }, { x: right, y });
  }
  const unique = [
    ...new Map(
      candidates.map((p) => [`${p.x},${p.y}`, { ...p, ...(g.floor ? { floor: g.floor } : {}) }]),
    ).values(),
  ];
  const choices = unique
    .filter(
      (p) =>
        distance(g, p) >= 0.3 &&
        distance(g, p) <= 8 &&
        passable(w, p) &&
        !lineClear(w, p, fire.source),
    )
    .sort((a, b) => distance(g, a) - distance(g, b));
  for (const point of choices.slice(0, 3)) {
    const path = findPath(w, g, point);
    if (!path.length || distance(path.at(-1)!, point) > 0.3) continue;
    let length = 0,
      prior: Vec = g;
    for (const p of path) {
      length += distance(prior, p);
      prior = p;
    }
    if (length > 10) continue;
    g.path = path;
    fire.goal = point;
    fire.until = Math.max(fire.until, w.time + length / 2.25 + 2);
    return true;
  }
  // No shelter: ordinary combat advances toward the last shot position.
  return false;
}
