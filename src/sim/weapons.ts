import type { Armament, GuardTactic, Operative, Person, WeaponKind } from './types';
import { disoriented } from './types';

export const COIL_CHARGE = 1.25;

export const WEAPONS = {
  pistol: {
    name: 'Pistol',
    range: 6,
    damage: 17,
    interval: 0.52,
    magazine: 8,
    reload: 1.2,
    settle: 0,
  },
  carbine: {
    name: 'Carbine',
    range: 9,
    damage: 26,
    interval: 0.72,
    magazine: 6,
    reload: 1.6,
    settle: 0.35,
  },
  shotgun: {
    name: 'Shotgun',
    range: 3.8,
    damage: 44,
    interval: 1.05,
    magazine: 2,
    reload: 1.8,
    settle: 0,
  },
  automatic: {
    name: 'Compact automatic',
    range: 6.4,
    damage: 12,
    interval: 0.16,
    magazine: 9,
    reload: 1.65,
    settle: 0,
  },
  coil: {
    name: 'Coil rifle',
    range: 13,
    damage: 52,
    interval: 0.75,
    magazine: 3,
    reload: 2.2,
    settle: 0,
  },
} satisfies Record<
  WeaponKind,
  {
    name: string;
    range: number;
    damage: number;
    interval: number;
    magazine: number;
    reload: number;
    settle: number;
  }
>;

export const equip = (kind: WeaponKind): Armament => ({
  kind,
  rounds: WEAPONS[kind].magazine,
  reload: 0,
  settle: WEAPONS[kind].settle,
});
export const weaponRange = (person: Person) =>
  person.armament ? WEAPONS[person.armament.kind].range : 8;
export const longGun = (person: Person) =>
  !('disarmed' in person && person.disarmed) &&
  !!person.armament &&
  person.armament.kind !== 'pistol';
export const visibleWeapon = (person: Operative) => person.weapon || longGun(person);
export const guardWeapon = (tactic?: GuardTactic): WeaponKind =>
  tactic?.role === 'marksman'
    ? 'coil'
    : tactic?.role === 'sentry'
      ? 'carbine'
      : tactic?.role === 'breacher'
        ? 'shotgun'
        : 'pistol';

export function cancelCharge(person: Person) {
  if (person.armament?.charging) delete person.armament.charging;
}

/** Simulation time owns readiness, even while a weapon is stowed or its owner works. */
export function updateWeapon(person: Person, dt: number, moved: boolean) {
  const gun = person.armament;
  if (moved || person.hp <= 0 || (gun?.reload ?? 0) > 0) cancelCharge(person);
  if (!gun || person.hp <= 0) return;
  const spec = WEAPONS[gun.kind];
  gun.settle = moved ? spec.settle : Math.max(0, gun.settle - dt);
  if (gun.reload > 0) {
    gun.reload = Math.max(0, gun.reload - dt);
    if (gun.reload === 0) gun.rounds = spec.magazine;
  }
}

export function weaponStatus(person: Person) {
  if (disoriented(person)) return `Disoriented ${person.disoriented!.toFixed(1)}s`;
  if ('disarmed' in person && person.disarmed) return 'Unarmed · recover GEAR';
  const gun = person.armament;
  if (!gun) return '';
  if (gun.reload > 0) return `Reloading ${gun.reload.toFixed(1)}s`;
  if (gun.charging) return `Charging ${gun.charging.remaining.toFixed(1)}s`;
  if (gun.settle > 0) return person.path.length ? 'Stop to aim' : 'Steadying';
  return `${gun.rounds}/${WEAPONS[gun.kind].magazine}${person.cooldown > 0 ? ' · recovering' : ''}`;
}
