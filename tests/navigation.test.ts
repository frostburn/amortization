import { describe, expect, it, vi } from 'vitest';
import { createWorld } from '../src/sim/world';
import {
  canWalk,
  findPath,
  intersects,
  lineClear,
  obstacles,
  passable,
} from '../src/sim/navigation';
import { moveAgents } from '../src/sim/orders';
import { step } from '../src/sim/step';
import { distance } from '../src/sim/types';
import type { Vec, World } from '../src/sim/types';
import { mandate } from '../src/content/mandate';
import { missions } from '../src/content/missions';

it('preserves exact sight and body-clearance rays through live mission geometry', () => {
  let seed = 3511;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (const mission of missions) {
    const w = createWorld(structuredClone(mission));
    for (let state = 0; state < 4; state++) {
      w.gateOpen = !!(state & 1);
      w.shutterOpen = !!(state & 2);
      if (w.detention) {
        w.detention.open = state & 1 ? w.mission.detention!.gates.map((g) => g.id) : [];
        w.mission.detention!.cells.forEach((c) => {
          w.agents[c.agent].captive = !(state & 2);
        });
      }
      // Geometry is editable in place: no stale bounds or door-state cache.
      w.mission.solids[0].x += 0.1;
      const solids = obstacles(w);
      for (const margin of [0, 0.2 - 1e-7]) {
        const check = (a: Vec, b: Vec) => {
          expect(lineClear(w, a, b, margin), `${mission.id}, state ${state}`).toBe(
            !solids.some((r) => intersects(a, b, r, margin)),
          );
        };
        for (let i = 0; i < 100; i++) {
          const point = () => ({ x: random() * mission.width, y: random() * mission.height });
          check(point(), point());
        }
        for (const r of solids) {
          const a = { x: r.x - margin, y: r.y - margin },
            b = { x: r.x + r.w + margin, y: r.y - margin };
          check(a, b); // Grazing an edge, including body margin, must still block.
          check(b, a);
          check(a, a); // A zero-length ray on the inclusive corner.
          check({ ...a, y: a.y - 1e-8 }, { ...b, y: b.y - 1e-8 });
        }
      }
    }
  }
});

function expectWalkable(world: World, start: Vec, end: Vec, path: Vec[]) {
  expect(path.length).toBeGreaterThan(0);
  expect(path.at(-1)).toMatchObject(end);
  let previous = start;
  for (const point of path) {
    expect(canWalk(world, previous, point)).toBe(true);
    previous = point;
  }
}

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

describe('reusable navigation connections', () => {
  function doorwayWorld() {
    const w = createWorld();
    const wall = (y: number, h: number) => ({
      id: `wall-${y}`,
      kind: 'wall' as const,
      x: 5.48,
      y,
      w: 0.04,
      h,
      height: 2,
    });
    w.mission = {
      ...w.mission,
      width: 12,
      height: 12,
      solids: [wall(0, 2), wall(3, 5), wall(9, 3)],
      gate: { x: 5.48, y: 2, w: 0.04, h: 1 },
      archive: { door: { x: 5.48, y: 8, w: 0.04, h: 1 }, inside: { x: 8, y: 8 } },
    };
    return w;
  }
  const start = { x: 3, y: 5.5 },
    end = { x: 8, y: 5.5 };

  it('blocks thin walls between free grid centres in both directions', () => {
    const w = doorwayWorld();
    // Occupancy alone would allow stepping straight through this 4 cm wall.
    expect(passable(w, { x: 5.25, y: 5.25 })).toBe(true);
    expect(passable(w, { x: 5.75, y: 5.25 })).toBe(true);
    expect(findPath(w, start, end)).toEqual([]);
    expect(findPath(w, end, start)).toEqual([]);
  });

  it('keeps gate and shutter states separate, including closing and revisiting them', () => {
    const w = doorwayWorld();
    for (const [gate, shutter] of [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
      [false, false],
      [false, true],
      [true, false],
    ]) {
      w.gateOpen = gate;
      w.shutterOpen = shutter;
      const path = findPath(w, start, end);
      if (gate || shutter) expectWalkable(w, start, end, path);
      else expect(path).toEqual([]);
      // Another world can share this mission without inheriting its door state.
      const other = createWorld(w.mission);
      expect(findPath(other, start, end)).toEqual([]);
    }
  });

  it('invalidates connections after in-place edits, replacements, and map resizing', () => {
    const w = doorwayWorld();
    w.gateOpen = true;
    expectWalkable(w, start, end, findPath(w, start, end));
    w.mission.solids[0].h = 3;
    expect(findPath(w, start, end)).toEqual([]);
    w.mission.solids = [];
    // Leave a short screen so the next search needs a grid and goes around it.
    w.gateOpen = false;
    w.mission.gate = { x: 5.48, y: 0, w: 0.04, h: 8 };
    expectWalkable(w, start, end, findPath(w, start, end));
    w.mission.height = 8;
    expect(findPath(w, start, end)).toEqual([]);
    w.mission.gate.h = 2;
    expectWalkable(w, start, end, findPath(w, start, end));
  });

  it('does not expose cached grid points through returned paths', () => {
    const w = doorwayWorld();
    w.gateOpen = true;
    const path = findPath(w, start, end),
      expected = structuredClone(path);
    expect(path.length).toBeGreaterThan(1);
    path[0].x = 100;
    path[0].y = 100;
    expect(findPath(w, start, end)).toEqual(expected);
  });

  it('does not repeat an exhausted search every tick and retries immediately when the door opens', () => {
    const w = doorwayWorld(),
      measurements = vi.spyOn(Math, 'hypot');
    try {
      expect(findPath(w, start, end)).toEqual([]);
      expect(measurements.mock.calls.length).toBeGreaterThan(100);
      measurements.mockClear();
      for (let i = 0; i < 30; i++) expect(findPath(w, start, end)).toEqual([]);
      // Count heuristic/distance work instead of wall-clock time on the CI host.
      expect(measurements.mock.calls.length).toBeLessThan(100);
      w.gateOpen = true;
      expectWalkable(w, start, end, findPath(w, start, end));
      w.gateOpen = false;
      expect(findPath(w, start, end)).toEqual([]);
      const outside = { x: start.x, y: start.y + 1 };
      expectWalkable(w, start, outside, findPath(w, start, outside));
    } finally {
      measurements.mockRestore();
    }
  });

  it('reuses collision work for the four-person closed-gate Rally from ad0da662', () => {
    const mission = structuredClone(mandate),
      w = createWorld(mission);
    let geometryReads = 0;
    for (const rect of [...mission.solids, mission.gate]) {
      const x = rect.x;
      Object.defineProperty(rect, 'x', {
        get: () => {
          geometryReads++;
          return x;
        },
      });
    }
    const starts = [
      { x: 28.960097177027436, y: 15.243616989524815 },
      { x: 28.371902943316883, y: 15.213052063510952 },
      { x: 29.045499411532514, y: 15.294243186254718 },
      { x: 35.25, y: 14.368933668738057 },
    ];
    const van = { x: 48.4, y: 7.5 };
    const first = findPath(w, starts[0], van),
      initialReads = geometryReads;
    geometryReads = 0;
    const paths = starts.map((p) => findPath(w, p, van));
    // Count geometry access, not elapsed milliseconds: this catches repeated
    // full-map collision scans without depending on CI machine speed.
    expect(geometryReads / starts.length).toBeLessThan(initialReads / 10);
    expect(paths[0]).toEqual(first);
    paths.forEach((path, i) => expectWalkable(w, starts[i], van, path));
  });
});
