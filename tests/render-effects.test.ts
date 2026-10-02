import { expect, it } from 'vitest';
import { archive } from '../src/content/archive';
import { custody } from '../src/content/custody';
import { bench } from '../src/content/bench';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import { interactionPoint, landmark } from '../src/sim/orders';
import { step } from '../src/sim/step';
import { position } from '../src/sim/types';
import { stateHash } from '../src/replay/core';
import { Falls, FALL_SECONDS } from '../src/render/fall';
import { cuttingSite } from '../src/render/cutting';

it('continues falls across off-screen updates, freezes with time, and leaves simulation state untouched', () => {
  const w = createWorld(),
    a = w.agents[0],
    falls = new Falls();
  a.angle = 0.7;
  falls.update(w.agents, 1, 10);
  a.hp = 0;
  const hash = stateHash(w);
  falls.update(w.agents, 1, 10.1);
  expect(falls.pose(a.id)?.progress).toBe(0);
  falls.update(w.agents, 1, 10.1 + FALL_SECONDS / 2);
  const halfway = falls.pose(a.id);
  expect(halfway?.progress).toBeCloseTo(0.5);
  falls.update(w.agents, 1, 10.1 + FALL_SECONDS / 2);
  expect(falls.pose(a.id)).toEqual(halfway);
  // The scene observes every actor even while its mesh is culled.
  falls.update(w.agents, 1, 12);
  expect(falls.pose(a.id)).toEqual({ progress: 1, stride: null, angle: 0.7 });
  expect(stateHash(w)).toBe(hash);
});

it('does not replay an old death after seeking, and forgets casualties on a mission reset', () => {
  const w = createWorld(),
    a = w.agents[0],
    falls = new Falls();
  a.hp = 0;
  falls.update(w.agents, 1, 20);
  expect(falls.pose(a.id)?.progress).toBe(1);
  falls.update(w.agents, 1, 2);
  expect(falls.pose(a.id)?.progress).toBe(1);
  a.hp = 100;
  falls.update(w.agents, 1, 3);
  expect(falls.pose(a.id)).toBeUndefined();
  a.hp = 0;
  falls.update(w.agents, 1, 4);
  expect(falls.pose(a.id)?.progress).toBe(0);
  falls.clear();
  expect(falls.pose(a.id)).toBeUndefined();
});

it('falls in the rendered work direction instead of snapping back to the approach direction', () => {
  const w = createWorld(),
    a = w.agents[0],
    falls = new Falls();
  a.angle = 0;
  falls.update(w.agents, 1, 1, () => Math.PI / 2);
  a.hp = 0;
  falls.update(w.agents, 1, 1.1);
  expect(falls.pose(a.id)?.angle).toBe(Math.PI / 2);
});

it.each([archive, custody, bench])(
  'shows CUT work only at a reached lock in $title, stopping on interruptions',
  (mission) => {
    const w = createWorld(mission),
      a = w.agents[0];
    w.guards = [];
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'breach' });
    expect(cuttingSite(w, a)).toBeNull(); // Walking toward CUT is not cutting.
    Object.assign(a, position(landmark(w, 'breach')));
    a.previous = position(a);
    a.path = [];
    step(w);
    expect(a.interaction).toBeGreaterThan(0);
    const hash = stateHash(w);
    const site = cuttingSite(w, a)!;
    expect(site).not.toBeNull();
    expect(site.surface).toBe(
      mission.finale?.door ??
        mission.archive?.door ??
        mission.solids.find((s) => s.kind === 'transport'),
    );
    expect(site.point).not.toEqual(position(a)); // Sparks originate on the actual door/transport.
    expect(stateHash(w)).toBe(hash);
    a.disoriented = 1;
    expect(cuttingSite(w, a)).toBeNull();
    a.disoriented = 0;
    expect(cuttingSite(w, a)).not.toBeNull();
    applyCommand(w, { kind: 'hold', agents: [a.id] });
    expect(cuttingSite(w, a)).toBeNull();
  },
);

it('puts sparks on the opposite shutter face when CUT is worked from inside', () => {
  const w = createWorld(archive),
    a = w.agents[0];
  w.guards = [];
  Object.assign(a, position(w.mission.archive!.inside));
  applyCommand(w, { kind: 'interact', agents: [a.id], target: 'breach' });
  a.path = [];
  expect(interactionPoint(w, a, 'breach')).toEqual(w.mission.archive!.inside);
  step(w);
  const site = cuttingSite(w, a)!;
  expect(site).not.toBeNull();
  expect(site.point.y).toBeLessThan(w.mission.archive!.door.y);
});

it('keeps the reported Bench CUT attached to the far side of the actual door', () => {
  const w = createWorld(bench),
    a = w.agents[0];
  w.guards = [];
  // The human approach stops within interaction range, west of the shutter.
  Object.assign(a, { x: 29.90627649183188, y: 14.337502108033188 });
  applyCommand(w, { kind: 'interact', agents: [a.id], target: 'breach' });
  step(w);
  const site = cuttingSite(w, a)!;
  expect(site.surface).toBe(bench.finale!.door);
  expect(site.point.x).toBeLessThan(site.surface.x);
  expect(site.point.y).toBeGreaterThan(site.surface.y);
  expect(site.point.y).toBeLessThan(site.surface.y + site.surface.h);
});
