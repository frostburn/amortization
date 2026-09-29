import type { Graphics } from 'pixi.js';
import type { Vec } from '../sim/types';
import { project } from './isometric';

export const polygon = (g: Graphics, points: Vec[], color: number, alpha = 1) =>
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
export const plane = (
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  z = 0,
  alpha = 1,
) =>
  polygon(
    g,
    [
      project({ x, y }, z),
      project({ x: x + w, y }, z),
      project({ x: x + w, y: y + h }, z),
      project({ x, y: y + h }, z),
    ],
    color,
    alpha,
  );
export function box(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  top: number,
  left: number,
  right: number,
) {
  const a = project({ x, y: y + h }),
    b = project({ x: x + w, y: y + h }),
    c = project({ x: x + w, y });
  const at = project({ x, y: y + h }, z),
    bt = project({ x: x + w, y: y + h }, z),
    ct = project({ x: x + w, y }, z);
  polygon(g, [a, b, bt, at], left);
  polygon(g, [b, c, ct, bt], right);
  plane(g, x, y, w, h, top, z);
}
// Details on vertical faces use the same world projection as the body beneath them.
export function panel(g: Graphics, a: Vec, b: Vec, bottom: number, top: number, color: number) {
  polygon(g, [project(a, bottom), project(b, bottom), project(b, top), project(a, top)], color);
}
