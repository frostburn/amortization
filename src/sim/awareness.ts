import { facingAngle } from './shield';
import { controllable, disoriented, distance, inside, isCharge, isPower, living } from './types';
import type { Guard, Operative, Person, Vec, World } from './types';
import { findPath, lineClear } from './navigation';
import { shoot } from './combat';
import { cancelCharge, guardWeapon, visibleWeapon, weaponRange } from './weapons';
import { maneuver, shareContact } from './tactics';
import { makeGuard, notify } from './world';
import { clearedCargo } from './courier';
import { inspectionRemaining, turretPowered, updateTurret } from './security';
import { inspectCredentials } from './inspection';

export const RESPONSE_TIMES = [6, 30] as const;
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
export function suspicionRate(world: World, agent: Operative): number {
  if (world.known.includes(agent.id)) return 130;
  if (visibleWeapon(agent)) return 95;
  if (
    agent.order.kind === 'interact' &&
    (agent.order.target === 'divert' ||
      isCharge(agent.order.target) ||
      (isPower(agent.order.target) && inspectionRemaining(world) === 0)) &&
    agent.interaction > 0
  )
    return 95;
  if (agent.carrying && world.mission.objective !== 'escort' && !clearedCargo(world, agent))
    return 95;
  if (inside(agent, world.mission.restricted)) {
    if (!agent.disguised) return 52;
    if (inside(agent, world.mission.secure)) return 29;
  }
  return 0;
}
export function raiseAlarm(world: World, ids: string[] = []) {
  if (world.relayOff) return;
  for (const id of ids) if (!world.known.includes(id)) world.known.push(id);
  if (world.alarm) return;
  world.alarm = true;
  world.alarmTime = world.time;
  notify(world, 'Security called it in. Reinforcements approaching the delivery gate.', 'warning');
  world.sounds.push({ kind: 'alarm', x: world.mission.width / 2, y: world.mission.height / 2 });
}
export function investigateNoise(world: World, point: Vec) {
  for (const g of world.guards.filter(living)) {
    if (g.turret) continue;
    if (distance(g, point) > 12) continue;
    g.mode = 'combat';
    g.lastSeen = { ...point };
    g.searchTime = 15;
    g.path = [];
    g.repath = 0;
  }
}
/** A radio dispatch names a fixed incident location, never an unseen person's position. */
export function dispatchInvestigation(world: World, point: Vec, guards = world.guards) {
  for (const g of guards.filter(living)) {
    if (g.turret || g.tactics?.role === 'marksman') continue;
    // Keep a guard's direct contact instead of replacing it with a remote report.
    const target = world.agents.find((a) => a.id === g.target && controllable(a));
    if (target && sees(world, g, target)) continue;
    g.mode = 'combat';
    g.lastSeen = { x: point.x, y: point.y };
    g.searchTime = 30;
    g.path = [];
    g.repath = 0;
    if (g.tactics) {
      g.tactics.goal = null;
      g.tactics.cover = false;
      g.tactics.until = 0;
      g.tactics.nextMove = world.time;
    }
  }
}

