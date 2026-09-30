import type { Guard, Person, Vec } from './types';
import { disoriented, living } from './types';

export const SHIELD_TURN = 0.9; // radians/s; the same bearing drives body, sight and protection
export const SHIELD_ARC = Math.PI * 0.36;
export const facingAngle = (p: Person) =>
  ('shield' in p ? (p as Guard).shield?.angle : undefined) ?? p.angle;
export function turnShield(g: Guard, dt: number) {
  if (!g.shield || !living(g) || disoriented(g)) return;
  // Walking to cover must not turn the protective face toward the escape route.
  const aim =
    g.mode === 'combat' && g.lastSeen
      ? Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x)
      : g.angle;
  const delta = Math.atan2(Math.sin(aim - g.shield.angle), Math.cos(aim - g.shield.angle));
  g.shield.angle += Math.max(-SHIELD_TURN * dt, Math.min(SHIELD_TURN * dt, delta));
}
export function shieldFaces(p: Person, source: Vec, arc = SHIELD_ARC) {
  return (
    'shield' in p &&
    !!p.shield &&
    living(p) &&
    !disoriented(p) &&
    Math.cos(Math.atan2(source.y - p.y, source.x - p.x) - facingAngle(p)) >= Math.cos(arc)
  );
}
