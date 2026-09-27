import { describe, expect, it } from 'vitest';
import { severance } from '../src/content/severance';
import { nextMission } from '../src/content/missions';
import { createWorld, makeGuard } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { demolished, detonationStatus } from '../src/sim/demolition';
import { suspicionRate } from '../src/sim/awareness';
import { available, completeInteraction, extractionStatus, landmark } from '../src/sim/orders';
import { findPath, passable } from '../src/sim/navigation';
import { distance, living } from '../src/sim/types';
import type { World, Vec } from '../src/sim/types';
import { step, STEP } from '../src/sim/step';
import { extractionRequirement } from '../src/ui/extraction';
import { guideLocation, missionGoals } from '../src/ui/objectives';
import { Recorder, parseReplay, verifyReplay } from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';

const place = (p: Vec, at: Vec) => Object.assign(p, { x: at.x, y: at.y });
function advance(w: World, seconds: number) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(w);
}
function until(w: World, predicate: () => boolean, afterStep = () => {}, limit = 60) {
  for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) {
    step(w);
    afterStep();
  }
  expect(predicate(), `${w.time.toFixed(1)}s: ${w.message}`).toBe(true);
}
function fixture() {
  const w = createWorld(severance);
  w.guards = [];
  place(w.agents[0], landmark(w, 'charge-west'));
  place(w.agents[1], landmark(w, 'charge-east'));
  return w;
}

