import type { Graphics } from 'pixi.js';
import type { VisualTheme } from './theme';
import type { Mission, Solid, Vec } from '../sim/types';
import { box, panel, plane, polygon } from './primitives';
import { project } from './isometric';

const yard = [0x697079, 0x666d76, 0x6b7178, 0x636b75, 0x676f77];
const verge = [0x343e47, 0x374048, 0x333d45, 0x38414a, 0x353e46];
const dayYard = [0xb8b6aa, 0xb4b3a6, 0xbab8ad, 0xb2b2a7, 0xb7b5a9];
export function groundColor(
  x: number,
  y: number,
  restricted: boolean,
  street: boolean,
  theme: VisualTheme = 'night',
) {
  const n = (Math.floor(x / 2) * 17 + Math.floor(y / 2) * 23) % 5;
  if (theme === 'sunset')
    return restricted
      ? [0x8a5d55, 0x855950, 0x8e6257, 0x805852, 0x8a6058][n]
      : street
        ? 0x4b3644
        : 0x59414a;
  if (theme === 'day') return restricted ? dayYard[n] : street ? 0x858f93 : 0x91a084;
  return restricted ? yard[n] : street ? 0x303944 : verge[n];
}

/** Stable variation only; rebuilding a mission never rolls different scenery. */
function seed(id: string) {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return n;
}

export function drawContactShadow(
  g: Graphics,
  s: Solid,
  theme: VisualTheme = 'night',
  site?: Pick<Mission, 'width' | 'height'>,
) {
  if (s.kind === 'van' || s.kind === 'transport') return; // Vehicle art owns its moving shadow.
  if (theme !== 'night') {
    const dx = s.height * (theme === 'sunset' ? 2.2 : 0.7),
      dy = s.height * (theme === 'sunset' ? 1.1 : 0.45);
    let outline: Vec[] = [
      { x: s.x, y: s.y },
      { x: s.x + s.w, y: s.y },
      { x: s.x + s.w + dx, y: s.y + dy },
      { x: s.x + s.w + dx, y: s.y + s.h + dy },
      { x: s.x + dx, y: s.y + s.h + dy },
      { x: s.x, y: s.y + s.h },
    ];
    // Long sunset shadows end at the ground plane instead of floating beyond
    // the map. Clip in world space before applying the isometric projection.
    if (site) {
      for (const [axis, bound, sign] of [
        ['x', 0, 1],
        ['x', site.width, -1],
        ['y', 0, 1],
        ['y', site.height, -1],
      ] as const) {
        if (!outline.length) break;
        const clipped: Vec[] = [];
        let previous = outline[outline.length - 1];
        for (const p of outline) {
          const wasInside = (previous[axis] - bound) * sign >= 0,
            isInside = (p[axis] - bound) * sign >= 0;
          if (wasInside !== isInside) {
            const t = (bound - previous[axis]) / (p[axis] - previous[axis]);
            clipped.push({
              x: previous.x + (p.x - previous.x) * t,
              y: previous.y + (p.y - previous.y) * t,
            });
          }
          if (isInside) clipped.push(p);
          previous = p;
        }
        outline = clipped;
      }
    }
    polygon(
      g,
      outline.map((p) => project(p)),
      theme === 'sunset' ? 0x351d35 : 0x34495b,
      theme === 'sunset' ? 0.25 : 0.22,
    );
  }
  for (const [pad, alpha] of [
    [0.28, 0.09],
    [0.14, 0.13],
    [0.04, 0.2],
  ])
    plane(g, s.x - 0.02, s.y - 0.02, s.w + pad, s.h + pad, 0x101723, 0, alpha);
}

/** Concrete seams and a pale coping keep wall tops legible in the ambient dark. */
export function drawWall(g: Graphics, s: Solid, theme: VisualTheme = 'night') {
  const sunset = theme === 'sunset';
  box(
    g,
    s.x,
    s.y,
    s.w,
    s.h,
    s.height,
    sunset ? 0xe5bc70 : 0xb2ac9e,
    sunset ? 0xa56e5c : 0x8a8b83,
    sunset ? 0x765260 : 0x707b7e,
  );
  const wide = s.w > s.h;
  for (let d = 1.6; d < (wide ? s.w : s.h) - 0.2; d += 2) {
    const a = wide ? { x: s.x + d, y: s.y + s.h } : { x: s.x + s.w, y: s.y + d };
    const b = wide ? { x: a.x + 0.035, y: a.y } : { x: a.x, y: a.y + 0.035 };
    panel(g, a, b, 0.12, s.height - 0.11, 0x606a6e);
  }
  // The damp base and cap are on the wall, not additional collision geometry.
  panel(g, { x: s.x, y: s.y + s.h }, { x: s.x + s.w, y: s.y + s.h }, 0, 0.18, 0x626e71);
  panel(g, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, 0, 0.18, 0x536169);
  panel(
    g,
    { x: s.x, y: s.y + s.h },
    { x: s.x + s.w, y: s.y + s.h },
    s.height - 0.1,
    s.height,
    0x9f9e93,
  );
}

