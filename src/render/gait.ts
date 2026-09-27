import { distance, living } from '../sim/types';
import type { Person } from '../sim/types';
export const WALK_STRIDE = 1.1;
export interface Footfall {
  forward: number;
  lift: number;
}

/** The planted foot travels backward at the body's ground speed. */
export function footfall(phase: number): Footfall {
  const t = ((phase % 1) + 1) % 1;
  return t < 0.5
    ? { forward: WALK_STRIDE * (0.25 - t), lift: 0 }
    : { forward: WALK_STRIDE * (t - 0.75), lift: Math.sin((t - 0.5) * Math.PI * 2) * 0.16 };
}

export function walkPhase(p: Person, alpha: number): number | null {
  const travelled = distance(p.previous, p);
  return living(p) && travelled > 1e-6 ? (p.step - travelled * (1 - alpha)) / WALK_STRIDE : null;
}
