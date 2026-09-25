import { distance, inside, living } from './types';
import type { Guard, Operative, Vec, World } from './types';
import { findPath, lineClear } from './navigation';
import { shoot } from './combat';
import { makeGuard, notify } from './world';

export function sees(world: World, guard: Guard, person: Operative): boolean {
  const range = distance(guard, person);
  if (range > 7.5 || !lineClear(world, guard, person)) return false;
  if (range < 1.3) return true;
  const angle = Math.atan2(person.y - guard.y, person.x - guard.x) - guard.angle;
  return Math.cos(angle) > Math.cos(Math.PI * 0.36);
}
export function suspicionRate(world: World, agent: Operative): number {
  if (world.known.includes(agent.id)) return 130;
  if (agent.weapon) return 95;
  if (agent.carrying && world.mission.objective === 'ledger') return 95;
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
  world.sounds.push({ kind: 'alarm', x: 16 });
}
export function investigateNoise(world: World, point: Vec) {
  for (const g of world.guards.filter(living)) {
    if (distance(g, point) > 12) continue;
    g.mode = 'combat';
    g.lastSeen = { ...point };
    g.searchTime = 15;
    g.path = [];
    g.repath = 0;
  }
}
export function updateAwareness(world: World, dt: number) {
  for (const g of world.guards.filter(living)) {
    g.repath -= dt;
    let highest = 0;
    for (const a of world.agents.filter(living)) {
      const visible = sees(world, g, a);
      const rate = visible ? suspicionRate(world, a) : 0;
      const previous = g.suspicion[a.id] || 0;
      g.suspicion[a.id] = Math.max(0, Math.min(100, previous + (rate || -22) * dt));
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
        g.mode = 'combat';
        g.target = a.id;
        g.lastSeen = { x: a.x, y: a.y };
        g.searchTime = 9;
      }
    }
    if (g.mode !== 'combat') g.mode = highest > 15 ? 'challenge' : 'patrol';
    if (g.radio > 0) {
      g.radio -= dt;
      if (g.radio <= 0 && !g.reported) {
        g.reported = true;
        if (!world.relayOff) raiseAlarm(world, g.known);
      }
    }
    if (g.mode === 'combat') {
      const target = world.agents.find((a) => a.id === g.target && living(a));
      if (target && distance(g, target) < 7.5 && lineClear(world, g, target)) {
        g.angle = Math.atan2(target.y - g.y, target.x - g.x);
        g.lastSeen = { x: target.x, y: target.y };
        g.searchTime = 9;
        if (distance(g, target) <= 6.8) {
          g.path = [];
          shoot(world, g, target, true);
        } else if (g.repath <= 0) {
          g.path = findPath(world, g, target);
          g.repath = 0.8;
        }
      } else {
        g.searchTime -= dt;
        if (g.lastSeen && g.repath <= 0) {
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
      const suspect = world.agents.find((a) => (g.suspicion[a.id] || 0) === highest);
      if (suspect) g.angle = Math.atan2(suspect.y - g.y, suspect.x - g.x);
      g.path = [];
    } else if (!g.path.length) {
      const destination = g.patrol[g.waypoint];
      if (distance(g, destination) < 0.5) g.waypoint = (g.waypoint + 1) % g.patrol.length;
      g.path = findPath(world, g, g.patrol[g.waypoint]);
    }
  }
  if (
    world.alarm &&
    !world.relayOff &&
    world.waves < 2 &&
    world.time - world.alarmTime > 12 + world.waves * 32
  ) {
    for (const [i, p] of world.mission.response.spawns.entries()) {
      const g = makeGuard(`response-${world.waves}-${i}`, p, [p, ...world.mission.response.patrol]);
      g.known = [...world.known];
      world.guards.push(g);
    }
    world.waves++;
    world.gateOpen = true;
    notify(world, 'A response team has arrived from the east road.', 'warning');
  }
}
