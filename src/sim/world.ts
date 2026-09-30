import { depot } from '../content/depot';
import type { Guard, GuardTactic, Mission, Notice, Person, Vec, World, WeaponKind } from './types';
import { equip, guardWeapon } from './weapons';

export function body(id: string, p: Vec, hp: number): Person {
  return {
    id,
    ...p,
    previous: { ...p },
    hp,
    maxHp: hp,
    angle: -Math.PI / 2,
    path: [],
    cooldown: 0,
    step: 0,
  };
}
export function makeGuard(
  id: string,
  position: Vec,
  patrol: Vec[],
  angle = Math.PI,
  weapon?: WeaponKind,
  tactic?: GuardTactic,
): Guard {
  return {
    // A coordinated opening volley hurts, but leaves time to return fire or retreat.
    ...body(id, position, 90),
    ...(weapon ? { armament: equip(weapon) } : {}),
    ...(tactic
      ? { tactics: { ...tactic, lastHp: 90, until: 0, nextMove: 0, cover: false, goal: null } }
      : {}),
    ...(tactic?.role === 'shield' ? { shield: { angle } } : {}),
    patrol,
    waypoint: 0,
    suspicion: {},
    known: [],
    mode: 'patrol',
    radio: 0,
    reported: false,
    target: null,
    lastSeen: null,
    searchTime: 0,
    repath: 0,
    angle,
  };
}
export function createWorld(mission: Mission = depot): World {
  const names = ['Morrow', 'Vale', 'Rook', 'Sable'];
  const roles = ['Field lead', 'Systems', 'Security', 'Recon'];
  const escortPosition = mission.landmarks.find((o) => o.id === 'escort');
  return {
    mission,
    agents: mission.spawns.map((p, i) => ({
      ...body(`agent-${i}`, p, 100),
      ...(mission.loadout ? { armament: equip(mission.loadout[i]) } : {}),
      ...(mission.flashGrenades && i >= 2 ? { flashes: 1 } : {}),
      ...(mission.detention?.cells.some((c) => c.agent === i)
        ? { captive: true, disarmed: true }
        : {}),
      name: names[i],
      role: roles[i],
      index: i,
      weapon: false,
      disguised: false,
      exposed: false,
      order: { kind: 'hold' },
      medkit: !mission.detention?.cells.some((c) => c.agent === i),
      carrying: false,
      interaction: 0,
    })),
    guards: [
      ...mission.guards.map((g, i) =>
        makeGuard(
          `guard-${i}`,
          g.position,
          g.patrol,
          g.angle,
          mission.loadout ? guardWeapon(g.tactic) : undefined,
          g.tactic,
        ),
      ),
      ...(mission.security?.turrets.map((t, i) => ({
        ...makeGuard(`turret-${i}`, t.position, [t.position], t.angle, 'carbine'),
        hp: 180,
        maxHp: 180,
        turret: { circuit: t.circuit, homeAngle: t.angle, lock: 0 },
      })) ?? []),
      ...(mission.transfer
        ? [makeGuard('courier', mission.transfer.start, mission.transfer.patrol)]
        : []),
    ],
    escort: escortPosition
      ? {
          ...body(mission.escort!.id, escortPosition, mission.escort!.hp),
          name: mission.escort!.name,
          waiting: false,
          leader: null,
          recruited: false,
          repath: 0,
        }
      : null,
    escortLocked: mission.escort?.locked ?? false,
    extractedAt: null,
    time: 0,
    status: 'playing',
    gateOpen: false,
    shutterOpen: false,
    shutterBreached: false,
    overrideBy: null,
    relayOff: false,
    disguiseTaken: false,
    evidence: mission.transfer ? 'courier' : 'available',
    evidencePosition: { ...mission.landmarks.find((o) => o.id === 'evidence')! },
    courier: mission.transfer
      ? { guardId: 'courier', phase: 'ready', diverted: false, wait: 0, clearance: null }
      : null,
    ...(mission.broadcast
      ? { broadcast: { progress: 0, trace: 0, traced: false, maskBy: null, uploadBy: null } }
      : {}),
    ...(mission.demolition ? { demolition: { armed: [], detonatedAt: null } } : {}),
    ...(mission.security
      ? { security: { isolated: [], inspectionUntil: 0, inspectionUsed: false } }
      : {}),
    ...(mission.detention
      ? { detention: { operator: null, circuit: null, open: [], released: false } }
      : {}),
    ...(mission.flashGrenades ? { flashGrenades: [] } : {}),
    ...(mission.settlement
      ? { settlement: { reconciled: false, progress: 0, signer: null, clerk: null } }
      : {}),
    ...(mission.recall ? { recall: { filed: false } } : {}),
    alarm: false,
    alarmTime: 0,
    waves: 0,
    known: [],
    traces: [],
    notices: [],
    sounds: [],
    shots: 0,
    casualties: 0,
    message: mission.intro,
  };
}
export function notify(world: World, text: string, kind: Notice['kind'] = 'info') {
  world.message = text;
  world.notices.push({ time: world.time, text, kind });
  if (world.notices.length > 5) world.notices.shift();
}
