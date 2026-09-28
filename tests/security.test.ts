import { describe, expect, it } from 'vitest';
import { mandate } from '../src/content/mandate';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import { completeInteraction, interact } from '../src/sim/orders';
import { STEP, step } from '../src/sim/step';
import { activeTurrets, inspectionRemaining, TURRET_LOCK, updateTurret } from '../src/sim/security';
import { missionGoals } from '../src/ui/objectives';

function arena() {
  const w = createWorld({ ...mandate, solids: [], guards: [] });
  w.gateOpen = true;
  w.relayOff = true;
  const g = w.guards[0],
    a = w.agents[0];
  w.guards = [g];
  g.armament!.settle = 0;
  w.agents = [a];
  Object.assign(a, { x: 19, y: 27, previous: { x: 19, y: 27 }, disguised: true });
  return { w, g, a };
}

describe('wired sentries and corporate inspection', () => {
  it('tracks armed intruders despite RADIO being disabled, warns before shooting, and never pursues', () => {
    const { w, g, a } = arena();
    a.weapon = true;
    for (let i = 0; i < 18; i++) updateTurret(w, g, STEP);
    expect(g.turret!.lock).toBeCloseTo(0.6);
    expect(a.hp).toBe(100);
    expect(g.mode).toBe('challenge');
    updateTurret(w, g, TURRET_LOCK);
    expect(a.hp).toBe(74);
    expect(w.alarm).toBe(false);
    expect(g.radio).toBe(0);
    expect(g.path).toEqual([]);
    expect([g.x, g.y]).toEqual([23, 27]);
  });

  it('breaks tracking at solid cover and requires a fresh lock after target loss', () => {
    const { w, g, a } = arena();
    a.weapon = true;
    updateTurret(w, g, 0.6);
    w.mission.solids = [{ id: 'cover', x: 21, y: 25, w: 0.5, h: 4, height: 1.6, kind: 'wall' }];
    updateTurret(w, g, STEP);
    expect(g.turret!.lock).toBe(0);
    expect(g.target).toBeNull();
    w.mission.solids = [];
    updateTurret(w, g, 0.3);
    expect(g.turret!.lock).toBeCloseTo(0.3);
    expect(a.hp).toBe(100);
    a.x = 5;
    updateTurret(w, g, STEP);
    expect(g.path).toEqual([]);
    expect(g.turret!.lock).toBe(0);
  });

  it('allows a concealed technician, but detects cargo and the secure records room', () => {
    const { w, g, a } = arena();
    // A human guard's identification is not a sighting by an independent optical device.
    a.exposed = true;
    w.known = [a.id];
    updateTurret(w, g, 2);
    expect(g.target).toBeNull();
    a.carrying = true;
    updateTurret(w, g, 0.2);
    expect(g.target).toBe(a.id);
    a.carrying = false;
    w.mission.secure = { x: 18, y: 26, w: 2, h: 2 };
    updateTurret(w, g, 0.2);
    expect(g.target).toBe(a.id);
  });

  it('requires valid authority at assignment and completion, with a single simulation-time window', () => {
    const w = createWorld(mandate),
      a = w.agents[0];
    applyCommand(w, { kind: 'move', agents: [a.id], point: { x: 6, y: 33 } });
    const order = structuredClone(a.order);
    interact(w, [a.id], 'authorise');
    expect(a.order).toEqual(order);
    expect(w.message).toContain('unexposed');
    a.disguised = true;
    interact(w, [a.id], 'authorise');
    expect(a.order).toEqual({ kind: 'interact', target: 'authorise' });
    a.exposed = true;
    completeInteraction(w, a, 'authorise');
    expect(w.security!.inspectionUsed).toBe(false);
    a.exposed = false;
    completeInteraction(w, a, 'authorise');
    expect(activeTurrets(w)).toHaveLength(0);
    const deadline = w.security!.inspectionUntil;
    step(w, 0);
    expect(w.security!.inspectionUntil).toBe(deadline);
    w.time = deadline - 0.1;
    completeInteraction(w, a, 'authorise');
    expect(w.security!.inspectionUntil).toBe(deadline);
    step(w, 0.2);
    expect(inspectionRemaining(w)).toBe(0);
    expect(activeTurrets(w)).toHaveLength(4);
    expect(w.message).toContain('live again');
    expect(missionGoals(w)[0].targets).not.toContain('authorise');
  });

  it('isolates only the named circuit, survives inspection expiry, and remains usable after cover is blown', () => {
    const w = createWorld(mandate),
      a = w.agents[0];
    a.exposed = true;
    completeInteraction(w, a, 'power-west');
    expect(activeTurrets(w).map((g) => g.turret!.circuit)).toEqual(['power-east', 'power-east']);
    w.guards.find((g) => g.turret?.circuit === 'power-east')!.hp = 0;
    w.security!.inspectionUsed = true;
    w.security!.inspectionUntil = w.time + 0.1;
    step(w, 0.2);
    expect(activeTurrets(w)).toHaveLength(1);
    completeInteraction(w, a, 'power-east');
    expect(activeTurrets(w)).toHaveLength(0);
    expect(missionGoals(w)[0].complete).toBe(true);
    expect(w.status).toBe('playing'); // Disabling security is not the contract.
  });
});
