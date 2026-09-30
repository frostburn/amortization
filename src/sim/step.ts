import {
  disoriented,
  distance,
  isCharge,
  isExtraction,
  isPower,
  isRescue,
  isSettlement,
  living,
  people,
} from './types';
import type { Person, World } from './types';
import { canWalk, findPath, lineClear } from './navigation';
import {
  available,
  completeInteraction,
  dropEvidence,
  interactionDuration,
  interactionPoint,
} from './orders';
import { reportGunfire, updateAwareness } from './awareness';
import { shoot } from './combat';
import { cancelCharge, updateWeapon, weaponRange } from './weapons';
import { notify } from './world';
import { updateShutter } from './shutter';
import { updateCourier } from './courier';
import { updateDetention } from './detention';
import { updateBroadcast } from './broadcast';
import { FLASH_FLIGHT, updateFlashes } from './flash';
import { extractionPath } from './extraction-routing';
import { settled, updateSettlement } from './settlement';

import { decayPressure, readiness } from './pressure';
import { turnShield } from './shield';

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
  updateFlashes(world, dt);
  if (
    world.security &&
    world.security.inspectionUntil > 0 &&
    world.time >= world.security.inspectionUntil
  ) {
    world.security.inspectionUntil = 0;
    const remaining = world.guards.filter(
      (g) => living(g) && g.turret && !world.security!.isolated.includes(g.turret.circuit),
    ).length;
    notify(
      world,
      remaining
        ? `Inspection ended. ${remaining} wired turrets are live again. Break sight or isolate their feeds.`
        : 'Inspection ended. Isolated and destroyed turrets stay offline.',
      remaining ? 'warning' : 'info',
    );
  }
  updateShutter(world);
  updateDetention(world);
  for (const p of people(world)) {
    decayPressure(p, dt);
    updateWeapon(p, dt, distance(p, p.previous) > 1e-6);
    p.previous = { x: p.x, y: p.y };
    p.cooldown = Math.max(0, p.cooldown - dt * readiness(p));
  }
  for (const g of world.guards) turnShield(g, dt);
  world.traces = world.traces.filter((t) => (t.life -= dt) > 0);
  for (const a of world.agents) {
    const throwing = world.flashGrenades?.some((g) => g.thrower === a.id && g.age < FLASH_FLIGHT);
    if (a.captive) continue;
    if (!living(a)) {
      if (a.carrying) dropEvidence(world, [a.id]);
      continue;
    }
    if (a.order.kind === 'interact' && !available(world, a.order.target)) {
      a.order = { kind: 'hold' };
      a.path = [];
      a.interaction = 0;
    }
    if (a.order.kind === 'attack' && !disoriented(a)) {
      const id = a.order.target,
        target = world.guards.find((g) => g.id === id && living(g));
      if (!target) {
        a.order = { kind: 'hold' };
        a.path = [];
      } else {
        // Keep a legal coil charge instead of cancelling it for one walking
        // step every time a patrol crosses the pursuit stop threshold.
        const charging = a.armament?.charging?.target === target.id;
        const stopRange = weaponRange(a) - (charging ? 0 : 0.5);
        if (distance(a, target) <= stopRange && lineClear(world, a, target)) a.path = [];
        else if (!a.path.length) a.path = findPath(world, a, target);
      }
    }
    walk(world, a, a.carrying ? 2 : 3.2, dt);
    if (distance(a, a.previous) > 1e-6) updateWeapon(a, 0, true);
    if (a.order.kind === 'move' && !a.path.length) a.order = { kind: 'hold' };
    if (a.order.kind === 'interact' && !disoriented(a) && !throwing) {
      const id = a.order.target,
        p = interactionPoint(world, a, id);
      if (distance(a, p) < 1.15 && lineClear(world, a, p)) {
        a.path = [];
        if (isRescue(id) && world.detention?.circuit !== 'access-cells') a.interaction = 0;
        else a.interaction += dt;
        const duration = interactionDuration(world, a, id);
        if (a.interaction >= duration) {
          completeInteraction(world, a, id);
          if (world.status !== 'playing') return;
        }
      } else if (!a.path.length) {
        a.path = isExtraction(id) ? extractionPath(world, a, p) : findPath(world, a, p);
        if (!a.path.length) {
          a.order = { kind: 'hold' };
          notify(
            world,
            id === 'evidence' && world.mission.archive && !world.shutterOpen
              ? 'Archive locked. Assign another operative to SHUNT, or use CUT at the shutter.'
              : 'Cannot reach that position from here.',
          );
        }
      }
    }
    const working =
      a.order.kind === 'interact' &&
      (a.order.target === 'file-recall' ||
        isSettlement(a.order.target) ||
        a.order.target.startsWith('access-') ||
        a.order.target.startsWith('rescue-') ||
        a.order.target === 'escape-release' ||
        a.order.target === 'equipment' ||
        a.order.target === 'override' ||
        a.order.target === 'breach' ||
        a.order.target === 'mask' ||
        a.order.target === 'upload' ||
        isCharge(a.order.target) ||
        isPower(a.order.target) ||
        a.order.target === 'authorise' ||
        a.order.target === 'release');
    if (a.weapon && !a.disarmed && !a.carrying && !working && !disoriented(a) && !throwing) {
      const order = a.order;
      const candidates = world.guards.filter(
        (g) =>
          living(g) &&
          (order.kind === 'attack' ? g.id === order.target : g.mode === 'combat') &&
          distance(a, g) <= weaponRange(a) &&
          lineClear(world, a, g),
      );
      candidates.sort((g, h) => distance(a, g) - distance(a, h));
      if (!candidates[0]) cancelCharge(a);
      if (candidates[0] && shoot(world, a, candidates[0], false, dt)) {
        a.exposed = true;
        reportGunfire(world, a);
      }
    } else cancelCharge(a);
  }
  updateDetention(world);
  updateAwareness(world, dt);
  updateCourier(world, dt);
  updateBroadcast(world, dt);
  updateSettlement(world, dt);
  for (const g of world.guards.filter(living)) walk(world, g, g.mode === 'combat' ? 2.25 : 1.2, dt);
  const v = world.escort;
  if (v?.recruited && living(v)) {
    let leader = world.agents.find((a) => a.id === v.leader && living(a));
    if (!leader) {
      leader = world.agents.filter(living).sort((a, b) => distance(a, v) - distance(b, v))[0];
      v.leader = leader?.id || null;
    }
    v.repath -= dt;
    if (!v.waiting && leader && distance(v, leader) > 1.25 && v.repath <= 0) {
      v.path = findPath(world, v, leader);
      v.repath = 0.45;
    }
    if (v.waiting || (leader && distance(v, leader) <= 1.1)) v.path = [];
    walk(world, v, world.mission.escort!.speed, dt);
  }
  if (world.settlement && !settled(world) && world.agents.filter(living).length < 2) {
    world.status = 'lost';
    notify(
      world,
      'Two operatives are needed to staff SIGN and CLEAR together. The repayments cannot be released. Restart the operation.',
      'warning',
    );
  } else if (world.detention && world.agents.some((a) => !living(a))) {
    world.status = 'lost';
    notify(
      world,
      `${world.agents.find((a) => !living(a))!.name} was killed. This rescue requires all four operatives alive. Restart the operation.`,
      'warning',
    );
  } else if (v && !living(v)) {
    world.status = 'lost';
    notify(
      world,
      `${v.name} was killed. The contract required a living witness. Restart the operation.`,
      'warning',
    );
  } else if (!world.agents.some(living)) {
    world.status = 'lost';
    notify(world, 'The crew is down. Restart the operation.', 'warning');
  }
}
