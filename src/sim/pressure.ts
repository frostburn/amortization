import type { Person, World } from './types';
import { distance, living } from './types';
import { lineClear } from './navigation';

/** Even under sustained fire readiness advances at 40%. Orders, movement and
 * reloads stay responsive; pressure cannot reset a charge or pin someone forever. */
export const readiness = (p: Person) => 1 - 0.6 * (p.pressure ?? 0);
export function decayPressure(p: Person, dt: number) {
  if (p.pressure === undefined) return;
  const remaining = p.pressure - dt * 0.45;
  if (remaining > 0 && living(p)) p.pressure = remaining;
  else delete p.pressure;
}

/** A narrow lane ending at the actual impact, never beyond the target or through
 * cover. This bounded scan runs only when a support gun actually fires. */
export function suppress(w: World, from: Person, to: Person, hostile: boolean) {
  const opponents = hostile ? [...w.agents, ...(w.escort ? [w.escort] : [])] : w.guards;
  const dx = to.x - from.x,
    dy = to.y - from.y;
  const length2 = dx * dx + dy * dy;
  for (const p of opponents) {
    if (!living(p) || ('turret' in p && p.turret) || ('captive' in p && p.captive)) continue;
    const along = length2 ? ((p.x - from.x) * dx + (p.y - from.y) * dy) / length2 : 0;
    if (along < 0 || along > 1) continue;
    const nearest = {
      ...(from.floor ? { floor: from.floor } : {}),
      x: from.x + dx * along,
      y: from.y + dy * along,
    };
    if (distance(p, nearest) > 1.1 || !lineClear(w, from, p)) continue;
    p.pressure = Math.min(1, (p.pressure ?? 0) + 0.5);
  }
}
