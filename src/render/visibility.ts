import type { Guard, Rect, Vec, World } from '../sim/types';
import { facingAngle } from '../sim/shield';
import { TURRET_ARC } from '../sim/security';
import { sightRange } from '../sim/vision';
import { weaponRange } from '../sim/weapons';

const TURN = 2 * Math.PI;
const CORNER_EPSILON = 0.00001;

/** The rim of a visibility sector, in world coordinates. Pass the live obstacles on this floor. */
export function visibleRim(
  origin: Vec,
  solids: Rect[],
  radius: number,
  start = 0,
  sweep = TURN,
): Vec[] {
  const steps = Math.ceil(sweep / (Math.PI / 24));
  const angles = Array.from(
    { length: steps + Number(sweep < TURN) },
    (_, i) => (sweep * i) / steps,
  );
  const boxes: { left: number; top: number; right: number; bottom: number }[] = [];
  for (const r of solids) {
    const left = r.x - origin.x,
      top = r.y - origin.y,
      right = left + r.w,
      bottom = top + r.h;
    const nx = Math.max(0, left, -right),
      ny = Math.max(0, top, -bottom);
    if (nx * nx + ny * ny > radius * radius) continue;
    boxes.push({ left, top, right, bottom });
    // Uniform rays alone miss thin obstacles and cut diagonally across open doorways.
    // At each corner trace both the wall and the space immediately past its edge.
    for (const x of [left, right])
      for (const y of [top, bottom]) {
        if (x * x + y * y > radius * radius) continue;
        const a = Math.atan2(y, x) - start;
        for (const d of [a - CORNER_EPSILON, a, a + CORNER_EPSILON]) {
          const offset = ((d % TURN) + TURN) % TURN;
          if (offset < sweep) angles.push(offset);
        }
      }
  }
  angles.sort((a, b) => a - b);
  const rim: Vec[] = [];
  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i];
    if (i && angle - angles[i - 1] < 1e-9) continue;
    const dx = Math.cos(start + angle),
      dy = Math.sin(start + angle);
    let reach = radius;
    for (const { left, top, right, bottom } of boxes) {
      // Intersect the ray with the rectangle's two slabs. Parallel rays on an edge are blocked.
      let enter = 0,
        exit = reach;
      if (Math.abs(dx) < 1e-10) {
        if (left > 0 || right < 0) continue;
      } else {
        enter = Math.max(enter, (dx > 0 ? left : right) / dx);
        exit = Math.min(exit, (dx > 0 ? right : left) / dx);
      }
      if (Math.abs(dy) < 1e-10) {
        if (top > 0 || bottom < 0) continue;
      } else {
        enter = Math.max(enter, (dy > 0 ? top : bottom) / dy);
        exit = Math.min(exit, (dy > 0 ? bottom : top) / dy);
      }
      if (enter <= exit) reach = enter;
    }
    rim.push({ x: origin.x + dx * reach, y: origin.y + dy * reach, floor: origin.floor });
  }
  return rim;
}

export function guardFootprint(w: World, g: Guard, solids: Rect[]): Vec[] {
  if (g.turret)
    return [g, ...visibleRim(g, solids, weaponRange(g), g.angle - TURRET_ARC, 2 * TURRET_ARC)];
  // Match sees(): human guards can spot someone close behind them, even at night.
  const facing = facingAngle(g),
    arc = Math.PI * 0.36;
  return [
    ...visibleRim(g, solids, sightRange(g, w), facing - arc, 2 * arc),
    ...visibleRim(g, solids, 1.3, facing + arc, TURN - 2 * arc),
  ];
}
