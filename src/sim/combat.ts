import { distance, living } from './types';
import type { Person, World } from './types';
import { lineClear } from './navigation';
import { cancelCharge, COIL_CHARGE, WEAPONS, weaponRange } from './weapons';

export function shoot(
  world: World,
  from: Person,
  to: Person,
  hostile: boolean,
  dt = 1 / 30,
): boolean {
  if (
    from.cooldown > 0 ||
    !living(from) ||
    !living(to) ||
    (from.armament &&
      (from.armament.reload > 0 || from.armament.settle > 0 || from.armament.rounds <= 0)) ||
    distance(from, to) > weaponRange(from) ||
    !lineClear(world, from, to)
  ) {
    cancelCharge(from);
    return false;
  }
  from.angle = Math.atan2(to.y - from.y, to.x - from.x);
  const gun = from.armament,
    spec = gun && WEAPONS[gun.kind];
  if (gun?.kind === 'coil') {
    // A visible, uninterrupted lock is required for every shot, on either side.
    if (from.path.length || distance(from, from.previous) > 1e-6) {
      cancelCharge(from);
      return false;
    }
    if (gun.charging?.target !== to.id) gun.charging = { target: to.id, remaining: COIL_CHARGE };
    gun.charging.remaining = Math.max(0, gun.charging.remaining - dt);
    if (gun.charging.remaining > 1e-8) return false;
    cancelCharge(from);
  }
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
    cancelCharge(to);
    to.path = [];
    world.casualties++;
  }
  return true;
}
