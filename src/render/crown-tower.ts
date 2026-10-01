import type { Graphics } from 'pixi.js';
import { bench } from '../content/bench';
import type { Rect, Solid } from '../sim/types';
import { FLOOR_HEIGHT } from './isometric';
import { panel, plane } from './primitives';

// Both viewpoints describe the same building. The upper mission owns its plan;
// the approach shows the service annex and the full tower beyond the playable map.
export const CROWN_PENTHOUSE_HEIGHT = 20 * FLOOR_HEIGHT;
export const CROWN_SUNSET = {
  haze: 0x4c3c47,
  front: 0xa56e5c,
  side: 0x765260,
  glassFront: 0xb68167,
  glassSide: 0x89676a,
  frameFront: 0xe1b96c,
  frameSide: 0x9c7869,
};

export function crownTowerApproach(entrance: Solid): Solid {
  const { w, h } = bench.building!.footprint;
  return { ...entrance, y: entrance.y - h, w, h, height: CROWN_PENTHOUSE_HEIGHT + FLOOR_HEIGHT };
}

const fade = (color: number, amount: number) =>
  [16, 8, 0].reduce((value, shift) => {
    const a = (color >> shift) & 255,
      b = (CROWN_SUNSET.haze >> shift) & 255;
    return value | (Math.round(a + (b - a) * amount) << shift);
  }, 0);

/** Identical bay spacing, floor heights and sun direction from street or roof.
 * Only the distant lower storeys fade into the evening haze. */
export function drawCrownFacade(
  g: Graphics,
  b: Rect,
  bottom: number,
  top: number,
  fadeDown = false,
) {
  for (const front of [true, false]) {
    const length = front ? b.w : b.h,
      at = (d: number) => (front ? { x: b.x + d, y: b.y + b.h } : { x: b.x + b.w, y: b.y + d }),
      bays = Math.floor(length / 1.9),
      bay = length / bays;
    for (let z = top, row = 0; z > bottom + 0.01; z -= FLOOR_HEIGHT, row++) {
      const low = Math.max(bottom, z - FLOOR_HEIGHT),
        haze = fadeDown ? Math.min(0.82, row * 0.045) : 0,
        color = (c: number) => fade(c, haze);
      panel(g, at(0), at(length), low, z, color(front ? CROWN_SUNSET.front : CROWN_SUNSET.side));
      panel(
        g,
        at(0),
        at(length),
        z - 0.22,
        z,
        color(front ? CROWN_SUNSET.frameFront : CROWN_SUNSET.frameSide),
      );
      for (let i = 0; i < bays; i++) {
        const a = at(i * bay + 0.13),
          b = at((i + 1) * bay - 0.13),
          lit = (i * 7 + row * 13) % 11 < 2;
        panel(
          g,
          a,
          b,
          low + 0.22,
          z - 0.38,
          color(
            lit
              ? front
                ? 0xc49a7a
                : 0xa08077
              : front
                ? CROWN_SUNSET.glassFront
                : CROWN_SUNSET.glassSide,
          ),
        );
        panel(g, a, b, z - 0.95, z - 0.38, color(front ? 0xe5b66c : 0xac8472));
        panel(g, a, b, z - 1.3, z - 1.24, color(front ? 0x77524e : 0x604853));
      }
    }
  }
}

/** The visible outer faces of the cutaway still receive outdoor light. */
export function drawPenthouseExterior(g: Graphics, s: Solid) {
  if (s.id === 'penthouse-south') {
    panel(
      g,
      { x: s.x, y: s.y + s.h },
      { x: s.x + s.w, y: s.y + s.h },
      0,
      s.height,
      CROWN_SUNSET.front,
    );
    plane(g, s.x, s.y + s.h - 0.1, s.w, 0.1, CROWN_SUNSET.frameFront, s.height);
  } else if (s.id === 'penthouse-east') {
    panel(
      g,
      { x: s.x + s.w, y: s.y },
      { x: s.x + s.w, y: s.y + s.h },
      0,
      s.height,
      CROWN_SUNSET.side,
    );
    plane(g, s.x + s.w - 0.1, s.y, 0.1, s.h, CROWN_SUNSET.frameSide, s.height);
  }
}
