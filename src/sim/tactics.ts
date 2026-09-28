import { distance, living } from './types';
import type { Guard, Person, Vec, World } from './types';
import { findPath, lineClear, passable } from './navigation';
import { weaponRange } from './weapons';

export const guardRole = (guard: Guard) =>
  guard.tactics?.role === 'sentry'
    ? 'Carbine sentry'
    : guard.tactics?.role === 'breacher'
      ? 'Breach officer'
      : 'Site guard';
export const guardDescription = (guard: Guard) =>
  guard.tactics?.role === 'sentry'
    ? 'Holds a lane. Moves into cover under fire or to reload. Needs a steady firing position.'
    : guard.tactics?.role === 'breacher'
      ? 'Closes through screened positions. Dangerous nearby; withdraw during its long firing recovery.'
      : 'Patrols, challenges intruders, and reports contact.';

/** Nearby partners can signal a sighting. This never copies an unseen person's live position. */
export function shareContact(world: World, guard: Guard, target: Person) {
  if (!guard.tactics) return;
  for (const other of world.guards) {
    if (
      other === guard ||
      !other.tactics ||
      !living(other) ||
      distance(guard, other) > 10 ||
      !lineClear(world, guard, other)
    )
      continue;
    other.mode = 'combat';
    other.lastSeen = { x: target.x, y: target.y };
    other.searchTime = 9;
    if (!other.known.includes(target.id)) other.known.push(target.id);
  }
}

/** A small authored set of reachable positions makes choices legible and bounds pathfinding. */
export function maneuver(world: World, guard: Guard, target: Person | undefined) {
  const tactic = guard.tactics;
  if (!tactic || !guard.lastSeen) return false;
  const hit = guard.hp < tactic.lastHp;
  tactic.lastHp = guard.hp;
  const threat = guard.lastSeen;
  const firing =
    target &&
    living(target) &&
    distance(guard, target) <= weaponRange(guard) &&
    lineClear(world, guard, target);
  if (tactic.goal) {
    if (tactic.cover && world.time < tactic.until) return true;
    if (guard.path.length && world.time < tactic.until) return !firing;
    tactic.goal = null;
  }
  if (world.time < tactic.nextMove) return false;
  const cover = hit || (guard.armament?.reload ?? 0) > 0;
  if (!cover && firing) return false;
  const choices = tactic.posts
    .filter((point) => {
      if (!passable(world, point) || distance(guard, point) < 0.5) return false;
      if (cover) return !lineClear(world, point, threat);
      if (tactic.role === 'sentry')
        return distance(point, threat) <= weaponRange(guard) && lineClear(world, point, threat);
      return distance(point, threat) < distance(guard, threat) - 0.75;
    })
    .sort((a, b) => score(a) - score(b));
  function score(point: Vec) {
    return (
      distance(guard, point) +
      (cover ? 0 : distance(point, threat) * 0.5 + (lineClear(world, point, threat) ? 3 : 0))
    );
  }
  // Replan at most once per second, including when no useful post is reachable.
  tactic.nextMove = world.time + 1;
  for (const point of choices.slice(0, 3)) {
    const path = findPath(world, guard, point);
    if (!path.length || distance(path.at(-1)!, point) > 0.3) continue;
    let length = 0,
      previous: Vec = guard;
    for (const p of path) {
      length += distance(previous, p);
      previous = p;
    }
    if (length > 12) continue;
    guard.path = path;
    tactic.goal = { ...point };
    tactic.cover = cover;
    tactic.until = world.time + length / 2.25 + (cover ? 1 : 0.2);
    tactic.nextMove = tactic.until + 0.8;
    return true;
  }
  return false;
}
