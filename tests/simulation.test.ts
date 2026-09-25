import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/world';
import { STEP, step } from '../src/sim/step';
import { findPath, lineClear, passable } from '../src/sim/navigation';
import {
  attack,
  completeInteraction,
  interact,
  moveAgents,
  toggleWeapons,
} from '../src/sim/orders';
import { raiseAlarm, sees, suspicionRate, updateAwareness } from '../src/sim/awareness';
import type { World } from '../src/sim/types';
import { distance, living } from '../src/sim/types';

function advance(w: World, seconds: number) {
  for (let i = 0; i < seconds / STEP; i++) step(w);
}
function until(w: World, predicate: () => boolean, limit = 30) {
  for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) step(w);
  expect(predicate()).toBe(true);
}
describe('navigation and orders', () => {
  it('routes from the street through the west doorway without cutting walls or trams', () => {
    const w = createWorld(),
      a = w.agents[0],
      end = { x: 26.4, y: 6.4 };
    const path = findPath(w, a, end);
    expect(path.length).toBeGreaterThan(1);
    let p = { x: a.x, y: a.y };
    for (const q of path) {
      expect(passable(w, q)).toBe(true);
      expect(lineClear(w, p, q, 0.2)).toBe(true);
      p = q;
    }
    expect(distance(p, end)).toBeLessThan(0.1);
  });
  it('keeps other operatives orders while issuing an individual order', () => {
    const w = createWorld();
    moveAgents(
      w,
      w.agents.map((a) => a.id),
      { x: 7, y: 16 },
    );
    const old = structuredClone(w.agents[1].order);
    interact(w, [w.agents[0].id], 'disguise');
    expect(w.agents[1].order).toEqual(old);
    advance(w, 1);
    expect(w.agents[1].y).toBeLessThan(21.8);
  });
  it('opens a route through the loading gate only after it has been opened', () => {
    const w = createWorld(),
      a = { x: 23, y: 21.5 },
      b = { x: 23, y: 18 };
    expect(lineClear(w, a, b)).toBe(false);
    w.gateOpen = true;
    expect(lineClear(w, a, b)).toBe(true);
  });
});
describe('social stealth', () => {
  it('grants maintenance access but not weapons or secure office access', () => {
    const w = createWorld(),
      a = w.agents[0];
    a.x = 11;
    a.y = 12;
    expect(suspicionRate(w, a)).toBeGreaterThan(0);
    a.disguised = true;
    expect(suspicionRate(w, a)).toBe(0);
    a.x = 26;
    a.y = 6;
    expect(suspicionRate(w, a)).toBeGreaterThan(0);
    a.x = 11;
    a.y = 12;
    a.weapon = true;
    expect(suspicionRate(w, a)).toBeGreaterThan(80);
  });
  it('blocks vision through the wall and through a tram', () => {
    const w = createWorld(),
      g = w.guards[0],
      a = w.agents[0];
    g.x = 11;
    g.y = 10;
    g.angle = Math.PI;
    a.x = 8;
    a.y = 10;
    expect(sees(w, g, a)).toBe(false);
    g.x = 12;
    g.y = 12;
    g.angle = 0;
    a.x = 17;
    a.y = 12;
    expect(sees(w, g, a)).toBe(false);
  });
  it('does not broadcast a local identification before a radio call completes', () => {
    const w = createWorld(),
      a = w.agents[0],
      g = w.guards[0];
    a.disguised = true;
    a.exposed = true;
    g.known.push(a.id);
    a.x = 11;
    a.y = 12;
    expect(suspicionRate(w, a)).toBe(0);
    expect(w.known).toEqual([]);
    g.radio = 0.3;
    updateAwareness(w, 0.1);
    expect(w.alarm).toBe(false);
    updateAwareness(w, 0.3);
    expect(w.alarm).toBe(true);
    expect(w.known).toContain(a.id);
  });
  it('blocks reinforcement calls when the relay is disabled', () => {
    const w = createWorld();
    w.relayOff = true;
    raiseAlarm(w, ['agent-0']);
    advance(w, 50);
    expect(w.alarm).toBe(false);
    expect(w.guards).toHaveLength(5);
  });
  it('allows only one operative to collect the disguise, including simultaneous arrivals', () => {
    const w = createWorld();
    completeInteraction(w, w.agents[0], 'disguise');
    completeInteraction(w, w.agents[1], 'disguise');
    expect(w.agents.filter((a) => a.disguised)).toHaveLength(1);
  });
});
describe('mission lifecycle', () => {
  it('supports an armed squad extraction through live opposition', () => {
    const w = createWorld(),
      ids = w.agents.map((a) => a.id);
    toggleWeapons(w, ids);
    for (const point of [
      { x: 11, y: 14 },
      { x: 17.3, y: 6.2 },
      { x: 25.5, y: 9.5 },
    ]) {
      moveAgents(w, ids, point);
      advance(w, 13);
      expect(w.agents.some(living)).toBe(true);
    }
    interact(w, ids, 'engineer');
    until(w, () => w.engineer.recruited);
    moveAgents(w, ids, { x: 5.5, y: 22.2 });
    until(
      w,
      () => w.agents.filter(living).every((a) => distance(a, { x: 4.5, y: 22.5 }) < 3.8),
      45,
    );
    until(w, () => distance(w.engineer, { x: 4.5, y: 22.5 }) < 3.5);
    interact(w, ids, 'extract');
    until(w, () => w.status === 'won');
    expect(w.shots).toBeGreaterThan(0);
    expect(w.guards.some((g) => !living(g))).toBe(true);
  });
  it('requires the engineer and all surviving operatives at extraction', () => {
    const w = createWorld();
    completeInteraction(w, w.agents[0], 'extract');
    expect(w.status).toBe('playing');
    completeInteraction(w, w.agents[0], 'engineer');
    Object.assign(w.engineer, { x: 4.5, y: 22.5 });
    w.agents[3].x = 20;
    completeInteraction(w, w.agents[0], 'extract');
    expect(w.status).toBe('playing');
    expect(w.agents[0].order).toEqual({ kind: 'interact', target: 'extract' });
    w.agents[3].x = 6;
    advance(w, 1);
    expect(w.status).toBe('won');
  });
  it('releases evidence when its carrier falls and transfers the engineer escort', () => {
    const w = createWorld(),
      a = w.agents[0];
    completeInteraction(w, a, 'evidence');
    completeInteraction(w, a, 'engineer');
    a.hp = 0;
    step(w);
    expect(w.evidence).toBe('available');
    expect(a.carrying).toBe(false);
    expect(w.engineer.leader).not.toBe(a.id);
  });
  it('a carrier cannot draw a gun or attack before setting down evidence', () => {
    const w = createWorld(),
      a = w.agents[0];
    completeInteraction(w, a, 'evidence');
    toggleWeapons(w, [a.id]);
    attack(w, [a.id], w.guards[0].id);
    expect(a.weapon).toBe(false);
    expect(a.order.kind).toBe('hold');
  });
  it('can complete a real quiet route with one disguise and an escort', () => {
    const w = createWorld(),
      a = w.agents[0];
    interact(w, [a.id], 'disguise');
    until(w, () => a.disguised);
    interact(w, [a.id], 'relay');
    until(w, () => w.relayOff);
    interact(w, [a.id], 'engineer');
    until(w, () => w.engineer.recruited);
    moveAgents(w, [a.id], { x: 4.8, y: 21.6 });
    until(w, () => distance(a, { x: 4.8, y: 21.6 }) < 0.6);
    until(w, () => distance(w.engineer, { x: 4.5, y: 22.5 }) < 3.5);
    interact(w, [a.id], 'extract');
    until(w, () => w.status === 'won');
    expect(w.alarm).toBe(false);
    expect(w.agents.every((a) => a.hp > 0)).toBe(true);
    expect(w.shots).toBe(0);
  });
});
