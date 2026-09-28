import { describe, expect, it } from 'vitest';
import { mandate } from '../src/content/mandate';
import { nextMission } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { landmark } from '../src/sim/orders';
import { findPath, passable } from '../src/sim/navigation';
import { distance, living } from '../src/sim/types';
import type { ObjectKind, Vec } from '../src/sim/types';
import { STEP, step } from '../src/sim/step';
import { extractionRequirement } from '../src/ui/extraction';
import { guideLocation, missionGoals } from '../src/ui/objectives';
import { Recorder, parseReplay, verifyReplay } from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';
import { activeTurrets } from '../src/sim/security';

function run() {
  const w = createWorld(mandate),
    ids = w.agents.map((a) => a.id);
  const build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-mandate', '2026-09-28T00:00:00.000Z');
  const send = (c: Command) => {
    recorder.command(c);
    applyCommand(w, c);
  };
  const tick = () => {
    step(w);
    recorder.afterStep();
  };
  const wait = (predicate: () => boolean, limit = 100) => {
    for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) {
      tick();
    }
    expect(
      predicate(),
      JSON.stringify({
        time: w.time,
        message: w.message,
        agents: w.agents.map((a) => ({ id: a.id, x: a.x, y: a.y, hp: a.hp, order: a.order })),
        guards: w.guards.map((g) => ({ id: g.id, x: g.x, y: g.y, hp: g.hp })),
      }),
    ).toBe(true);
  };
  const move = (agents: string[], point: Vec) => {
    send({ kind: 'move', agents, point });
    wait(() =>
      w.agents.filter((a) => living(a) && agents.includes(a.id)).every((a) => !a.path.length),
    );
  };
  const act = (agents: string[], target: ObjectKind, predicate: () => boolean) => {
    send({ kind: 'interact', agents, target });
    wait(predicate);
  };
  const verifyRecording = () => {
    const bundle = parseReplay(JSON.stringify(recorder.bundle()));
    expect(verifyReplay(bundle, build).error).toBeNull();
  };
  const verify = () => {
    verifyRecording();
    expect(w.status).toBe('won');
    expect(w.agents.filter(living)).toHaveLength(4);
  };
  return { w, ids, send, wait, move, act, verify, verifyRecording, tick };
}

