import type { Graphics } from 'pixi.js';
import { floorOf } from '../sim/types';
import type { Rect, Vec, World } from '../sim/types';
import { FLASH_FLIGHT, FLASH_FUSE, FLASH_PULSE, FLASH_RADIUS } from '../sim/flash';
import { project, TILE_X, TILE_Y } from './isometric';
import { obstacles } from '../sim/navigation';
import { visibleRim } from './visibility';

interface Footprint {
  x: number;
  y: number;
  floor: number;
  solids: Rect[];
  points: number[];
}
const footprints = new WeakMap<World, Footprint[]>();
export function flashFootprint(w: World, point: Vec) {
  const floor = floorOf(point),
    solids = obstacles(w, floor);
  const cache = footprints.get(w) ?? [];
  // Compare the actual live blockers, including the Bench door and held detention gates.
  const hit = cache.find(
    (f) =>
      f.x === point.x &&
      f.y === point.y &&
      f.floor === floor &&
      f.solids.length === solids.length &&
      f.solids.every((r, i) => r === solids[i]),
  );
  if (hit) return hit.points;
  const points = visibleRim(point, solids, FLASH_RADIUS).flatMap((p) => {
    const xy = project(p);
    return [xy.x, xy.y];
  });
  if (cache.length === 4) cache.shift();
  cache.push({ x: point.x, y: point.y, floor, solids, points });
  footprints.set(w, cache);
  return points;
}

export interface FlashAimView {
  point: Vec;
  from?: Vec;
  valid: boolean;
  exposed: Vec[];
}
export function drawFlashes(g: Graphics, w: World, aim: FlashAimView | null, floor = 0) {
  const ring = (point: Vec, radius: number) => {
    const p = project(point);
    return g.ellipse(p.x, p.y, radius * Math.SQRT2 * TILE_X, radius * Math.SQRT2 * TILE_Y);
  };
  if (aim) {
    const color = aim.valid ? 0x9de8d4 : 0xefbd73;
    g.poly(flashFootprint(w, aim.point))
      .fill({ color, alpha: 0.055 })
      .stroke({ color, width: 1.8, alpha: 0.8 });
    ring(aim.point, 0.16).fill(color);
    if (aim.from) {
      const from = project(aim.from, 1),
        to = project(aim.point);
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color, width: 1.3, alpha: 0.6 });
    }
    for (const a of aim.exposed) ring(a, 0.55).stroke({ color: 0xf57869, width: 2.5 });
  }
  for (const grenade of w.flashGrenades ?? []) {
    if (floorOf(grenade.to) !== floor) continue;
    const flight = Math.min(1, grenade.age / FLASH_FLIGHT);
    const burst = grenade.age - FLASH_FLIGHT - FLASH_FUSE;
    if (burst < 0) {
      if (flight === 1) {
        g.poly(flashFootprint(w, grenade.to)).stroke({ color: 0xefbd73, width: 1, alpha: 0.45 });
      }
    } else {
      const fade = Math.max(0, 1 - burst / FLASH_PULSE);
      g.poly(flashFootprint(w, grenade.to))
        .fill({ color: 0xe2edce, alpha: 0.11 * fade })
        .stroke({ color: 0xe2edce, width: 3, alpha: 0.6 * fade });
    }
  }
}
