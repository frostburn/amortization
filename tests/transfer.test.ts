import { describe, expect, it } from 'vitest';
import { transfer } from '../src/content/transfer';
import { createWorld } from '../src/sim/world';
import {
  attack,
  available,
  completeInteraction,
  dropEvidence,
  heal,
  interact,
  landmark,
  moveAgents,
  toggleWeapons,
} from '../src/sim/orders';
import { courierGuard } from '../src/sim/courier';
import { investigateNoise, sees, suspicionRate } from '../src/sim/awareness';
import { STEP, step } from '../src/sim/step';
import { distance, living } from '../src/sim/types';
import type { World } from '../src/sim/types';

function advance(w: World, seconds: number) {
  for (let i = 0; i < seconds / STEP; i++) step(w);
}
function until(w: World, predicate: () => boolean, limit = 60) {
  for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) step(w);
  expect(predicate(), `${w.message} / ${JSON.stringify(w.courier)}`).toBe(true);
}
function inspection() {
  const w = createWorld(transfer),
    a = w.agents[0];
  // State fixture for refusal/custody edge cases; full routes below use only orders.
  w.courier!.phase = 'inspection';
  w.courier!.diverted = true;
  Object.assign(courierGuard(w)!, transfer.transfer!.inspection);
  Object.assign(a, transfer.transfer!.inspection);
  return { w, a, courier: courierGuard(w)! };
}

