import { describe, expect, it } from 'vitest';
import { archive } from '../src/content/archive';
import { custody } from '../src/content/custody';
import { mandate } from '../src/content/mandate';
import { personnel } from '../src/content/personnel';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import { completeInteraction, landmark } from '../src/sim/orders';
import { objectRequirement } from '../src/ui/interactions';
import type { ObjectKind, Operative, World } from '../src/sim/types';

const place = (w: World, a: Operative, id: ObjectKind) => {
  const p = landmark(w, id);
  a.x = p.x;
  a.y = p.y;
};

describe('mission marker prerequisites', () => {
  it('keeps EXIT locked after the first rescue and preserves orders on a refused click', () => {
    const w = createWorld(personnel),
      a = w.agents[0];
    const order = { kind: 'move' as const, target: { x: 31, y: 27 } };
    a.order = order;
    expect(objectRequirement(w, 'escape-release', [a.id])).toContain('Free Vale and Rook first');
    // The b6202c06 human run tries EXIT five times after Rook, before Vale.
    w.agents[2].captive = false;
    expect(objectRequirement(w, 'escape-release', [a.id])).toContain('Free Vale first');
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'escape-release' });
    expect(a.order).toEqual(order);
    expect(w.detention!.released).toBe(false);
    w.agents[1].captive = false;
    expect(objectRequirement(w, 'escape-release', [a.id])).toBeNull();
    expect(objectRequirement(w, 'extract', [a.id])).not.toBeNull();
    place(w, a, 'escape-release');
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'escape-release' });
    expect(a.order).toEqual({ kind: 'interact', target: 'escape-release' });
    completeInteraction(w, a, 'escape-release');
    expect(objectRequirement(w, 'extract', [a.id])).toBeNull();
  });

  it('requires a different live CELLS operator without mutating the held circuit while rendering', () => {
    const w = createWorld(personnel),
      [a, , , operator] = w.agents;
    expect(objectRequirement(w, 'rescue-vale', [a.id])).toContain('holding CELLS');
    place(w, operator, 'access-cells');
    completeInteraction(w, operator, 'access-cells');
    expect(objectRequirement(w, 'rescue-vale', [a.id])).toBeNull();
    expect(objectRequirement(w, 'rescue-vale', [operator.id])).toContain('different operative');
    expect(objectRequirement(w, 'rescue-vale', [operator.id, a.id])).toBeNull();
    operator.order = { kind: 'hold' };
    const before = structuredClone(w);
    expect(objectRequirement(w, 'rescue-vale', [a.id])).toContain('holding CELLS');
    expect(w).toEqual(before);
  });

  it('updates KIT and GEAR for the selected team, including a freed prisoner', () => {
    const w = createWorld(personnel);
    expect(objectRequirement(w, 'disguise', ['agent-3'])).toContain('Long guns');
    expect(objectRequirement(w, 'disguise', ['agent-3', 'agent-0'])).toBeNull();
    expect(objectRequirement(w, 'equipment', ['agent-0', 'agent-3'])).toContain('Select a freed');
    w.agents[1].captive = false;
    expect(objectRequirement(w, 'equipment', ['agent-1'])).toBeNull();
    place(w, w.agents[1], 'equipment');
    applyCommand(w, { kind: 'interact', agents: ['agent-1'], target: 'equipment' });
    expect(w.agents[1].order).toEqual({ kind: 'interact', target: 'equipment' });
    completeInteraction(w, w.agents[1], 'equipment');
    expect(objectRequirement(w, 'equipment', ['agent-1'])).toContain('Select a freed');
  });

  it.each([
    { mission: custody, target: 'release' as const },
    { mission: mandate, target: 'authorise' as const },
  ])('agrees with identity-gated commands in $mission.id', ({ mission, target }) => {
    const w = createWorld(mission),
      a = w.agents[0];
    place(w, a, target);
    expect(objectRequirement(w, target, [a.id])).not.toBeNull();
    applyCommand(w, { kind: 'interact', agents: [a.id], target });
    expect(a.order.kind).toBe('hold');
    completeInteraction(w, a, 'disguise');
    expect(objectRequirement(w, target, [a.id])).toBeNull();
    applyCommand(w, { kind: 'interact', agents: [a.id], target });
    expect(a.order).toEqual({ kind: 'interact', target });
    a.exposed = true;
    expect(objectRequirement(w, target, [a.id])).not.toBeNull();
  });

  it('only marks the archive cargo locked when the selected crew still needs its shutter', () => {
    const w = createWorld(archive),
      a = w.agents[0];
    expect(objectRequirement(w, 'evidence', [a.id])).toContain('holding SHUNT');
    place(w, a, 'evidence');
    expect(objectRequirement(w, 'evidence', [a.id])).toBeNull();
    a.x = 5;
    a.y = 5;
    w.evidencePosition = { x: 6, y: 15 };
    expect(objectRequirement(w, 'evidence', [a.id])).toBeNull();
    // Distant usable objects remain actionable: an order walks to them.
    expect(objectRequirement(w, 'relay', [a.id])).toBeNull();
  });
});
