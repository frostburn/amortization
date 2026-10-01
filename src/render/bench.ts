import type { Graphics } from 'pixi.js';
import type { Mission, Solid } from '../sim/types';
import { FLOOR_HEIGHT, project } from './isometric';
import { panel, plane, polygon } from './primitives';

/** A distant city, not playable paving around the executive floor. All of it
 * sits at least 38 world units below the penthouse and is drawn only at build. */
function drawCityBelow(g: Graphics) {
  const blocks = [];
  for (let row = 0; row < 14; row++)
    for (let col = 0; col < 14; col++) {
      const n = (row * 47 + col * 31 + row * col * 7) % 97,
        x = -108 + col * 14 + (n % 4),
        y = -108 + row * 14 + ((n * 3) % 5);
      // Leave air around the tower's footprint; neighbouring roofs cannot
      // accidentally read as a terrace attached to it.
      if (x > -10 && x < 58 && y > -10 && y < 46) continue;
      blocks.push({ x, y, w: 4 + (n % 5), h: 5 + ((n * 3) % 4), z: -50 + (n % 13), n });
    }
  blocks.sort((a, b) => a.x + a.y - b.x - b.y);
  for (const { x, y, w, h, z, n } of blocks) {
    panel(g, { x, y: y + h }, { x: x + w, y: y + h }, -68, z, 0x384555);
    panel(g, { x: x + w, y }, { x: x + w, y: y + h }, -68, z, 0x34404e);
    plane(g, x, y, w, h, n % 3 ? 0x465465 : 0x4c5867, z);
    plane(g, x + 0.6, y + 0.7, w - 1.2, h - 1.4, 0x3e4b5b, z + 0.02);
    // Sparse, low-contrast windows establish scale without competing with
    // objective markers. The lower floors disappear into the blue haze.
    for (let level = 0; level < 4; level++) {
      const bottom = z - 2.5 - level * 3;
      if ((n + level) % 3 === 0) continue;
      panel(
        g,
        { x: x + 0.8, y: y + h + 0.01 },
        { x: x + w - 0.8, y: y + h + 0.01 },
        bottom,
        bottom + 0.2,
        level < 2 ? 0x65707a : 0x465464,
      );
    }
  }
}

/** Fluorescent battens share their wall's depth and occlusion. The wash stays
 * on that vertical face, with no floating ceiling panel or ground light cone. */
export function drawPenthouseLights(g: Graphics, s: Solid) {
  // These two faces look out of the building; their fixtures would face away.
  if (s.id === 'penthouse-south' || s.id === 'penthouse-east') return;
  const wide = s.w > s.h,
    length = wide ? s.w : s.h,
    count = Math.floor(length / 4),
    top = s.height - 0.22;
  const at = (d: number) =>
    wide ? { x: s.x + d, y: s.y + s.h + 0.015 } : { x: s.x + s.w + 0.015, y: s.y + d };
  for (let i = 0; i < count; i++) {
    const center = ((i + 0.5) * length) / count;
    for (const [spread, bottom, alpha] of [
      [1.2, 0.2, 0.08],
      [0.95, 0.5, 0.13],
    ])
      polygon(
        g,
        [
          project(at(center - 0.65), top),
          project(at(center + 0.65), top),
          project(at(center + spread), bottom),
          project(at(center - spread), bottom),
        ],
        0xdcfff4,
        alpha,
      );
    panel(g, at(center - 0.83), at(center + 0.83), top - 0.11, top + 0.07, 0x50656c);
    panel(g, at(center - 0.72), at(center + 0.72), top - 0.07, top + 0.035, 0xbbe2df);
    panel(g, at(center - 0.69), at(center + 0.69), top - 0.03, top + 0.015, 0xf1fff7);
  }
}

export function drawBenchFloors(ground: Graphics, roof: Graphics, mission: Mission) {
  const b = mission.building!.footprint;
  drawCityBelow(ground);
  // A continuous curtain wall drops out of view. Floor spacing matches the
  // playable storeys; there is no ledge or street at the bottom of the drawing.
  for (const front of [true, false]) {
    const length = front ? b.w : b.h,
      at = (d: number) => (front ? { x: b.x + d, y: b.y + b.h } : { x: b.x + b.w, y: b.y + d });
    panel(ground, at(0), at(length), -68, 0, front ? 0x354956 : 0x2e3e4c);
    for (let storey = 0; storey < 20; storey++) {
      const z = -storey * FLOOR_HEIGHT,
        faded = storey > 5,
        panes = Math.floor(length / 1.9),
        bay = length / panes;
      panel(ground, at(0), at(length), z - 0.22, z, faded ? 0x354553 : 0x566d78);
      for (let i = 0; i < panes; i++) {
        const lit = (i * 7 + storey * 13) % 11 < 2;
        panel(
          ground,
          at(i * bay + 0.12),
          at((i + 1) * bay - 0.12),
          z - FLOOR_HEIGHT + 0.22,
          z - 0.38,
          faded ? 0x3a4b5a : lit ? (front ? 0x789295 : 0x647d84) : front ? 0x45616f : 0x3a505f,
        );
        if (!faded)
          panel(ground, at(i * bay + 0.12), at((i + 1) * bay - 0.12), z - 1.3, z - 1.24, 0x56717d);
      }
    }
  }
  plane(ground, b.x, b.y, b.w, b.h, 0x859396);
  for (let x = b.x; x < b.x + b.w; x += 2) plane(ground, x, b.y, 0.025, b.h, 0x728287);
  for (let y = b.y; y < b.y + b.h; y += 2) plane(ground, b.x, y, b.w, 0.025, 0x728287);
  plane(ground, 24, 19.3, 19, 11.7, 0x3c5263);
  plane(ground, 24.3, 19.6, 18.4, 0.09, 0x9fafb3);
  plane(ground, 24.3, 30.6, 18.4, 0.09, 0x9fafb3);
  plane(ground, 32.4, 4.4, 13.6, 13.6, 0x9faeaa);
  plane(ground, 5.2, 28, 4.2, 5.2, 0x404e5b);
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