describe('Adverse possession', () => {
  it('patrols before CALL, tracks the moving case, and repeats after a missed transfer', () => {
    const w = createWorld(transfer),
      courier = courierGuard(w)!;
    advance(w, 15);
    expect(distance(courier, transfer.transfer!.start)).toBeGreaterThan(2);
    expect(w.courier!.phase).toBe('ready');
    expect(distance(courier, landmark(w, 'evidence'))).toBe(0);
    expect(available(w, 'evidence')).toBe(false);
    interact(w, [w.agents[1].id], 'dispatch');
    until(w, () => w.courier!.phase === 'transit');
    expect(available(w, 'dispatch')).toBe(false);
    advance(w, 3);
    expect(distance(courier, transfer.transfer!.start)).toBeGreaterThan(2);
    expect(distance(courier, landmark(w, 'evidence'))).toBe(0);
    until(w, () => w.courier!.phase === 'checkpoint');
    until(w, () => w.courier!.phase === 'ready');
    expect(available(w, 'dispatch')).toBe(true);
    expect(w.evidence).toBe('courier');
    expect(w.status).toBe('playing');
    interact(w, [w.agents[1].id], 'dispatch');
    until(w, () => w.courier!.phase === 'transit');
  });

  it('redirects an active transfer and waits for inspection without a failure timer', () => {
    const w = createWorld(transfer),
      a = w.agents[0];
    interact(w, [w.agents[1].id], 'dispatch');
    interact(w, [a.id], 'disguise');
    until(w, () => a.disguised && w.courier!.phase === 'transit');
    moveAgents(w, [a.id], { x: 10.5, y: 15.3 });
    until(w, () => !a.path.length);
    // Follow the patrol north while their back is turned, then change the signal.
    until(w, () => w.guards[0].y < 10 && w.guards[0].angle < 0);
    interact(w, [a.id], 'divert');
    until(w, () => w.courier!.diverted);
    until(w, () => w.courier!.phase === 'inspection');
    advance(w, 45);
    expect(w.courier!.phase).toBe('inspection');
    expect(distance(courierGuard(w)!, transfer.transfer!.inspection)).toBeLessThan(0.35);
    expect(available(w, 'evidence')).toBe(true);
    expect(w.alarm).toBe(false);
  });

  it('exposes a disguised operative tampering in view of the west patrol', () => {
    const w = createWorld(transfer),
      a = w.agents[0],
      guard = w.guards[0];
    a.disguised = true;
    const signal = landmark(w, 'divert');
    Object.assign(a, { x: signal.x, y: signal.y });
    // The patrol is approaching the routing signal from the north.
    Object.assign(guard, { x: 12.8, y: 13.5, angle: Math.PI / 2 });
    expect(sees(w, guard, a)).toBe(true);
    expect(suspicionRate(w, a)).toBe(0);
    interact(w, [a.id], 'divert');
    advance(w, 1.5);
    expect(w.courier!.diverted).toBe(false);
    expect(a.exposed).toBe(true);
    expect(guard.known).toContain(a.id);
  });

  it('keeps combat in control during diversion, then resumes the interrupted transfer', () => {
    const w = createWorld(transfer),
      courier = courierGuard(w)!;
    interact(w, [w.agents[1].id], 'dispatch');
    until(w, () => w.courier!.phase === 'transit');
    advance(w, 3);
    investigateNoise(w, courier);
    completeInteraction(w, w.agents[0], 'divert');
    expect(courier.mode).toBe('combat');
    expect(courier.path).toEqual([]);
    until(w, () => w.courier!.phase === 'inspection');
    expect(w.evidence).toBe('courier');
    expect(w.alarm).toBe(false);
  });

  it('refuses a handover without concealed, unrecognized maintenance cover', () => {
    const { w, a, courier } = inspection();
    completeInteraction(w, a, 'evidence');
    expect(a.carrying).toBe(false);
    a.disguised = true;
    a.weapon = true;
    completeInteraction(w, a, 'evidence');
    expect(a.carrying).toBe(false);
    a.weapon = false;
    courier.known.push(a.id);
    completeInteraction(w, a, 'evidence');
    expect(w.evidence).toBe('courier');
    courier.known = [];
    courier.mode = 'combat';
    completeInteraction(w, a, 'evidence');
    expect(w.evidence).toBe('courier');
  });

  it('requires CASE, preserves signed cover, and voids clearance after a drop or carrier death', () => {
    const { w, a } = inspection();
    completeInteraction(w, a, 'extract');
    expect(w.status).toBe('playing');
    a.disguised = true;
    completeInteraction(w, a, 'evidence');
    expect(a.carrying).toBe(true);
    expect(a.weapon).toBe(false);
    expect(suspicionRate(w, a)).toBe(0);
    dropEvidence(w, [a.id]);
    completeInteraction(w, a, 'evidence');
    expect(suspicionRate(w, a)).toBe(95);
    a.hp = 0;
    step(w);
    expect(w.evidence).toBe('available');
    expect(distance(w.evidencePosition, a)).toBe(0);
    expect(w.courier!.clearance).toBeNull();
  });

  it('drops the case when the courier dies before a call, with no duplicate after collection', () => {
    const w = createWorld(transfer),
      courier = courierGuard(w)!;
    courier.hp = 0;
    step(w);
    expect(w.evidence).toBe('available');
    expect(available(w, 'dispatch')).toBe(false);
    expect(available(w, 'divert')).toBe(false);
    expect(distance(w.evidencePosition, courier)).toBe(0);
    completeInteraction(w, w.agents[0], 'evidence');
    step(w);
    expect(w.evidence).toBe('carried');
  });

  it('completes a quiet signed handover with live patrols and all four operatives', () => {
    const w = createWorld(transfer),
      runner = w.agents[0],
      caller = w.agents[1];
    interact(w, [runner.id], 'disguise');
    until(w, () => runner.disguised);
    interact(w, [runner.id], 'relay');
    until(w, () => w.relayOff);
    interact(w, [runner.id], 'divert');
    until(w, () => w.courier!.diverted);
    interact(w, [caller.id], 'dispatch');
    moveAgents(w, [runner.id], { x: 12, y: 18.5 });
    until(w, () => w.courier!.phase === 'inspection');
    interact(w, [runner.id], 'evidence');
    until(w, () => runner.carrying);
    moveAgents(
      w,
      w.agents.map((a) => a.id),
      { x: 5, y: 24 },
    );
    until(w, () => w.agents.every((a) => distance(a, landmark(w, 'extract')) < 3.5));
    interact(w, [caller.id], 'extract');
    until(w, () => w.status === 'won');
    expect(w.evidence).toBe('extracted');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.agents.every((a) => a.hp === 100)).toBe(true);
    expect(living(courierGuard(w)!)).toBe(true);
  });

  it('supports a coordinated ambush that clears the controls before diverting the courier', () => {
    const w = createWorld(transfer),
      ids = w.agents.map((a) => a.id),
      caller = w.agents[1];
    toggleWeapons(w, ids);
    interact(w, [caller.id], 'dispatch');
    until(w, () => w.courier!.phase === 'transit');
    moveAgents(w, ids, { x: 11.5, y: 16.5 });
    until(w, () => w.agents.filter(living).every((a) => !a.path.length));
    heal(w, ids);
    // Focus the nearby threats before exposing an operative at the controls.
    for (const id of ['guard-0', 'guard-1', 'guard-2']) {
      if (living(w.guards.find((g) => g.id === id)!)) attack(w, ids, id);
      until(w, () => !living(w.guards.find((g) => g.id === id)!));
    }
    interact(w, ids, 'divert');
    until(w, () => w.courier!.diverted);
    advance(w, 2);
    heal(w, ids);
    until(
      w,
      () => !living(courierGuard(w)!) || distance(courierGuard(w)!, { x: 11.5, y: 16.5 }) < 7,
    );
    if (living(courierGuard(w)!)) attack(w, ids, 'courier');
    until(w, () => w.evidence === 'available');
    interact(w, ids, 'evidence');
    until(w, () => w.evidence === 'carried');
    moveAgents(w, ids, { x: 5, y: 24 });
    until(w, () => w.agents.filter(living).every((a) => distance(a, landmark(w, 'extract')) < 3.5));
    interact(w, ids, 'extract');
    until(w, () => w.status === 'won');
    expect(w.alarm).toBe(false);
    expect(w.shots).toBeGreaterThan(0);
    expect(w.evidence).toBe('extracted');
    expect(w.agents.filter(living)).toHaveLength(4);
  });
});
