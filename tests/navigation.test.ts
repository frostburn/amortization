import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/world';
import { findPath, passable } from '../src/sim/navigation';
import { moveAgents } from '../src/sim/orders';
import { step } from '../src/sim/step';
import { distance } from '../src/sim/types';

describe('navigation at obstacle edges', () => {
  it('can leave a destination just outside the kiosk collision boundary', () => {
    const w = createWorld();
    w.guards = [];
    const a = w.agents[0];
    Object.assign(a, { x: 6.5, y: 14 });
    for (const destination of [
      { x: 6.205, y: 11 },
      { x: 7, y: 14 },
    ]) {
      moveAgents(w, [a.id], destination);
      expect(a.path.length).toBeGreaterThan(0);
      for (let i = 0; i < 180; i++) {
        step(w);
        expect(passable(w, a)).toBe(true);
      }
      expect(distance(a, destination)).toBeLessThan(0.001);
    }
  });

  it('does not cut a corner when the destination shares a grid cell with a waypoint', () => {
    const w = createWorld();
    w.mission = {
      ...w.mission,
      solids: [{ id: 'corner', kind: 'building', x: 5, y: 5, w: 1.1, h: 1, height: 2 }],
    };
    const start = { x: 4, y: 6.5 },
      end = { x: 6.31, y: 6 };
    const path = findPath(w, start, end);
    expect(path.length).toBeGreaterThan(0);
    let from = start;
    for (const to of path) {
      for (let i = 0; i <= 100; i++) {
        expect(
          passable(w, {
            x: from.x + ((to.x - from.x) * i) / 100,
            y: from.y + ((to.y - from.y) * i) / 100,
          }),
        ).toBe(true);
      }
      from = to;
    }
  });

  it('can route out from valid positions along every solid face', () => {
    const w = createWorld();
    for (const s of w.mission.solids) {
      for (const clearance of [0.2, 0.205]) {
        const points = [
          { x: s.x - clearance, y: s.y + s.h / 2 },
          { x: s.x + s.w + clearance, y: s.y + s.h / 2 },
          { x: s.x + s.w / 2, y: s.y - clearance },
          { x: s.x + s.w / 2, y: s.y + s.h + clearance },
        ];
        for (const p of points.filter((p) => passable(w, p))) {
          expect(
            findPath(w, p, w.agents[0]).length,
            `${s.id} at ${JSON.stringify(p)}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });
});