/** Quiet municipal facades. Details stay within the existing solid footprint. */
export function drawBuilding(g: Graphics, s: Solid, theme: VisualTheme = 'night') {
  const daylight = theme === 'day',
    sunset = theme === 'sunset';
  const brick = /kiosk|office-block|street-workshop|street-block/.test(s.id),
    utility = /substation|service|power/.test(s.id),
    n = seed(s.id),
    face = sunset
      ? brick
        ? 0xac6251
        : 0xb9765e
      : brick
        ? 0x997967
        : utility
          ? 0x809099
          : 0xaca99b,
    side = sunset
      ? brick
        ? 0x673f49
        : 0x785262
      : brick
        ? 0x735d54
        : utility
          ? 0x596f7a
          : 0x7f898b,
    coping = sunset ? 0xe4b76d : brick ? 0xb4a58d : 0xb9b7aa;
  box(g, s.x, s.y, s.w, s.h, s.height, coping, face, side);
  // A recessed slate roof, coping and simple service ducts break up flat boxes.
  const inset = Math.min(0.25, s.w / 8, s.h / 8);
  plane(
    g,
    s.x + inset,
    s.y + inset,
    s.w - 2 * inset,
    s.h - 2 * inset,
    sunset ? 0x75545c : daylight ? 0x778388 : 0x454f5c,
    s.height + 0.01,
  );
  for (let y = s.y + 0.7; y < s.y + s.h - 0.25; y += 1.5)
    plane(g, s.x + inset, y, s.w - 2 * inset, 0.025, 0x65717b, s.height + 0.015, 0.5);
  if (s.w > 2 && s.h > 1.4) {
    const x = s.x + 0.55,
      y = s.y + 0.45,
      w = Math.min(1.25, s.w - 1),
      h = 0.5;
    panel(g, { x, y: y + h }, { x: x + w, y: y + h }, s.height + 0.02, s.height + 0.14, 0x65717b);
    panel(g, { x: x + w, y }, { x: x + w, y: y + h }, s.height + 0.02, s.height + 0.14, 0x4b5a68);
    plane(g, x, y, w, h, 0x879198, s.height + 0.14);
  }
  const base = 0.3;
  panel(g, { x: s.x, y: s.y + s.h }, { x: s.x + s.w, y: s.y + s.h }, 0, base, 0x606972);
  panel(g, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, 0, base, 0x465563);
  if (brick) {
    for (let z = 0.5, row = 0; z < s.height - 0.15; z += 0.32, row++) {
      panel(g, { x: s.x, y: s.y + s.h }, { x: s.x + s.w, y: s.y + s.h }, z, z + 0.02, 0x806759);
      panel(g, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, z, z + 0.02, 0x62564f);
      for (const horizontal of [true, false]) {
        const length = horizontal ? s.w : s.h;
        const at = (d: number) =>
          horizontal ? { x: s.x + d, y: s.y + s.h } : { x: s.x + s.w, y: s.y + d };
        for (let d = row % 2 ? 0.38 : 0.76; d < length - 0.03; d += 0.76)
          panel(
            g,
            at(d),
            at(d + 0.02),
            z,
            Math.min(z + 0.32, s.height - 0.12),
            horizontal ? 0x806759 : 0x62564f,
          );
      }
    }
  }
  const bottom = Math.min(0.9, s.height * 0.3),
    top = Math.min(s.height - 0.35, bottom + 0.85);
  for (const horizontal of [true, false]) {
    const length = horizontal ? s.w : s.h;
    const at = (d: number) =>
      horizontal ? { x: s.x + d, y: s.y + s.h + 0.006 } : { x: s.x + s.w + 0.006, y: s.y + d };
    for (let d = 0.42, i = 0; d < length - 0.65; d += 1.15, i++) {
      const width = Math.min(0.68, length - d - 0.25),
        lit = !daylight && (n + i + Number(horizontal)) % 4 === 0,
        glass = sunset
          ? horizontal
            ? 0xe0b263
            : 0xa7745c
          : daylight
            ? horizontal
              ? 0x94b0b9
              : 0x6b8899
            : lit
              ? 0xc4b38c
              : horizontal
                ? 0x374d5f
                : 0x2a3e50;
      panel(g, at(d - 0.05), at(d + width + 0.05), bottom - 0.07, top + 0.07, 0x475560);
      panel(g, at(d), at(d + width), bottom, top, glass);
      panel(g, at(d), at(d + width), top - 0.13, top, lit ? 0xead4a0 : 0x718691);
      panel(g, at(d + width * 0.5 - 0.015), at(d + width * 0.5 + 0.015), bottom, top, 0x596774);
      panel(g, at(d - 0.06), at(d + width + 0.06), bottom - 0.07, bottom - 0.025, coping);
    }
  }
  // Low service vents distinguish utility buildings from the occupied offices.
  if (utility)
    for (let z = 0.42; z < 0.75; z += 0.09)
      panel(
        g,
        { x: s.x + 0.4, y: s.y + s.h + 0.01 },
        { x: s.x + 1.25, y: s.y + s.h + 0.01 },
        z,
        z + 0.035,
        0x394e5d,
      );
  // Downpipe anchored to the side wall, terminating at the ground.
  const p = project({ x: s.x + s.w + 0.01, y: s.y + s.h - 0.18 }, 0.1),
    q = project({ x: s.x + s.w + 0.01, y: s.y + s.h - 0.18 }, s.height - 0.05);
  g.moveTo(p.x, p.y).lineTo(q.x, q.y).stroke({ color: 0x4a6470, width: 2 });
}

/** Surface wear is sparse and flat, so it never suggests an impassable prop. */
export function drawYardDetail(g: Graphics, x: number, y: number) {
  const a = project({ x, y }),
    b = project({ x: x + 0.38, y: y + 0.12 }),
    c = project({ x: x + 0.7, y: y + 0.06 });
  g.poly([a.x, a.y, b.x, b.y, c.x, c.y], false).stroke({ color: 0x3b4754, width: 0.7, alpha: 0.4 });
  polygon(
    g,
    [
      project({ x: x + 0.1, y: y + 0.2 }),
      project({ x: x + 0.5, y: y + 0.3 }),
      project({ x: x + 0.42, y: y + 0.38 }),
    ],
    0x879096,
    0.12,
  );
}