export function reportGunfire(world: World, shooter: Operative) {
  for (const g of world.guards.filter(living)) {
    if (g.turret) {
      if (
        turretPowered(world, g) &&
        distance(g, shooter) <= weaponRange(g) &&
        lineClear(world, g, shooter) &&
        !g.known.includes(shooter.id)
      )
        g.known.push(shooter.id);
      continue;
    }
    if (distance(g, shooter) > 12) continue;
    g.lastSeen = { x: shooter.x, y: shooter.y };
    g.searchTime = 10;
    g.mode = 'combat';
    if (!g.tactics) g.path = [];
    // A guard can report audible shots through a wall, but cannot identify or
    // target the shooter without sight. Repeated shots never restart the call.
    if (!disoriented(g) && lineClear(world, g, shooter)) {
      if (!g.known.includes(shooter.id)) {
        g.known.push(shooter.id);
        g.reported = false;
      }
      const current = [...world.agents, ...(world.escort ? [world.escort] : [])].find(
        (p) => p.id === g.target && living(p),
      );
      if (!current || !lineClear(world, g, current) || distance(g, shooter) < distance(g, current))
        g.target = shooter.id;
    }
    if (!g.reported && g.radio <= 0) g.radio = 2.5;
  }
}
export function updateAwareness(world: World, dt: number) {
  for (const g of world.guards.filter(living)) {
    if (g.turret) {
      updateTurret(world, g, dt);
      continue;
    }
    if (disoriented(g)) {
      cancelCharge(g);
      delete g.inspection;
      finishReport(world, g, dt);
      continue;
    }
    const inspected = inspectCredentials(world, g, dt);
    g.repath -= dt;
    let highest = 0;
    let visibleTarget: Person | undefined;
    for (const a of world.agents.filter(controllable)) {
      const visible = sees(world, g, a);
      const rate = visible ? suspicionRate(world, a) : 0;
      const previous = g.suspicion[a.id] || 0;
      g.suspicion[a.id] = Math.max(0, Math.min(100, previous + (rate || -22) * dt));
      if (a.id === inspected) g.suspicion[a.id] = 100;
      highest = Math.max(highest, g.suspicion[a.id]);
      if (g.suspicion[a.id] >= 100 && !g.known.includes(a.id)) {
        g.known.push(a.id);
        g.mode = 'combat';
        g.reported = false;
        if (g.radio <= 0) g.radio = 2.5;
        a.exposed = true;
        notify(world, `${a.name} identified. A guard is calling for backup.`, 'warning');
      }
      if (visible && (g.known.includes(a.id) || world.known.includes(a.id))) {
        if (!visibleTarget || distance(g, a) < distance(g, visibleTarget)) visibleTarget = a;
      }
    }
    const escort =
      world.mission.escort?.vulnerable && world.escort?.recruited && living(world.escort)
        ? world.escort
        : null;
    if (escort) {
      const visible = sees(world, g, escort);
      g.suspicion[escort.id] = Math.max(
        0,
        Math.min(100, (g.suspicion[escort.id] || 0) + (visible ? 90 : -22) * dt),
      );
      highest = Math.max(highest, g.suspicion[escort.id]);
      if (g.suspicion[escort.id] >= 100 && !g.known.includes(escort.id)) {
        g.known.push(escort.id);
        g.reported = false;
        if (g.radio <= 0) g.radio = 2.5;
        notify(
          world,
          `${escort.name} spotted. Get them behind cover or stop the guard.`,
          'warning',
        );
      }
      if (visible && (g.known.includes(escort.id) || world.known.includes(escort.id))) {
        if (!visibleTarget || distance(g, escort) < distance(g, visibleTarget))
          visibleTarget = escort;
      }
    }
    if (visibleTarget) {
      g.mode = 'combat';
      g.target = visibleTarget.id;
      g.lastSeen = { x: visibleTarget.x, y: visibleTarget.y };
      g.searchTime = 9;
      shareContact(world, g, visibleTarget);
    }
    if (g.mode !== 'combat') g.mode = highest > 15 || g.inspection ? 'challenge' : 'patrol';
    finishReport(world, g, dt);
    if (g.mode === 'combat') {
      const target =
        escort?.id === g.target
          ? escort
          : world.agents.find((a) => a.id === g.target && controllable(a));
      if (maneuver(world, g, target)) {
        cancelCharge(g);
        g.searchTime -= dt;
      } else if (target && distance(g, target) <= weaponRange(g) && lineClear(world, g, target)) {
        g.angle = Math.atan2(target.y - g.y, target.x - g.x);
        g.lastSeen = { x: target.x, y: target.y };
        g.searchTime = 9;
        g.path = [];
        shoot(world, g, target, true, dt);
      } else {
        cancelCharge(g);
        g.searchTime -= dt;
        if (g.lastSeen && g.repath <= 0 && g.tactics?.role !== 'marksman') {
          g.path = findPath(world, g, g.lastSeen);
          g.repath = 1;
        }
        if (g.searchTime <= 0) {
          g.mode = 'patrol';
          g.target = null;
          g.path = [];
          g.lastSeen = null;
        }
      }
    } else if (g.mode === 'challenge') {
      cancelCharge(g);
      const suspect = g.inspection
        ? world.agents.find((a) => a.id === g.inspection!.target)
        : escort && g.suspicion[escort.id] === highest
          ? escort
          : world.agents.find((a) => (g.suspicion[a.id] || 0) === highest);
      if (suspect) g.angle = Math.atan2(suspect.y - g.y, suspect.x - g.x);
      g.path = [];
    } else if (
      !g.path.length &&
      (g.id !== world.courier?.guardId || world.courier.phase === 'ready')
    ) {
      const destination = g.patrol[g.waypoint];
      if (distance(g, destination) < 0.5) g.waypoint = (g.waypoint + 1) % g.patrol.length;
      g.path = findPath(world, g, g.patrol[g.waypoint]);
    }
  }
  if (
    world.alarm &&
    !world.relayOff &&
    world.waves < RESPONSE_TIMES.length &&
    world.time - world.alarmTime > RESPONSE_TIMES[world.waves]
  ) {
    for (const [i, p] of world.mission.response.spawns.entries()) {
      const tactic = world.waves > 0 ? world.mission.response.specialists?.[i] : undefined;
      const g = makeGuard(
        `response-${world.waves}-${i}`,
        p,
        [p, ...world.mission.response.patrol],
        Math.PI,
        world.mission.loadout ? guardWeapon(tactic) : undefined,
        tactic,
      );
      g.known = [...world.known];
      world.guards.push(g);
      if (world.mission.broadcast?.dispatchOnTrace && world.broadcast?.traced) {
        const terminal = world.mission.landmarks.find((o) => o.id === 'upload')!;
        dispatchInvestigation(world, terminal, [g]);
      }
    }
    world.waves++;
    world.gateOpen = true;
    notify(world, 'A response team has arrived from the east road.', 'warning');
  }
}

function finishReport(world: World, g: Guard, dt: number) {
  if (g.radio <= 0) return;
  g.radio -= dt;
  if (g.radio <= 0 && !g.reported) {
    g.reported = true;
    if (!world.relayOff) raiseAlarm(world, g.known);
  }
}
