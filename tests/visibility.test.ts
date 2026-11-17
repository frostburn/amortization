import { expect, it } from 'vitest';
import { bench } from '../src/content/bench';
import { flashFootprint } from '../src/render/flash';
import { project } from '../src/render/isometric';
import { guardFootprint } from '../src/render/visibility';
import { lineClear, obstacles } from '../src/sim/navigation';
import { sees } from '../src/sim/vision';
import { weaponRange } from '../src/sim/weapons';
import { createWorld, makeGuard } from '../src/sim/world';
import type { Vec } from '../src/sim/types';

// Sample the filled area a player would see, independently of how its vertices were generated.
function contains(points: Vec[], p: Vec) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

it('paints the same forward and rear sight as a human guard, through a narrow gap and round cover', () => {
  const w = createWorld(),
    g = makeGuard('lookout', { x: 10, y: 10 }, [], 0);
  w.gateOpen = true;
  const wall = { id: 'pillar', kind: 'wall' as const, height: 1, x: 12, y: 10.1, w: 0.08, h: 0.04 };
  w.mission = {
    ...w.mission,
    daylight: true,
    solids: [
      wall,
      { ...wall, id: 'next', y: 10.22 },
      { ...wall, id: 'rear', x: 9.5, y: 9.84, h: 0.32 },
    ],
  };
  g.shield = { angle: 0 };
  g.angle = Math.PI; // Shield facing, not travel direction, determines the forward cone.
  const polygon = guardFootprint(w, g, obstacles(w));
  for (const [x, y, expected] of [
    [16, 10.36, false],
    [16, 10.53, true],
    [16, 10.72, false],
    [16, 10.96, true], // separate thin shadows
    [9, 10, false],
    [9.3, 10.8, true],
    [8.5, 10.8, false],
    [20, 10, true],
    [22, 10, false],
  ] as const) {
    const point = { x, y };
    expect(sees(w, g, point)).toBe(expected);
    expect(contains(polygon, point)).toBe(expected);
  }
  const night = { ...w, mission: { ...w.mission, daylight: false } };
  expect(contains(guardFootprint(night, g, obstacles(night)), { x: 20, y: 10 })).toBe(false);
});

it('keeps a turret strictly forward-facing at its weapon range in daylight', () => {
  const w = createWorld(),
    g = makeGuard('turret', { x: 10, y: 10 }, [], 0, 'carbine');
  w.mission = { ...w.mission, daylight: true };
  g.turret = { circuit: 'power-west', homeAngle: 0, lock: 0 };
  const range = weaponRange(g);
  const polygon = guardFootprint(w, g, []);
  expect(contains(polygon, { x: 9.6, y: 10 })).toBe(false);
  expect(contains(polygon, { x: 12, y: 12.5 })).toBe(false);
  expect(contains(polygon, { x: 10 + range - 0.1, y: 10 })).toBe(true);
  expect(contains(polygon, { x: 10 + range + 0.1, y: 10 })).toBe(false);
});

it('updates a stationary flash footprint when the Bench opens; the roof has independent cover', () => {
  const w = createWorld(bench),
    from = { x: 31, y: 15 },
    target = { x: 33.4, y: 15 };
  const covers = (p: Vec, q: Vec) => {
    const points = flashFootprint(w, p),
      vertices = [];
    for (let i = 0; i < points.length; i += 2) vertices.push({ x: points[i], y: points[i + 1] });
    return contains(vertices, project(q));
  };
  expect(lineClear(w, from, target)).toBe(false);
  expect(covers(from, target)).toBe(false);
  expect(covers({ ...from, floor: 1 }, { ...target, floor: 1 })).toBe(true);
  w.finale!.open = true;
  expect(lineClear(w, from, target)).toBe(true);
  expect(covers(from, target)).toBe(true);
});