describe('Severance', () => {
  it('connects the campaign and keeps targets, patrols and cover corners reachable', () => {
    expect(nextMission('broadcast')).toBe(severance);
    expect(nextMission('severance')).toBeUndefined();
    const w = createWorld(severance);
    const points = [
      ...severance.landmarks,
      ...severance.spawns,
      ...severance.guards.flatMap((g) => g.patrol),
      ...severance.solids
        .flatMap((s) => [
          { x: s.x - 0.205, y: s.y + s.h / 2 },
          { x: s.x + s.w + 0.205, y: s.y + s.h / 2 },
          { x: s.x + s.w / 2, y: s.y - 0.205 },
          { x: s.x + s.w / 2, y: s.y + s.h + 0.205 },
        ])
        .filter((p) => passable(w, p)),
    ];
    for (const p of points) {
      expect(passable(w, p), JSON.stringify(p)).toBe(true);
      expect(distance(findPath(w, w.agents[0], p).at(-1)!, p)).toBeLessThan(0.001);
    }
    for (const g of missionGoals(w))
      for (const id of g.targets) expect(guideLocation(w, id)).not.toBeNull();
  });

  it('allows split planting, preserves repeated work, and resets interrupted placement', () => {
    const w = fixture(),
      [a, b] = w.agents;
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'charge-west' });
    applyCommand(w, { kind: 'interact', agents: [b.id], target: 'charge-east' });
    advance(w, 2);
    const progress = b.interaction;
    applyCommand(w, { kind: 'interact', agents: [b.id], target: 'charge-east' });
    expect(b.interaction).toBe(progress);
    applyCommand(w, { kind: 'hold', agents: [a.id] });
    expect(a.interaction).toBe(0);
    advance(w, 3.1);
    expect(w.demolition!.armed).toEqual(['charge-east']);
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'charge-west' });
    advance(w, 5.1);
    expect(w.demolition!.armed).toHaveLength(2);
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'charge-west' });
    expect(w.message).toContain('WEST is already armed. Move Morrow, Vale');
    expect(w.demolition!.armed).toHaveLength(2);
    b.hp = 0;
    advance(w, 20);
    expect(w.demolition!.armed).toHaveLength(2);
    expect(available(w, 'charge-west')).toBe(false);
    expect(w.demolition!.detonatedAt).toBeNull();
  });

  it('requires free hands, makes planting conspicuous, and prevents a planter firing', () => {
    const w = fixture(),
      a = w.agents[0];
    completeInteraction(w, a, 'evidence');
    const prior = structuredClone(a.order);
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'charge-west' });
    expect(a.order).toEqual(prior);
    expect(w.message).toContain('cargo down');
    applyCommand(w, { kind: 'drop', agents: [a.id] });
    a.disguised = true;
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'charge-west' });
    advance(w, 0.5);
    expect(suspicionRate(w, a)).toBe(95);
    const guard = makeGuard('guard-0', { x: a.x + 2, y: a.y }, [{ x: a.x + 2, y: a.y }]);
    guard.mode = 'combat';
    w.guards = [guard];
    a.weapon = true;
    advance(w, 0.5);
    expect(guard.hp).toBe(guard.maxHp);
    expect(w.demolition!.armed).toHaveLength(0);
  });

  it('blocks incomplete and unsafe detonation in the simulation, including at the boundary', () => {
    const w = fixture(),
      a = w.agents[0];
    applyCommand(w, { kind: 'detonate' });
    expect(w.demolition!.detonatedAt).toBeNull();
    expect(w.message).toContain('Plant WEST and EAST');
    completeInteraction(w, a, 'charge-west');
    applyCommand(w, { kind: 'detonate' });
    expect(w.message).toContain('Plant EAST');
    completeInteraction(w, w.agents[1], 'charge-east');
    const point = landmark(w, 'charge-west');
    place(a, { x: point.x + severance.demolition!.blastRadius, y: point.y });
    const orders = w.agents.map((a) => structuredClone(a.order));
    applyCommand(w, { kind: 'detonate' });
    expect(w.message).toContain('Morrow, Vale');
    expect(w.agents.map((a) => a.order)).toEqual(orders);
    expect(demolished(w)).toBe(false);
    // A dead operative cannot strand the surviving crew behind the safety interlock.
    w.agents[1].hp = 0;
    a.x += 0.01;
    expect(detonationStatus(w).ready).toBe(true);
    expect(extractionRequirement(w)).not.toBeNull();
    applyCommand(w, { kind: 'detonate' });
    expect(demolished(w)).toBe(true);
    expect(w.alarm).toBe(true);
    expect(extractionRequirement(w)).toBeNull();
    expect(extractionStatus(w, 'extract').ready).toBe(false); // Still need to reach the van.
  });

  it('destroys nearby guards once, respects RADIO, and leaves wreckage collision intact', () => {
    const w = createWorld(severance),
      p = landmark(w, 'charge-west');
    w.demolition!.armed = ['charge-west', 'charge-east'];
    w.relayOff = true;
    const doomed = makeGuard('guard-0', p, []),
      survivor = makeGuard('guard-1', { x: 18, y: 13 }, []);
    w.guards = [doomed, survivor];
    const solids = JSON.stringify(w.mission.solids);
    applyCommand(w, { kind: 'detonate' });
    expect(doomed.hp).toBe(0);
    expect(survivor.mode).toBe('combat');
    expect(w.alarm).toBe(false);
    expect(w.casualties).toBe(1);
    expect(w.sounds.filter((s) => s.kind === 'blast')).toHaveLength(2);
    applyCommand(w, { kind: 'detonate' });
    expect(w.casualties).toBe(1);
    expect(w.sounds.filter((s) => s.kind === 'blast')).toHaveLength(2);
    expect(JSON.stringify(w.mission.solids)).toBe(solids);
    expect(missionGoals(w)[0].complete).toBe(true);
    expect(missionGoals(w)[1].optional).toBe(true);
  });

  it('completes a quiet infiltration through patrol windows and verifies the serialized replay', () => {
    const w = createWorld(severance),
      a = w.agents[0],
      ids = w.agents.map((p) => p.id);
    const build = buildInfo(process.cwd());
    const recorder = new Recorder(w, build, 'synthetic-severance', '2026-09-27T00:00:00.000Z');
    const send = (c: Command) => {
      recorder.command(c);
      applyCommand(w, c);
    };
    const wait = (p: () => boolean) => until(w, p, () => recorder.afterStep());
    const move = (p: Vec) => {
      send({ kind: 'move', agents: [a.id], point: p });
      wait(() => !a.path.length);
    };
    const act = (
      target: 'disguise' | 'relay' | 'gate' | 'charge-west' | 'charge-east',
      p: () => boolean,
    ) => {
      send({ kind: 'interact', agents: [a.id], target });
      wait(p);
    };
    send({ kind: 'move', agents: ids.slice(1), point: { x: 37.7, y: 7 } });
    act('disguise', () => a.disguised);
    act('relay', () => w.relayOff);
    act('gate', () => w.gateOpen);
    move({ x: 17.5, y: 13 });
    wait(() => w.guards[2].x < 11.6 && w.guards[2].y > 7.5 && Math.sin(w.guards[2].angle) > 0.8);
    act('charge-west', () => w.demolition!.armed.includes('charge-west'));
    move({ x: 17.5, y: 13 });
    move({ x: 24, y: 13 });
    wait(() => w.guards[4].x > 32.3 && w.guards[4].y > 7.5 && Math.sin(w.guards[4].angle) > 0.8);
    act('charge-east', () => w.demolition!.armed.includes('charge-east'));
    expect(detonationStatus(w).ready).toBe(false);
    move({ x: 24, y: 14 });
    send({ kind: 'detonate' });
    expect(demolished(w)).toBe(true);
    send({ kind: 'interact', agents: ids, target: 'extract' });
    wait(() => w.status === 'won');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.agents.every((a) => a.hp === 100 && !a.exposed)).toBe(true);
    const bundle = parseReplay(JSON.stringify(recorder.bundle()));
    expect(verifyReplay(bundle, build).error).toBeNull();
    expect(bundle.commands.some((c) => c.command.kind === 'detonate')).toBe(true);
  });

  it('supports an armed advance and a covered withdrawal with the full crew', () => {
    const w = createWorld(severance),
      ids = w.agents.map((p) => p.id);
    const send = (c: Command) => applyCommand(w, c);
    const move = (p: Vec) => {
      send({ kind: 'move', agents: ids, point: p });
      until(w, () => w.agents.filter(living).every((p) => !p.path.length));
      send({ kind: 'heal', agents: w.agents.filter((p) => p.hp <= 60).map((p) => p.id) });
    };
    const act = (target: 'relay' | 'gate' | 'charge-west' | 'charge-east', p: () => boolean) => {
      send({ kind: 'interact', agents: ids, target });
      until(w, p);
    };
    send({ kind: 'weapons', agents: ids });
    move({ x: 10, y: 20.5 });
    act('relay', () => w.relayOff);
    for (const p of [
      { x: 16.7, y: 21 },
      { x: 16.8, y: 13 },
      { x: 18, y: 10 },
      { x: 18, y: 5.7 },
    ])
      move(p);
    act('charge-west', () => w.demolition!.armed.includes('charge-west'));
    for (const p of [
      { x: 18, y: 13.5 },
      { x: 24, y: 13.5 },
      { x: 24, y: 5.5 },
    ])
      move(p);
    act('charge-east', () => w.demolition!.armed.includes('charge-east'));
    move({ x: 24, y: 14 });
    send({ kind: 'detonate' });
    move({ x: 32, y: 18 });
    act('gate', () => w.gateOpen);
    send({ kind: 'interact', agents: ids, target: 'extract' });
    until(w, () => w.status === 'won');
    expect(demolished(w)).toBe(true);
    expect(w.shots).toBeGreaterThan(0);
    expect(w.agents.filter(living)).toHaveLength(4);
  });
});
