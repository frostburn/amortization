import type { Graphics } from 'pixi.js';
import type { Guard, Vec, World } from '../sim/types';
import { living } from '../sim/types';
import { turretPowered, TURRET_LOCK } from '../sim/security';
import { project } from './isometric';

export const circuitColor = (circuit: string) => (circuit === 'power-west' ? 0xefbd73 : 0x7fbdf1);

/** A low pedestal and rotating gun housing, projected in the same space as scenery. */
export function drawTurret(g: Graphics, guard: Guard, world: World) {
  const color = circuitColor(guard.turret!.circuit);
  const live = living(guard),
    powered = turretPowered(world, guard);
  const forward = { x: Math.cos(guard.angle), y: Math.sin(guard.angle) };
  const right = { x: -forward.y, y: forward.x };
  const p = (along: number, across: number, z: number): Vec =>
    project(
      {
        x: forward.x * along + right.x * across,
        y: forward.y * along + right.y * across,
      },
      z,
    );
  const poly = (points: Vec[], fill: number) =>
    g.poly(points.flatMap((point) => [point.x, point.y])).fill(fill);
  g.ellipse(0, 1, 19, 9).fill({ color: 0x101914, alpha: 0.65 });
  const corners = [
    [-0.45, -0.4],
    [0.45, -0.4],
    [0.45, 0.4],
    [-0.45, 0.4],
  ];
  const base = (z: number) => corners.map(([x, y]) => project({ x, y }, z));
  const bottom = base(0),
    top = base(live ? 0.35 : 0.16);
  poly([bottom[1], bottom[2], top[2], top[1]], 0x34443e);
  poly([bottom[2], bottom[3], top[3], top[2]], 0x526259);
  poly(top, live ? 0x9ca89d : 0x424941);
  if (!live) {
    poly([p(-0.3, -0.25, 0.23), p(0.5, -0.1, 0.23), p(0.2, 0.3, 0.2)], 0x242c29);
    const broken = p(0.8, 0.2, 0.12);
    g.moveTo(0, -5).lineTo(broken.x, broken.y).stroke({ color: 0x6e7470, width: 4 });
    return;
  }
  // Draw the barrel before the housing when it points away from the camera.
  const barrel = () => {
    const from = p(0.2, 0, 0.92),
      end = p(0.9, 0, 0.92);
    g.moveTo(from.x, from.y).lineTo(end.x, end.y).stroke({ color: 0x182620, width: 6 });
    g.moveTo(from.x - 1, from.y - 1)
      .lineTo(end.x - 1, end.y - 1)
      .stroke({ color: 0xaab7ad, width: 2 });
  };
  const front = forward.x + forward.y >= 0;
  if (!front) barrel();
  const hull = (z: number) => [
    p(-0.36, -0.3, z),
    p(0.36, -0.3, z),
    p(0.36, 0.3, z),
    p(-0.36, 0.3, z),
  ];
  const low = hull(0.55),
    high = hull(1.05);
  const sides = [0, 1, 2, 3].sort(
    (a, b) => low[a].y + low[(a + 1) % 4].y - (low[b].y + low[(b + 1) % 4].y),
  );
  for (const i of sides)
    poly([low[i], low[(i + 1) % 4], high[(i + 1) % 4], high[i]], i % 2 ? 0x53675e : 0x344c43);
  poly(high, powered ? color : 0x6b7a70);
  if (front) barrel();
  const lens = p(0.36, -0.2, 0.85);
  g.circle(lens.x, lens.y, 2).fill(powered ? (guard.target ? 0xff6b60 : 0xc9ffc8) : 0x233b31);
  if (powered && guard.target)
    g.rect(-13, 7, 26, 3)
      .fill(0x13221e)
      .rect(-13, 7, (26 * guard.turret!.lock) / TURRET_LOCK, 3)
      .fill(0xf57869);
}
