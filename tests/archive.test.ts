import { describe, expect, it } from 'vitest';
import { archive } from '../src/content/archive';
import { createWorld } from '../src/sim/world';
import {
  available,
  completeInteraction,
  dropEvidence,
  heal,
  hold,
  interact,
  moveAgents,
  toggleWeapons,
} from '../src/sim/orders';
import { canWalk, findPath, passable } from '../src/sim/navigation';
import { suspicionRate } from '../src/sim/awareness';
import { updateShutter } from '../src/sim/shutter';
import { STEP, step } from '../src/sim/step';
import { distance, living } from '../src/sim/types';
import type { World } from '../src/sim/types';

function advance(w: World, seconds: number) {
  for (let i = 0; i < seconds / STEP; i++) step(w);
}
function until(w: World, predicate: () => boolean, limit = 45) {
  for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) step(w);
  expect(predicate(), w.message).toBe(true);
}
function activate(w: World, index = 1) {
  const a = w.agents[index];
  const panel = archive.landmarks.find((o) => o.id === 'override')!;
  Object.assign(a, { x: panel.x, y: panel.y });
  completeInteraction(w, a, 'override');
  return a;
}

describe('Material breach', () => {
  it('seals the archive until an operative holds the override, then releases on a new order', () => {
    const w = createWorld(archive),
      end = w.evidencePosition;
    expect(w.engineer).toBeNull();
    expect(findPath(w, w.agents[0], end)).toEqual([]);
    const operator = activate(w);
    expect(w.shutterOpen).toBe(true);
    expect(findPath(w, w.agents[0], end).length).toBeGreaterThan(0);
    moveAgents(w, [w.agents[0].id], { x: 6, y: 19 });
    advance(w, 1);
    expect(w.overrideBy).toBe(operator.id);
    hold(w, [operator.id]);
    step(w);
    expect(w.shutterOpen).toBe(false);
    expect(findPath(w, w.agents[0], end)).toEqual([]);
  });
  it('holds the shutter for a crossing body and closes after the doorway clears', () => {
    const w = createWorld(archive),
      a = w.agents[0],
      operator = activate(w);
    Object.assign(a, { x: 26, y: 12.2 });
    hold(w, [operator.id]);
    updateShutter(w);
    expect(w.shutterOpen).toBe(true);
    expect(passable(w, a)).toBe(true);
    Object.assign(a, { x: 26, y: 11.5 });
    updateShutter(w);
    expect(w.shutterOpen).toBe(false);
    expect(canWalk(w, a, { x: 26, y: 13.5 })).toBe(false);
    // The inside of the lock remains reachable, so an abandoned infiltrator can cut out.
    interact(w, [a.id], 'breach');
    w.guards = [];
    advance(w, 9);
    expect(w.shutterBreached).toBe(true);
  });
  it('releases a fallen operator and supports a clean handoff without competing orders', () => {
    const w = createWorld(archive),
      first = activate(w),
      second = activate(w, 2);
    expect(first.order.kind).toBe('hold');
    step(w);
    expect(w.overrideBy).toBe(second.id);
    second.hp = 0;
    step(w);
    expect(w.overrideBy).toBeNull();
    expect(w.shutterOpen).toBe(false);
  });
  it('makes cutting a timed, noisy alternative even with the radio disabled', () => {
    const w = createWorld(archive),
      a = w.agents[0];
    Object.assign(a, { x: 26.1, y: 13.55 });
    a.disguised = true;
    w.relayOff = true;
    interact(w, [a.id], 'breach');
    advance(w, 7);
    expect(w.shutterOpen).toBe(false);
    advance(w, 1.2);
    expect(w.shutterBreached).toBe(true);
    expect(w.guards.some((g) => g.mode === 'combat')).toBe(true);
    expect(w.alarm).toBe(false);
    expect(available(w, 'override')).toBe(false);
  });
  it('requires the ledger, makes it conspicuous, and allows recovery from a fallen carrier', () => {
    const w = createWorld(archive),
      a = w.agents[0];
    for (const p of w.agents) Object.assign(p, { x: 31, y: 24.2 });
    completeInteraction(w, a, 'extract');
    expect(w.status).toBe('playing');
    a.disguised = true;
    completeInteraction(w, a, 'evidence');
    expect(suspicionRate(w, a)).toBeGreaterThan(0);
    interact(w, [a.id], 'override');
    expect(a.order.kind).toBe('hold');
    a.hp = 0;
    step(w);
    expect(w.evidence).toBe('available');
    expect(w.evidencePosition.x).toBe(a.x);
    interact(w, [w.agents[1].id], 'evidence');
    until(w, () => w.evidence === 'carried');
    dropEvidence(w, [w.agents[1].id]);
    completeInteraction(w, w.agents[1], 'extract');
    expect(w.status).toBe('playing');
    interact(w, [w.agents[2].id], 'evidence');
    until(w, () => w.agents[2].carrying);
    interact(w, [w.agents[1].id], 'extract');
    until(w, () => w.status === 'won');
  });
  it('can extract quietly with a held shunt and a timed exit past live patrols', () => {
    const w = createWorld(archive),
      a = w.agents[0],
      operator = w.agents[1];
    interact(w, [operator.id], 'override');
    interact(w, [a.id], 'disguise');
    moveAgents(
      w,
      w.agents.slice(2).map((a) => a.id),
      { x: 31, y: 24.2 },
    );
    until(w, () => a.disguised);
    interact(w, [a.id], 'relay');
    until(w, () => w.relayOff);
    interact(w, [a.id], 'gate');
    until(w, () => w.gateOpen);
    interact(w, [a.id], 'evidence');
    until(w, () => a.carrying);
    // Stay behind the archive shelves until the road patrol turns away.
    advance(w, 1.5);
    moveAgents(w, [a.id], { x: 28.7, y: 15.7 });
    until(w, () => !a.path.length);
    moveAgents(w, [operator.id], { x: 5.5, y: 22.5 });
    moveAgents(w, [a.id], { x: 31, y: 24.2 });
    until(w, () => !operator.path.length);
    moveAgents(w, [operator.id], { x: 31, y: 24.2 });
    until(w, () => w.agents.every((p) => distance(p, { x: 30.7, y: 24.8 }) < 3.5));
    interact(w, [a.id], 'extract');
    until(w, () => w.status === 'won');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.agents.every((p) => p.hp === 100)).toBe(true);
    expect(w.shutterBreached).toBe(false);
  });
  it('supports a squad assault, a forced shutter, and withdrawal with the ledger', () => {
    const w = createWorld(archive),
      ids = w.agents.map((a) => a.id);
    toggleWeapons(w, ids);
    for (const p of [
      { x: 10, y: 12 },
      { x: 17, y: 12.8 },
      { x: 26, y: 14 },
    ]) {
      moveAgents(w, ids, p);
      until(w, () => w.agents.filter(living).every((a) => !a.path.length));
      advance(w, 4);
      heal(w, ids);
    }
    interact(w, ids, 'breach');
    until(w, () => w.shutterBreached);
    interact(w, ids, 'evidence');
    until(w, () => w.evidence === 'carried');
    interact(w, ids, 'gate');
    until(w, () => w.gateOpen);
    moveAgents(w, ids, { x: 31, y: 24.2 });
    until(w, () => w.agents.filter(living).every((a) => distance(a, { x: 30.7, y: 24.8 }) < 3.5));
    interact(w, ids, 'extract');
    until(w, () => w.status === 'won');
    expect(w.alarm).toBe(true);
    expect(w.shots).toBeGreaterThan(0);
    expect(w.evidence).toBe('extracted');
    expect(w.agents.filter(living)).toHaveLength(4);
  });
});
