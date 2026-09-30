import { expect, it } from 'vitest';
import { Aftermath } from '../src/render/aftermath';
import { missions } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import { people, living } from '../src/sim/types';
import { earnedMedals } from '../src/ui/medals';
import { vanDeparture } from '../src/render/van';

const exits = missions.flatMap((m) =>
  m.landmarks
    .filter((o) => o.id === 'extract' || o.id === 'alternate')
    .map((exit) => ({ mission: m, exit, name: `${m.id}/${exit.id}` })),
);

it.each(exits)(
  'boards survivors at the correct van and leaves $name without changing the result',
  ({ mission, exit }) => {
    const w = createWorld(mission);
    w.status = 'won';
    w.extractedAt = exit.id as 'extract' | 'alternate';
    w.time = 100;
    w.evidence = 'extracted';
    for (const p of [...w.agents, ...(w.escort ? [w.escort] : [])])
      Object.assign(p, { x: exit.x, y: exit.y, floor: exit.floor, captive: false });
    const original = structuredClone(w),
      medals = earnedMedals(w),
      ending = new Aftermath(w);
    expect(ending.resultsReady).toBe(false);
    for (let i = 0; i < 49; i++) {
      if (ending.phase !== 'departed') expect(ending.resultsReady).toBe(false);
      ending.update(0.1);
    }
    expect(ending.boarded.size).toBe(w.agents.length + (w.escort ? 1 : 0));
    expect(ending.phase).not.toBe('boarding');
    for (let i = 0; i < 200; i++) ending.update(0.1);
    expect(ending.phase).toBe('departed');
    expect(ending.resultsReady).toBe(true);
    const heading = vanDeparture(ending.van!, mission);
    expect(Math.sign(ending.offset[heading.axis])).toBe(heading.direction);
    expect(Math.hypot(ending.offset.x, ending.offset.y)).toBeGreaterThan(5);
    expect(w).toEqual(original);
    expect(earnedMedals(w)).toEqual(medals);
  },
);

it('keeps surviving guards moving after a defeat while bodies and the scored world stay fixed', () => {
  const w = createWorld();
  w.status = 'lost';
  w.agents.forEach((a) => {
    a.hp = 0;
  });
  w.traces.push({ from: w.guards[0], to: w.agents[0], hostile: true, life: 0.2 });
  const original = structuredClone(w),
    ending = new Aftermath(w);
  for (let i = 0; i < 29; i++) ending.update(0.1);
  expect(ending.resultsReady).toBe(false);
  for (let i = 29; i < 60; i++) ending.update(0.1);
  expect(ending.resultsReady).toBe(true);
  expect(ending.world.guards.some((g, i) => g.x !== w.guards[i].x || g.y !== w.guards[i].y)).toBe(
    true,
  );
  expect(ending.world.traces).toEqual([]);
  expect(ending.phase).toBe('failed');
  expect(ending.boarded.size).toBe(0);
  expect(ending.van).toBeUndefined();
  expect(
    people(ending.world)
      .filter((p) => !living(p))
      .map((p) => [p.x, p.y, p.hp]),
  ).toEqual(
    people(w)
      .filter((p) => !living(p))
      .map((p) => [p.x, p.y, p.hp]),
  );
  expect(w).toEqual(original);
});
