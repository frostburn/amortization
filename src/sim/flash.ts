import { lineClear, passable } from './navigation';
import { controllable, disoriented, distance, isCharge, living, people } from './types';
import type { Operative, Vec, World } from './types';
import { cancelCharge } from './weapons';
import { notify } from './world';
import { investigateNoise, sees } from './awareness';

export const FLASH_RANGE = 7;
export const FLASH_RADIUS = 3;
export const FLASH_FLIGHT = 0.45;
export const FLASH_FUSE = 0.6;
export const FLASH_RECOVERY = 1.5;
export const FLASH_PULSE = 0.3;

export const flashReady = (a: Operative) =>
  controllable(a) && !a.disarmed && !a.carrying && !disoriented(a) && (a.flashes ?? 0) > 0;

/** Read-only targeting. No walking, order changes, ammunition use, or path search. */
export function flashPreview(w: World, ids: string[], point: Vec) {
  const candidates = w.agents
    .filter((a) => ids.includes(a.id) && flashReady(a))
    .sort((a, b) => distance(a, point) - distance(b, point));
  const thrower =
    candidates.find((a) => distance(a, point) <= FLASH_RANGE && lineClear(w, a, point)) ??
    candidates[0];
  let reason = '';
  if (!w.flashGrenades || !thrower) reason = 'Select Rook or Sable with a flash and free hands.';
  else if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !passable(w, point))
    reason = 'Choose open ground for the landing point.';
  else if (distance(thrower, point) > FLASH_RANGE)
    reason = `Out of range. Move ${thrower.name} within ${FLASH_RANGE} units first.`;
  else if (!lineClear(w, thrower, point))
    reason = 'Throw blocked by solid cover. Choose a clear trajectory.';
  const exposed = w.agents.filter(
    (a) => controllable(a) && distance(a, point) <= FLASH_RADIUS && lineClear(w, point, a),
  );
  return { thrower, reason, exposed };
}

export function throwFlash(w: World, ids: string[], point: Vec) {
  const preview = flashPreview(w, ids, point);
  if (preview.reason) {
    notify(w, preview.reason);
    return;
  }
  const a = preview.thrower!;
  // One confirmed command throws exactly one grenade, including group orders.
  a.flashes = a.flashes! - 1;
  a.order = { kind: 'hold' };
  a.path = [];
  a.interaction = 0;
  a.angle = Math.atan2(point.y - a.y, point.x - a.x);
  cancelCharge(a);
  w.flashGrenades!.push({ thrower: a.id, from: { x: a.x, y: a.y }, to: { ...point }, age: 0 });
  for (const g of w.guards.filter(living)) {
    if (g.turret || !sees(w, g, a)) continue;
    if (!g.known.includes(a.id)) g.known.push(a.id);
    g.reported = false;
    if (g.radio <= 0) g.radio = 2.5;
    g.mode = 'combat';
    g.lastSeen = { x: a.x, y: a.y };
    g.target = a.id;
    a.exposed = true;
  }
  notify(w, `${a.name}: flash away. Keep clear of the marked radius.`);
}

export function updateFlashes(w: World, dt: number) {
  if (!w.flashGrenades) return;
  for (const p of people(w))
    if (p.disoriented !== undefined) {
      p.disoriented = Math.max(0, p.disoriented - dt);
      if (!p.disoriented) delete p.disoriented;
    }
  const detonation = FLASH_FLIGHT + FLASH_FUSE;
  for (const grenade of w.flashGrenades) {
    const before = grenade.age;
    grenade.age += dt;
    if (before >= detonation || grenade.age < detonation) continue;
    // Hearing supplies a search location, never an unseen operative's identity.
    investigateNoise(w, grenade.to);
    for (const p of people(w)) {
      if (
        !living(p) ||
        ('turret' in p && p.turret) ||
        distance(p, grenade.to) > FLASH_RADIUS ||
        !lineClear(w, grenade.to, p)
      )
        continue;
      p.disoriented = FLASH_RECOVERY;
      cancelCharge(p);
      if ('order' in p && (p as Operative).order.kind === 'interact') {
        const a = p as Operative;
        if (
          a.order.kind === 'interact' &&
          (isCharge(a.order.target) || a.order.target === 'file-recall')
        )
          a.interaction = 0;
      }
      if ('inspection' in p) delete p.inspection;
    }
    w.sounds.push({ kind: 'flash', ...grenade.to });
  }
  w.flashGrenades = w.flashGrenades.filter((g) => g.age < detonation + FLASH_PULSE);
}
