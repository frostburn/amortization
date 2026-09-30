import type { Graphics } from 'pixi.js';
import type { Mission } from '../sim/types';
import { FLOOR_HEIGHT, project } from './isometric';
import { panel, plane } from './primitives';

export function drawBenchFloors(ground: Graphics, roof: Graphics, mission: Mission) {
  const b = mission.building!.footprint;
  // Distant city blocks lie below the executive deck, rather than a street at its feet.
  plane(ground, 0, 0, mission.width, mission.height, 0x302b39);
  for (let x = 0; x < mission.width; x += 4)
    for (let y = 0; y < mission.height; y += 5)
      if (x < 4 || x > 45 || y < 4 || y > 33) {
        plane(ground, x, y, 2.5, 3.4, 0x514049, -2);
        plane(ground, x + 0.25, y + 0.25, 0.15, 2.5, 0xb58256, -1.99, 0.5);
      }
  panel(ground, { x: b.x, y: b.y + b.h }, { x: b.x + b.w, y: b.y + b.h }, -12, 0, 0x303646);
  panel(ground, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, -12, 0, 0x242c3e);
  for (let z = -10; z < 0; z += 2) {
    for (let x = b.x + 1; x < b.x + b.w - 1; x += 2.5)
      panel(
        ground,
        { x, y: b.y + b.h + 0.01 },
        { x: x + 1.7, y: b.y + b.h + 0.01 },
        z,
        z + 1,
        0x957150,
      );
    for (let y = b.y + 1; y < b.y + b.h - 1; y += 2.5)
      panel(
        ground,
        { x: b.x + b.w + 0.01, y },
        { x: b.x + b.w + 0.01, y: y + 1.7 },
        z,
        z + 1,
        0x72574a,
      );
  }
  plane(ground, b.x, b.y, b.w, b.h, 0x62636a);
  for (let x = b.x; x < b.x + b.w; x += 2) plane(ground, x, b.y, 0.025, b.h, 0x464b54);
  for (let y = b.y; y < b.y + b.h; y += 2) plane(ground, b.x, y, b.w, 0.025, 0x464b54);
  plane(ground, 24, 19.3, 19, 11.7, 0x69453f);
  plane(ground, 24.3, 19.6, 18.4, 0.09, 0xbd9d67);
  plane(ground, 24.3, 30.6, 18.4, 0.09, 0xbd9d67);
  plane(ground, 32.4, 4.4, 13.6, 13.6, 0x817464);
  plane(ground, 5.2, 28, 4.2, 5.2, 0x393f4b);
  plane(roof, b.x, b.y, b.w, b.h, 0x4a515a, FLOOR_HEIGHT + 0.015);
  for (let x = b.x + 2; x < b.x + b.w; x += 4)
    plane(roof, x, b.y, 0.04, b.h, 0x677075, FLOOR_HEIGHT + 0.02);
  for (let y = b.y + 2; y < b.y + b.h; y += 4)
    plane(roof, b.x, y, b.w, 0.04, 0x677075, FLOOR_HEIGHT + 0.02);
  const center = { x: 35, y: 15 };
  for (const radius of [6, 6.25]) {
    for (let i = 0; i <= 64; i++) {
      const a = (i * Math.PI) / 32,
        p = project(
          { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius },
          FLOOR_HEIGHT + 0.03,
        );
      if (i) roof.lineTo(p.x, p.y);
      else roof.moveTo(p.x, p.y);
    }
    roof.stroke({ color: 0xe9c875, width: 2 });
  }
  for (const x of [33.5, 36]) plane(roof, x, 13.2, 0.45, 3.6, 0xdcd8be, FLOOR_HEIGHT + 0.035);
  plane(roof, 33.5, 14.8, 2.95, 0.45, 0xdcd8be, FLOOR_HEIGHT + 0.035);
  for (const x of [28.5, 41.5])
    for (const y of [8.5, 21.5]) {
      const p = project({ x, y }, FLOOR_HEIGHT + 0.08);
      roof
        .circle(p.x, p.y, 3)
        .fill(0xffd78b)
        .circle(p.x, p.y, 7)
        .fill({ color: 0xffc66a, alpha: 0.12 });
    }
}
