import { facingAngle } from './shield';
import { disoriented, distance } from './types';
import type { Guard, Vec, World } from './types';
import { lineClear } from './navigation';
import { weaponRange } from './weapons';

export const GUNFIRE_HEARING = 12;
export const sightRange = (guard: Guard, world?: World) =>
  (guard.armament ? Math.max(7.5, weaponRange(guard)) : 7.5) *
  (world?.mission.daylight && !guard.turret ? 1.5 : 1);

export function sees(world: World, guard: Guard, person: Vec): boolean {
  if (disoriented(guard)) return false;
  const range = distance(guard, person);
  if (range > sightRange(guard, world) || !lineClear(world, guard, person)) return false;
  if (range < 1.3) return true;
  const angle = Math.atan2(person.y - guard.y, person.x - guard.x) - facingAngle(guard);
  return Math.cos(angle) > Math.cos(Math.PI * 0.36);
}
