import { expect, it } from 'vitest';
import { custody } from '../src/content/custody';
import { createWorld } from '../src/sim/world';
import { interact, landmark, moveAgents } from '../src/sim/orders';
import { canWalk, passable } from '../src/sim/navigation';
import { distance } from '../src/sim/types';
import { step } from '../src/sim/step';

it('keeps the depot replay formation inside the east wall, while allowing deliberate moves outside', () => {
  const w = createWorld();
  w.guards = [];
  w.agents.forEach((a, i) => Object.assign(a, { x: 25 + i * 0.4, y: 7.5 }));
  const ids = w.agents.map((a) => a.id);
  // The 0ba95f1c recording sent half the crew on a 39-unit detour at this click.
  moveAgents(w, ids, { x: 27.907938752424045, y: 7.151094861021333 });
  for (const a of w.agents) {
    expect(a.order.kind).toBe('move');
    expect(a.path.at(-1)!.x).toBeLessThanOrEqual(27.8);
    let from = a;
    for (const point of a.path) {
      expect(canWalk(w, from, point)).toBe(true);
      from = { ...a, ...point };
    }
  }
  for (let i = 0; i < 120; i++) step(w);
  expect(w.agents.every((a) => passable(w, a) && a.x <= 27.8 && !a.path.length)).toBe(true);
  moveAgents(w, ids, { x: 29.5, y: 7 });
  expect(w.agents.every((a) => a.path.at(-1)!.x > 28.55)).toBe(true);
});

it('tightens a group into a narrow corridor without placing slots through its walls', () => {
  const w = createWorld();
  w.guards = [];
  w.mission = {
    ...w.mission,
    solids: [
      { id: 'left', kind: 'wall', x: 0, y: 0, w: 9.5, h: 26, height: 2 },
      { id: 'right', kind: 'wall', x: 10.5, y: 0, w: 21.5, h: 26, height: 2 },
    ],
  };
  w.agents.forEach((a, i) => Object.assign(a, { x: 10, y: 12 + i }));
  moveAgents(
    w,
    w.agents.map((a) => a.id),
    { x: 10, y: 8 },
  );
  const ends = w.agents.map((a) => a.path.at(-1)!);
  expect(ends.every((p) => canWalk(w, { x: 10, y: 8 }, p))).toBe(true);
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++)
      expect(distance(ends[i], ends[j])).toBeGreaterThan(0.39);
});

it('assigns CUT to a selected free-handed operative and keeps that worker on repeated clicks', () => {
  const w = createWorld(custody),
    [carrier, worker] = w.agents,
    cut = landmark(w, 'breach');
  Object.assign(carrier, { x: cut.x, y: cut.y, carrying: true });
  Object.assign(worker, { x: cut.x, y: cut.y + 1 });
  expect(passable(w, worker)).toBe(true);
  const prior = carrier.order;
  interact(w, [carrier.id, worker.id], 'breach');
  expect(worker.order).toEqual({ kind: 'interact', target: 'breach' });
  expect(carrier.order).toBe(prior);
  worker.interaction = 2;
  carrier.carrying = false;
  interact(w, [carrier.id, worker.id], 'breach');
  expect(worker.interaction).toBe(2);
  expect(carrier.order).toBe(prior);
});

it('uses the selected disguise for WARRANT and reports missing prerequisites without cancelling orders', () => {
  const w = createWorld(custody),
    [uncovered, covered] = w.agents,
    warrant = landmark(w, 'release');
  Object.assign(uncovered, { x: warrant.x, y: warrant.y });
  Object.assign(covered, { x: warrant.x, y: warrant.y + 2, disguised: true });
  interact(w, [uncovered.id, covered.id], 'release');
  expect(covered.order).toEqual({ kind: 'interact', target: 'release' });
  expect(uncovered.order).toEqual({ kind: 'hold' });
  moveAgents(w, [uncovered.id], { x: 14, y: 8 });
  const order = uncovered.order,
    path = uncovered.path;
  interact(w, [uncovered.id], 'release');
  expect(w.message).toContain('Release refused');
  expect(uncovered.order).toBe(order);
  expect(uncovered.path).toBe(path);
});

it('skips an enclosed operative and does not cancel orders when no selected person can reach the item', () => {
  const w = createWorld(),
    [trapped, outside] = w.agents;
  w.mission = {
    ...w.mission,
    landmarks: w.mission.landmarks.map((o) => (o.id === 'relay' ? { ...o, x: 20, y: 10 } : o)),
    solids: [
      { id: 'north', kind: 'wall', x: 17, y: 9, w: 2, h: 0.3, height: 2 },
      { id: 'south', kind: 'wall', x: 17, y: 11, w: 2, h: 0.3, height: 2 },
      { id: 'west', kind: 'wall', x: 17, y: 9, w: 0.3, h: 2, height: 2 },
      { id: 'east', kind: 'wall', x: 19, y: 9, w: 0.3, h: 2.3, height: 2 },
    ],
  };
  Object.assign(trapped, { x: 18, y: 10 });
  Object.assign(outside, { x: 15, y: 10 });
  interact(w, [trapped.id, outside.id], 'relay');
  expect(outside.order).toEqual({ kind: 'interact', target: 'relay' });
  expect(trapped.order).toEqual({ kind: 'hold' });
  interact(w, [trapped.id], 'relay');
  expect(w.message).toBe('No selected operative can reach RADIO.');
  expect(trapped.order).toEqual({ kind: 'hold' });
});
