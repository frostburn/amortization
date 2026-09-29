import type { Graphics } from 'pixi.js';
import type { Vec, World } from '../sim/types';
import { FLASH_FLIGHT, FLASH_FUSE, FLASH_PULSE, FLASH_RADIUS } from '../sim/flash';
import { project, TILE_X, TILE_Y } from './isometric';
import { lineClear } from '../sim/navigation';

const footprints = new WeakMap<
  World,
  { mission: World['mission']; points: Map<string, number[]> }
>();
function footprint(w: World, point: Vec) {
  let cache = footprints.get(w);
  if (!cache || cache.mission !== w.mission) {
    cache = { mission: w.mission, points: new Map() };
    footprints.set(w, cache);
  }
  // Reuse short visibility rays until the landing point or collision state changes.
  const key = [
    point.x,
    point.y,
    w.gateOpen,
    w.shutterOpen,
    w.detention?.open.join(','),
    ...w.agents.map((a) => a.captive),
  ].join(':');
  let points = cache.points.get(key);
  if (!points) {
    points = Array.from({ length: 48 }, (_, i) => {
      const angle = (i * Math.PI) / 24;
      const end = (r: number) => ({
        x: point.x + Math.cos(angle) * r,
        y: point.y + Math.sin(angle) * r,
      });
      let near = 0,
        far = FLASH_RADIUS;
      if (lineClear(w, point, end(far))) near = far;
      else
        for (let n = 0; n < 7; n++) {
          const middle = (near + far) / 2;
          if (lineClear(w, point, end(middle))) near = middle;
          else far = middle;
        }
      const p = project(end(near));
      return [p.x, p.y];
    }).flat();
    if (cache.points.size >= 4) cache.points.clear();
    cache.points.set(key, points);
  }
  return points;
}

export interface FlashAimView {
  point: Vec;
  from?: Vec;
  valid: boolean;
  exposed: Vec[];
}
export function drawFlashes(g: Graphics, w: World, aim: FlashAimView | null) {
  const ring = (point: Vec, radius: number) => {
    const p = project(point);
    return g.ellipse(p.x, p.y, radius * Math.SQRT2 * TILE_X, radius * Math.SQRT2 * TILE_Y);
  };
  if (aim) {
    const color = aim.valid ? 0x9de8d4 : 0xefbd73;
    g.poly(footprint(w, aim.point))
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
    const flight = Math.min(1, grenade.age / FLASH_FLIGHT);
    const burst = grenade.age - FLASH_FLIGHT - FLASH_FUSE;
    if (burst < 0) {
      if (flight === 1) {
        g.poly(footprint(w, grenade.to)).stroke({ color: 0xefbd73, width: 1, alpha: 0.45 });
      }
    } else {
      const fade = Math.max(0, 1 - burst / FLASH_PULSE);
      g.poly(footprint(w, grenade.to))
        .fill({ color: 0xe2edce, alpha: 0.11 * fade })
        .stroke({ color: 0xe2edce, width: 3, alpha: 0.6 * fade });
    }
  }
}
