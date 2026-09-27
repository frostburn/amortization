import { distance, living } from './types';
import type { Person, World } from './types';
import { lineClear } from './navigation';

export const WEAPON_RANGE = 8;

export function shoot(world: World, from: Person, to: Person, hostile: boolean): boolean {
  if (
    from.cooldown > 0 ||
    !living(to) ||
    distance(from, to) > WEAPON_RANGE ||
    !lineClear(world, from, to)
  )
    return false;
  from.angle = Math.atan2(to.y - from.y, to.x - from.x);
  from.cooldown = hostile ? 0.8 : 0.52;
  to.hp = Math.max(0, to.hp - (hostile ? 16 : 17));
  world.traces.push({
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    life: 0.12,
    hostile,
  });
  world.sounds.push({ kind: 'shot', x: from.x });
  world.shots++;
  if (!living(to)) {
    to.path = [];
    world.casualties++;
  }
  return true;
}
