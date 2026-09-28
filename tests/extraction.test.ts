import { describe, expect, it } from 'vitest';
import { missions } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import { extractionStatus, hold, interact, landmark } from '../src/sim/orders';
import { STEP, step } from '../src/sim/step';
import { distance, isExtraction } from '../src/sim/types';
import type { World } from '../src/sim/types';

function advance(w: World, seconds: number) {
  for (let i = 0; i < seconds / STEP; i++) step(w);
}

const exits = missions.flatMap((mission) =>
  mission.landmarks.filter((o) => isExtraction(o.id)).map((exit) => ({ mission, exit })),
);

describe('extraction orders', () => {
  it('reports missing crew by name and readiness when everyone and the ledger are in the ring', () => {
    const w = createWorld(missions.find((m) => m.id === 'archive')!);
    const van = landmark(w, 'extract');
    for (const a of w.agents) Object.assign(a, { x: van.x, y: van.y });
    expect(extractionStatus(w, 'extract').ready).toBe(false);
    w.agents[0].carrying = true;
    w.evidence = 'carried';
    w.agents[1].y -= 5;
    expect(extractionStatus(w, 'extract')).toMatchObject({ present: 3, total: 4, ready: false });
    expect(extractionStatus(w, 'extract').waiting).toContain('Vale');
    w.agents[1].y += 2;
    expect(extractionStatus(w, 'extract')).toMatchObject({ present: 4, total: 4, ready: true });
    expect(w.status).toBe('playing'); // Readiness preserves the choice to leave optional work.
    interact(
      w,
      w.agents.map((a) => a.id),
      'extract',
    );
    advance(w, 1);
    expect(w.status).toBe('won');
  });
  it.each(exits)(
    'rallies the selected crew and objective to $mission.id / $exit.tag with one order',
    ({ mission, exit }) => {
      const w = createWorld(mission);
      // Isolate the return order from combat; full mission routes test live opposition.
      w.guards = [];
      for (const [i, a] of w.agents.entries()) Object.assign(a, { x: 6.5, y: 15 + i });
      if (w.detention) {
        w.agents.forEach((a) => {
          a.captive = false;
        });
        w.detention.released = true;
      } else if (w.escort) {
        w.escortLocked = false;
        Object.assign(w.escort, { x: 6.5, y: 14, recruited: true, leader: w.agents[3].id });
      } else if (w.demolition) {
        w.demolition.armed = ['charge-west', 'charge-east'];
        w.demolition.detonatedAt = 0;
      } else if (w.broadcast) {
        w.broadcast.progress = mission.broadcast!.duration;
      } else {
        w.agents[3].carrying = true;
        w.evidence = 'carried';
      }
      interact(
        w,
        w.agents.map((a) => a.id),
        exit.id,
      );
      advance(w, 40);
      expect(w.status, w.message).toBe('won');
      expect(w.extractedAt).toBe(exit.id);
      expect(w.agents.every((a) => distance(a, exit) <= 4)).toBe(true);
      if (w.escort) expect(distance(w.escort, exit)).toBeLessThanOrEqual(4);
      else if (!w.broadcast && !w.demolition && !w.detention) expect(w.evidence).toBe('extracted');
    },
  );

  it('keeps unselected operatives in place and waits for the witness without another click', () => {
    const w = createWorld();
    w.guards = [];
    const van = landmark(w, 'extract');
    Object.assign(w.escort!, {
      x: 6.5,
      y: 15,
      recruited: true,
      leader: w.agents[0].id,
      waiting: true,
    });
    Object.assign(w.agents[3], { x: 6.5, y: 16 });
    interact(w, [w.agents[0].id], 'extract');
    advance(w, 3);
    expect(w.status).toBe('playing');
    expect(w.agents[3]).toMatchObject({ x: 6.5, y: 16, order: { kind: 'hold' } });
    expect(w.message).toContain('ask them to follow');
    w.escort!.waiting = false;
    interact(w, [w.agents[3].id], 'extract');
    advance(w, 10);
    expect(w.status, w.message).toBe('won');
    expect(distance(w.escort!, van)).toBeLessThanOrEqual(4);
  });

  it('allows Hold to cancel a requested extraction', () => {
    const w = createWorld();
    Object.assign(w.escort!, { x: 6.5, y: 16, recruited: true, leader: w.agents[0].id });
    const ids = w.agents.map((a) => a.id);
    interact(w, ids, 'extract');
    advance(w, 1);
    hold(w, ids);
    advance(w, 10);
    expect(w.status).toBe('playing');
    expect(distance(w.escort!, landmark(w, 'extract'))).toBeLessThan(4);
  });

  it('keeps an early request active while a teammate collects the required cargo', () => {
    const w = createWorld(missions.find((m) => m.id === 'archive')!);
    w.guards = [];
    const van = landmark(w, 'extract');
    for (const a of w.agents) Object.assign(a, { x: van.x, y: van.y });
    w.evidencePosition = { x: van.x, y: van.y - 2 };
    interact(w, [w.agents[0].id], 'extract');
    advance(w, 2);
    expect(w.status).toBe('playing');
    expect(w.message).toContain('Bring the debt ledger');
    interact(w, [w.agents[1].id], 'evidence');
    advance(w, 3);
    expect(w.status, w.message).toBe('won');
    expect(w.evidence).toBe('extracted');
  });

  it('does not restart boarding when VAN is clicked repeatedly', () => {
    const w = createWorld();
    const van = landmark(w, 'extract');
    Object.assign(w.escort!, { x: van.x, y: van.y, recruited: true, leader: w.agents[0].id });
    const ids = w.agents.map((a) => a.id);
    for (let i = 0; i < 30 && w.status === 'playing'; i++) {
      interact(w, ids, 'extract');
      step(w);
    }
    expect(w.status).toBe('won');
  });

  it('ends immediately without letting guards fire after a successful extraction', () => {
    const w = createWorld();
    const van = landmark(w, 'extract');
    Object.assign(w.escort!, { x: van.x, y: van.y, recruited: true, leader: w.agents[0].id });
    for (const a of w.agents) Object.assign(a, { x: van.x, y: van.y, hp: 1 });
    const guard = w.guards[0];
    Object.assign(guard, { x: van.x + 2, y: van.y, mode: 'combat', target: w.agents[0].id });
    guard.known.push(w.agents[0].id);
    interact(w, [w.agents[0].id], 'extract');
    w.agents[0].interaction = 0.65;
    step(w);
    expect(w.status).toBe('won');
    expect(w.agents.every((a) => a.hp === 1)).toBe(true);
    expect(w.shots).toBe(0);
  });
});
