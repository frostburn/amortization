import type { Graphics } from 'pixi.js';
import type { Mission, Vec } from '../sim/types';
import { box, panel, plane } from './primitives';

export function drawThresholdGround(g: Graphics, m: Mission) {
  // Painted staff walk, platform edges and tram rails share the collision layout.
  plane(g, 10.4, 4.5, 31.5, 1.1, 0xc39360, 0, 0.5);
  plane(g, 41.5, 5.5, 12.5, 7.9, 0xa77d67);
  for (const x of [30.9, 32.5]) plane(g, x, 5, 0.075, 30.7, 0xc5a374);
  for (let y = 5; y < 35; y += 0.8) plane(g, 30.4, y, 2.9, 0.1, 0x4c3641);
  for (const x of [29.7, 33.7]) plane(g, x, 5, 0.1, 30.7, 0xe9bd68);
  for (let x = 11; x < 54; x += 1.3) plane(g, x, 34.7, 0.75, 0.08, 0xcf9a61);
  const p = m.threshold!.door;
  plane(g, p.x - 2.2, p.y - 0.2, 4.4, 3.5, 0x9b725f);
  plane(g, p.x - 2.2, p.y + 3.25, 4.4, 0.12, 0xf0ce6c);
}

/** A real boarding destination with two closing leaves; no stretched vehicle proxy. */
export function drawLiftPortal(g: Graphics, p: Vec, closed: number) {
  g.clear();
  const left = p.x - 1.6,
    right = p.x + 1.6,
    y = p.y + 0.08;
  panel(g, { x: left, y }, { x: right, y }, 0, 2.8, 0x302331);
  for (const x of [left - 0.22, right]) box(g, x, y, 0.22, 0.3, 3.1, 0xf0c668, 0xb37758, 0x6b4650);
  panel(g, { x: left, y: y + 0.3 }, { x: right, y: y + 0.3 }, 2.8, 3.1, 0xeac76e);
  if (closed > 0) {
    const leaf = 1.6 * closed;
    panel(g, { x: left, y: y + 0.04 }, { x: left + leaf, y: y + 0.04 }, 0, 2.8, 0x89665e);
    panel(g, { x: right - leaf, y: y + 0.04 }, { x: right, y: y + 0.04 }, 0, 2.8, 0xa78067);
  }
  panel(
    g,
    { x: p.x - 0.25, y: y + 0.32 },
    { x: p.x + 0.25, y: y + 0.32 },
    2.88,
    3.01,
    closed < 1 ? 0x96edc8 : 0xffd66d,
  );
}
