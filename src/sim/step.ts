import { distance, living } from './types';
import type { Person, World } from './types';
import { canWalk, findPath, lineClear } from './navigation';
import { completeInteraction, dropEvidence, interactionPoint } from './orders';
import { updateAwareness } from './awareness';
import { shoot } from './combat';
import { notify } from './world';

export const STEP = 1 / 30;
function walk(world: World, p: Person, speed: number, dt: number) {
  let budget = speed * dt;
  while (budget > 0 && p.path.length) {
    const target = p.path[0],
      length = distance(p, target);
    if (length < 1e-8) {
      p.path.shift();
      continue;
    }
    const amount = Math.min(budget, length);
    const next = {
      x: p.x + ((target.x - p.x) / length) * amount,
      y: p.y + ((target.y - p.y) / length) * amount,
    };
    if (!canWalk(world, p, next)) {
      p.path = [];
      break;
    }
    p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    p.x = next.x;
    p.y = next.y;
    p.step += amount;
    budget -= amount;
    if (amount === length) p.path.shift();
  }
}
export function step(world: World, dt = STEP) {
  if (world.status !== 'playing') return;
  world.time += dt;
  for (const p of [...world.agents, ...world.guards, world.engineer]) {
    p.previous = { x: p.x, y: p.y };
    p.cooldown = Math.max(0, p.cooldown - dt);
  }
  world.traces = world.traces.filter((t) => (t.life -= dt) > 0);
  for (const a of world.agents) {
    if (!living(a)) {
      if (a.carrying) dropEvidence(world, [a.id]);
      continue;
    }
    if (a.order.kind === 'attack') {
      const id = a.order.target,
        target = world.guards.find((g) => g.id === id && living(g));
      if (!target) {
        a.order = { kind: 'hold' };
        a.path = [];
      } else if (distance(a, target) <= 7.5 && lineClear(world, a, target)) a.path = [];
      else if (!a.path.length) a.path = findPath(world, a, target);
    }
    walk(world, a, a.carrying ? 2 : 3.2, dt);
    if (a.order.kind === 'move' && !a.path.length) a.order = { kind: 'hold' };
    if (a.order.kind === 'interact') {
      const id = a.order.target,
        p = interactionPoint(world, a, id);
      if (distance(a, p) < 1.15 && lineClear(world, a, p)) {
        a.path = [];
        a.interaction += dt;
        const duration = id === 'gate' && a.y > 20 ? 3 : id === 'relay' ? 1.5 : 0.65;
        if (a.interaction >= duration) completeInteraction(world, a, id);
      } else if (!a.path.length) {
        a.path = findPath(world, a, p);
        if (!a.path.length) {
          a.order = { kind: 'hold' };
          notify(world, 'Cannot reach that position from here.');
        }
      }
    }
    if (a.weapon && !a.carrying) {
      const order = a.order;
      const candidates = world.guards.filter(
        (g) =>
          living(g) &&
          (order.kind === 'attack' ? g.id === order.target : g.mode === 'combat') &&
          distance(a, g) <= 8 &&
          lineClear(world, a, g),
      );
      candidates.sort((g, h) => distance(a, g) - distance(a, h));
      if (candidates[0] && shoot(world, a, candidates[0], false)) {
        a.exposed = true;
        // Gunfire is local. Nearby guards investigate its position, without learning every identity.
        for (const g of world.guards.filter(living))
          if (distance(g, a) < 11) {
            g.lastSeen = { x: a.x, y: a.y };
            g.searchTime = 10;
            g.mode = 'combat';
            g.path = [];
            if (lineClear(world, g, a)) {
              if (!g.known.includes(a.id)) {
                g.known.push(a.id);
                g.reported = false;
              }
              g.target = a.id;
              if (!g.reported && g.radio <= 0) g.radio = 2.5;
            }
          }
      }
    }
  }
  updateAwareness(world, dt);
  for (const g of world.guards.filter(living)) walk(world, g, g.mode === 'combat' ? 2.25 : 1.2, dt);
  const v = world.engineer;
  if (v.recruited) {
    let leader = world.agents.find((a) => a.id === v.leader && living(a));
    if (!leader) {
      leader = world.agents.filter(living).sort((a, b) => distance(a, v) - distance(b, v))[0];
      v.leader = leader?.id || null;
    }
    v.repath -= dt;
    if (leader && distance(v, leader) > 1.25 && v.repath <= 0) {
      v.path = findPath(world, v, leader);
      v.repath = 0.45;
    }
    if (leader && distance(v, leader) <= 1.1) v.path = [];
    walk(world, v, 2.65, dt);
  }
  if (!world.agents.some(living)) {
    world.status = 'lost';
    notify(world, 'The crew is down. Restart the operation.', 'warning');
  }
}
