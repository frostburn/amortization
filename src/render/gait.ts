import { distance, living } from '../sim/types';
import type { Person } from '../sim/types';
import { TILE_X, TILE_Y } from './isometric';

export const PERSON_SIZE = 43;
export const WALK_STRIDE = 1.1;
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

/** Deform the existing cutout: opposing steps, raised swing foot, bent knee and arm swing. */
export function poseWalker(
  rest: Float32Array,
  vertices: Float32Array,
  p: Person,
  alpha: number,
  ground = false,
) {
  const travelled = distance(p.previous, p);
  if (!living(p) || travelled <= 1e-6) {
    vertices.set(rest);
    return;
  }
  // Interpolate distance with the feet, so pause and slow time also freeze/slow the gait.
  const phase = ((p.step - travelled * (1 - alpha)) / WALK_STRIDE) * Math.PI * 2;
  const swing = Math.sin(phase);
  const lift = Math.cos(phase);
  const dx = (Math.cos(p.angle) - Math.sin(p.angle)) * TILE_X;
  const dy = (Math.cos(p.angle) + Math.sin(p.angle)) * TILE_Y;
  const length = Math.hypot(dx, dy);
  // The art faces left and the entire mesh mirrors when travelling right.
  const forwardX = -Math.abs(dx) / length;
  const forwardY = dy / length;
  const bob = (1 - Math.cos(phase * 2)) * 0.22;
  for (let i = 0; i < rest.length; i += 2) {
    const x = rest[i],
      y = rest[i + 1];
    const u = x / PERSON_SIZE,
      v = y / PERSON_SIZE;
    const side = smooth((u - 0.46) / 0.13) * 2 - 1;
    const leg = smooth((v - 0.52) / 0.4);
    const stride = swing * side * leg;
    const raised = Math.max(0, lift * side);
    const knee = Math.sin(Math.PI * smooth((v - 0.52) / 0.42)) * raised;
    const arm =
      smooth((Math.abs(u - 0.52) - 0.12) / 0.12) *
      smooth((v - 0.28) / 0.13) *
      (1 - smooth((v - 0.58) / 0.12));
    vertices[i] = x + (stride * 3.6 + knee * 0.7 - swing * side * arm * 0.8) * forwardX;
    vertices[i + 1] =
      y + stride * 2.3 * forwardY - (ground ? 0 : raised * leg * 2.4) - bob * (1 - leg);
  }
}
