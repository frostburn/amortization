import { distance, inside, living } from './types';
import type { Guard, Operative, World } from './types';
import { lineClear } from './navigation';
import { shoot } from './combat';
import { visibleWeapon, weaponRange } from './weapons';

export const TURRET_ARC = Math.PI / 4;
export const TURRET_LOCK = 0.8;
export const inspectionRemaining = (w: World) =>
  Math.max(0, (w.security?.inspectionUntil ?? 0) - w.time);
export const turretPowered = (w: World, g: Guard) =>
  !!g.turret &&
  living(g) &&
  !w.security?.isolated.includes(g.turret.circuit) &&
  inspectionRemaining(w) === 0;
export const activeTurrets = (w: World) => w.guards.filter((g) => turretPowered(w, g));
export const canAuthorise = (w: World, a: Operative) =>
  living(a) &&
  a.disguised &&
  !visibleWeapon(a) &&
  !a.exposed &&
  !a.carrying &&
  !w.known.includes(a.id);

/** Local optical tracking and wired power never depend on the guard radio network. */
export function updateTurret(w: World, g: Guard, dt: number) {
  const device = g.turret!;
  g.path = [];
  g.radio = 0;
  if (!turretPowered(w, g)) {
    g.target = null;
    device.lock = 0;
    g.mode = 'patrol';
    return;
  }
  const candidates = w.agents.filter((a) => {
    if (!living(a) || distance(g, a) > weaponRange(g) || !lineClear(w, g, a)) return false;
    const bearing = Math.atan2(a.y - g.y, a.x - g.x);
    if (Math.cos(bearing - g.angle) < Math.cos(TURRET_ARC)) return false;
    return (
      g.known.includes(a.id) ||
      visibleWeapon(a) ||
      a.carrying ||
      (inside(a, w.mission.restricted) && (!a.disguised || inside(a, w.mission.secure)))
    );
  });
  const target =
    candidates.find((a) => a.id === g.target) ??
    candidates.sort((a, b) => distance(g, a) - distance(g, b))[0];
  if (!target) {
    g.target = null;
    device.lock = 0;
    g.mode = 'patrol';
    // Distinct scan phases prevent all four guns from opening a gap at once.
    g.angle = device.homeAngle + Math.sin(w.time * 0.55 + g.x) * 0.55;
    return;
  }
  if (g.target !== target.id) device.lock = 0;
  g.target = target.id;
  g.mode = device.lock >= TURRET_LOCK ? 'combat' : 'challenge';
  const bearing = Math.atan2(target.y - g.y, target.x - g.x);
  const turn = Math.atan2(Math.sin(bearing - g.angle), Math.cos(bearing - g.angle));
  g.angle += Math.max(-dt * 1.5, Math.min(dt * 1.5, turn));
  device.lock = Math.min(TURRET_LOCK, device.lock + dt);
  if (device.lock < TURRET_LOCK) return;
  if (!g.known.includes(target.id)) g.known.push(target.id);
  target.exposed = true;
  g.mode = 'combat';
  shoot(w, g, target, true, dt);
}
