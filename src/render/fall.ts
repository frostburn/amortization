import { living } from '../sim/types';
import type { Person } from '../sim/types';
import { facingAngle } from '../sim/shield';
import { walkPhase } from './gait';
import type { Point3 } from './model-mesh';

export const FALL_SECONDS = 0.85;
export interface FallPose {
  progress: number;
  stride: number | null;
  angle: number;
}
const ease = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** Render history only: deaths never add animation state to a scored world. */
export class Falls {
  private actors = new Map<string, { at: number | null; stride: number | null; angle: number }>();
  private time = -1;
  clear() {
    this.actors.clear();
    this.time = -1;
  }
  update(people: Person[], alpha: number, time: number, angle = facingAngle) {
    if (time < this.time) this.clear();
    this.time = time;
    for (const p of people) {
      const last = this.actors.get(p.id);
      if (living(p))
        this.actors.set(p.id, { at: null, stride: walkPhase(p, alpha), angle: angle(p) });
      else if (!last)
        // A replay seek or newly visible old casualty starts on the ground.
        this.actors.set(p.id, { at: time - FALL_SECONDS, stride: null, angle: facingAngle(p) });
      else if (last.at === null) last.at = time;
    }
  }
  pose(id: string): FallPose | undefined {
    const actor = this.actors.get(id);
    return actor?.at !== null && actor?.at !== undefined
      ? {
          progress: Math.min(1, (this.time - actor.at) / FALL_SECONDS),
          stride: actor.stride,
          angle: actor.angle,
        }
      : undefined;
  }
}

/** Buckle, pitch forward, then settle. The very same body parts remain attached. */
export function fallTransform(progress: number, hip: number) {
  const angle = (ease((progress - 0.08) / 0.8) * Math.PI) / 2;
  const s = Math.sin(angle),
    c = Math.cos(angle);
  const impact = Math.sin(ease((progress - 0.75) / 0.25) * Math.PI) * 0.035;
  return ([x, y, z]: Point3): Point3 => [
    x * c + (z - hip + 0.1) * s,
    y,
    z * c + (0.24 - x) * s + impact,
  ];
}

export const fallBlend = (progress: number) => ease(progress);
