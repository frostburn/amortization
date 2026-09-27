import { depot } from '../content/depot';
import type { Guard, Mission, Notice, Person, Vec, World } from './types';

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
export function makeGuard(id: string, position: Vec, patrol: Vec[], angle = Math.PI): Guard {
  return {
    ...body(id, position, 62),
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
      name: names[i],
      role: roles[i],
      index: i,
      weapon: false,
      disguised: false,
      exposed: false,
      order: { kind: 'hold' },
      medkit: true,
      carrying: false,
      interaction: 0,
    })),
    guards: [
      ...mission.guards.map((g, i) => makeGuard(`guard-${i}`, g.position, g.patrol, g.angle)),
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
