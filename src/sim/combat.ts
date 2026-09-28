import { distance, living } from './types';
import type { Person, World } from './types';
import { lineClear } from './navigation';
import { WEAPONS, weaponRange } from './weapons';

export function shoot(world: World, from: Person, to: Person, hostile: boolean): boolean {
  if (
    from.cooldown > 0 ||
    !living(from) ||
    !living(to) ||
    (from.armament &&
      (from.armament.reload > 0 || from.armament.settle > 0 || from.armament.rounds <= 0)) ||
    distance(from, to) > weaponRange(from) ||
    !lineClear(world, from, to)
  )
    return false;
  from.angle = Math.atan2(to.y - from.y, to.x - from.x);
  const gun = from.armament,
    spec = gun && WEAPONS[gun.kind];
  from.cooldown = spec ? spec.interval : hostile ? 0.8 : 0.52;
  to.hp = Math.max(0, to.hp - (spec ? spec.damage : hostile ? 16 : 17));
  if (gun && spec && --gun.rounds === 0) gun.reload = spec.reload;
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
