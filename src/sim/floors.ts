import { dacreDefeated } from './finale';
import { floorOf, living, position, sameFloor, distance } from './types';
import type { ObjectKind, Person, Vec, World } from './types';
import { findPath } from './navigation';
import { cancelCharge } from './weapons';

export const isStairs = (id: ObjectKind) => id === 'stairs-up' || id === 'stairs-down';
export function stairDestination(w: World, p: Vec): Vec | undefined {
  return w.mission.building?.stairs[floorOf(p) ? 0 : 1];
}
export function changeFloor(p: Person, destination: Vec) {
  Object.assign(p, position(destination));
  if (!destination.floor) delete p.floor;
  p.previous = position(p);
  p.path = [];
  cancelCharge(p);
}
/** A cuffed/friendly escort walks back to the stairs, never teleports through the ceiling. */
export function followStairs(w: World, leader: Vec) {
  const p = w.escort,
    stairs = w.mission.building?.stairs;
  if (!p || !stairs || p.waiting || sameFloor(p, leader)) return false;
  const entrance = stairs[floorOf(p)];
  if (distance(p, entrance) < 0.8) changeFloor(p, stairs[floorOf(leader)]);
  else if (!p.path.length || p.repath <= 0) {
    p.path = findPath(w, p, entrance);
    p.repath = 0.45;
  }
  return true;
}
export const combatTarget = (w: World, id: string) =>
  w.guards.find((g) => g.id === id && living(g)) ??
  ((w.mission.continuity || w.mission.finale) &&
  w.escort?.id === id &&
  living(w.escort) &&
  !w.escort.recruited
    ? w.escort
    : undefined);
export const captureReady = (w: World) =>
  w.mission.finale
    ? dacreDefeated(w) && !!w.finale?.open
    : !w.mission.continuity ||
      ['power-west', 'power-east'].every((id) => w.security?.isolated.some((p) => p === id));
export const kestrelRemoved = (w: World) => !!w.escort && (!living(w.escort) || w.escort.recruited);
export const activeCircuit = (w: World) =>
  Math.floor(w.time / (w.mission.continuity?.cycle ?? 12)) % 2 ? 'power-east' : 'power-west';
