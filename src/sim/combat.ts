import { position } from './types';
import { disoriented, distance, living } from './types';
import type { Person, World } from './types';
import { readiness, suppress } from './pressure';
import { shieldFaces } from './shield';
import { receiveFire } from './incoming-fire';
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
    disoriented(from) ||
    ('disarmed' in from && from.disarmed === true) ||
    ('captive' in from && from.captive === true) ||
    ('captive' in to && to.captive === true) ||
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
  if ('shield' in from && from.shield && !shieldFaces(from, to, Math.PI / 6)) return false;
  const gun = from.armament,
    spec = gun && WEAPONS[gun.kind];
  if (gun?.kind === 'coil') {
    // A visible, uninterrupted lock is required for every shot, on either side.
    if (from.path.length || distance(from, from.previous) > 1e-6) {
      cancelCharge(from);
      return false;
    }
    if (gun.charging?.target !== to.id) gun.charging = { target: to.id, remaining: COIL_CHARGE };
    gun.charging.remaining = Math.max(0, gun.charging.remaining - dt * readiness(from));
    if (gun.charging.remaining > 1e-8) return false;
    cancelCharge(from);
  }
  from.cooldown = spec ? spec.interval : hostile ? 0.8 : 0.52;
  const blocked = shieldFaces(to, from);
  const damage = (spec ? spec.damage : hostile ? 16 : 17) * (blocked ? 0.12 : 1);
  to.hp = Math.max(0, to.hp - damage);
  if (!hostile) {
    const guard = world.guards.find((g) => g === to);
    if (guard) receiveFire(world, guard, from);
  }
  if (gun?.kind === 'support') suppress(world, from, to, hostile);
  if (gun && spec && --gun.rounds === 0) gun.reload = spec.reload;
  world.traces.push({
    from: position(from),
    to: position(to),
    life: 0.12,
    hostile,
  });
  world.sounds.push({ kind: 'shot', weapon: gun?.kind ?? 'pistol', x: from.x, y: from.y });
  world.sounds.push({
    kind: 'hit',
    x: to.x,
    y: to.y,
    // Fatal metal hits use the machine-wreck cue; a shield officer still falls
    // as a person, even when the last shot passed through the frontal shield.
    metal: (blocked && living(to)) || ('turret' in to && !!to.turret),
    fatal: !living(to),
    friendly: world.agents.some((a) => a === to) || world.escort === to,
  });
  world.shots++;
  if (!living(to)) {
    cancelCharge(to);
    to.path = [];
    world.casualties++;
  }
  return true;
}