describe('Adverse selection', () => {
  it('connects both service approaches, sentry mounts and objective markers', () => {
    expect(nextMission('clearing')).toBe(mandate);
    const w = createWorld(mandate);
    w.gateOpen = true;
    const points = [
      ...mandate.landmarks,
      ...mandate.spawns,
      ...mandate.guards.flatMap((g) => [...g.patrol, ...(g.tactic?.posts ?? [])]),
      ...mandate.security!.turrets.map((t) => t.position),
      ...mandate.response.spawns,
      ...mandate.response.patrol,
      ...(mandate.response.specialists?.flatMap((t) => t.posts) ?? []),
    ];
    for (const p of points) {
      expect(passable(w, p), JSON.stringify(p)).toBe(true);
      const path = findPath(w, w.agents[0], p);
      expect(path.length, JSON.stringify(p)).toBeGreaterThan(0);
      expect(distance(path.at(-1)!, p), JSON.stringify(p)).toBeLessThan(0.01);
    }
    for (const goal of missionGoals(w))
      for (const id of goal.targets) expect(guideLocation(w, id)).not.toBeNull();
    expect(extractionRequirement(w)?.label).toBe('Collect MANDATE');
  });

  it('borrows authority, isolates both feeds, and extracts quietly with live patrols and an exact replay', () => {
    const { w, ids, act, move, wait, verify } = run();
    const a = w.agents[0];
    move(ids.slice(1), { x: 6, y: 1.5 });
    move(ids.slice(1), { x: 48, y: 2.5 });
    act([a.id], 'disguise', () => a.disguised);
    act([a.id], 'authorise', () => w.security!.inspectionUsed);
    act([a.id], 'power-west', () => w.security!.isolated.includes('power-west'));
    move([a.id], { x: 19.8, y: 7.5 });
    move([a.id], { x: 32, y: 7.5 });
    act([a.id], 'power-east', () => w.security!.isolated.includes('power-east'));
    move([a.id], { x: 32, y: 17.2 });
    act([a.id], 'gate', () => w.gateOpen);
    act([a.id], 'evidence', () => a.carrying);
    move([a.id], { x: 37.5, y: 17.2 });
    wait(() => w.guards[5].y > 21 && w.guards[5].y < 22 && Math.sin(w.guards[5].angle) > 0.9);
    move([a.id], { x: 45, y: 17.2 });
    act([a.id], 'extract', () => distance(a, landmark(w, 'extract')) < 1.15);
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.agents.every((p) => p.hp === 100)).toBe(true);
    expect(activeTurrets(w)).toHaveLength(0);
    verify();
  });

  it('makes a radio-jam rush costly even with focused fire and dressings', () => {
    const { w, ids, send, move, act, wait, tick, verifyRecording } = run();
    send({ kind: 'weapons', agents: ids });
    move(ids, { x: 10.5, y: 26 });
    send({ kind: 'attack', agents: ids, target: 'guard-0' });
    wait(() => !living(w.guards[0]));
    act(ids, 'relay', () => w.relayOff);
    const end = w.time + 90;
    while (w.time < end && w.status === 'playing' && w.guards.some(living)) {
      const crew = w.agents.filter(living);
      const target = w.guards
        .filter(living)
        .sort((a, b) => distance(a, crew[0]) - distance(b, crew[0]))[0];
      send({ kind: 'attack', agents: ids, target: target.id });
      for (let i = 0; i < 10 / STEP && living(target) && w.status === 'playing'; i++) {
        const wounded = w.agents
          .filter((a) => living(a) && a.medkit && a.hp <= 50)
          .map((a) => a.id);
        if (wounded.length) send({ kind: 'heal', agents: wounded });
        tick();
      }
    }
    expect(w.relayOff).toBe(true);
    expect(w.security!.isolated).toHaveLength(0);
    expect(w.guards.filter(living)).toHaveLength(0);
    expect(w.agents.filter(living).length).toBeLessThanOrEqual(2);
    verifyRecording();
  });

  it('supports a prepared assault without an inspection identity', () => {
    const { w, ids, act, move, send, wait, verify } = run();
    const cover = () => {
      send({ kind: 'heal', agents: w.agents.filter((a) => a.hp <= 60).map((a) => a.id) });
      const end = w.time + 5;
      wait(() => w.time >= end);
      send({ kind: 'heal', agents: w.agents.filter((a) => a.hp <= 60).map((a) => a.id) });
    };
    send({ kind: 'weapons', agents: ids });
    move(ids, { x: 10.5, y: 26 });
    send({ kind: 'attack', agents: ids, target: 'guard-0' });
    wait(() => !living(w.guards[0]));
    cover();
    act(ids, 'relay', () => w.relayOff);
    move(ids, { x: 10.3, y: 17 });
    move(ids, { x: 12, y: 12 });
    send({ kind: 'attack', agents: ids, target: 'guard-1' });
    wait(() => !living(w.guards[1]));
    cover();
    act(ids, 'power-west', () => w.security!.isolated.includes('power-west'));
    cover();
    move(ids, { x: 19.5, y: 7 });
    move(ids, { x: 32, y: 7.5 });
    act(ids, 'power-east', () => w.security!.isolated.includes('power-east'));
    move(ids, { x: 31, y: 17.2 });
    send({ kind: 'attack', agents: ids, target: 'guard-2' });
    wait(() => !living(w.guards[2]));
    cover();
    move(ids, { x: 37.5, y: 17.2 });
    cover();
    act(ids, 'evidence', () => w.evidence === 'carried');
    move(ids, { x: 37.5, y: 17.2 });
    move(ids, { x: 43, y: 17.2 });
    send({ kind: 'attack', agents: ids, target: 'guard-5' });
    wait(() => !living(w.guards[5]));
    cover();
    act(ids, 'gate', () => w.gateOpen);
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBeGreaterThan(0);
    expect(w.security!.inspectionUsed).toBe(false);
    verify();
  });
});
