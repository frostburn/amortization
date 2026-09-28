import { describe, expect, it } from 'vitest';
import { clearing } from '../src/content/clearing';
import { severance } from '../src/content/severance';
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

function run() {
  const w = createWorld(clearing),
    ids = w.agents.map((a) => a.id);
  const build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-clearing', '2026-09-28T00:00:00.000Z');
  const send = (c: Command) => {
    recorder.command(c);
    applyCommand(w, c);
  };
  const wait = (predicate: () => boolean, limit = 100) => {
    for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) {
      step(w);
      recorder.afterStep();
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
  const verify = () => {
    const bundle = parseReplay(JSON.stringify(recorder.bundle()));
    expect(verifyReplay(bundle, build).error).toBeNull();
    expect(w.status).toBe('won');
    expect(w.agents.filter(living)).toHaveLength(4);
  };
  return { w, ids, send, wait, move, act, verify };
}

describe('Margin call', () => {
  it('connects the larger site and keeps authored routes and firing posts reachable', () => {
    expect(nextMission('severance')).toBe(clearing);
    expect(nextMission('clearing')).toBeUndefined();
    expect(clearing.width * clearing.height).toBeGreaterThan(
      severance.width * severance.height * 1.8,
    );
    const w = createWorld(clearing);
    w.shutterOpen = true;
    w.gateOpen = true;
    const points = [
      ...clearing.landmarks,
      ...clearing.spawns,
      ...clearing.guards.flatMap((g) => [...g.patrol, ...(g.tactic?.posts ?? [])]),
      ...clearing.response.spawns,
      ...clearing.response.patrol,
      ...(clearing.response.specialists?.flatMap((t) => t.posts) ?? []),
      ...clearing.solids
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
      const path = findPath(w, w.agents[0], p);
      expect(path.length, JSON.stringify(p)).toBeGreaterThan(0);
      expect(distance(path.at(-1)!, p), JSON.stringify(p)).toBeLessThan(0.01);
    }
    for (const goal of missionGoals(w))
      for (const id of goal.targets) expect(guideLocation(w, id)).not.toBeNull();
    expect(missionGoals(w)[0].detail).toContain('KEYS');
    expect(extractionRequirement(w)?.label).toBe('Collect KEYS');
  });

  it('completes a quiet split-team recovery with live patrols and replays it exactly', () => {
    const { w, ids, send, wait, move, act, verify } = run();
    const [a, b] = w.agents;
    act([a.id], 'disguise', () => a.disguised);
    send({ kind: 'interact', agents: [b.id], target: 'override' });
    act([a.id], 'relay', () => w.relayOff);
    move([a.id], { x: 10.3, y: 18 });
    move([a.id], { x: 36, y: 17.5 });
    act([a.id], 'gate', () => w.gateOpen);
    expect(w.overrideBy).toBe(b.id);
    act([a.id], 'evidence', () => a.carrying);
    expect(extractionRequirement(w)).toBeNull();
    move([a.id], { x: 45.5, y: 17.5 });
    move([a.id], { x: 52.5, y: 17.5 });
    wait(() => w.guards[6].y > 23 && Math.sin(w.guards[6].angle) > 0.9);
    act([a.id], 'extract', () => distance(a, landmark(w, 'extract')) < 1.15);
    expect(w.status).toBe('playing'); // The shunt operator and covering crew still need to leave.
    expect(w.overrideBy).toBe(b.id);
    move(ids.slice(1), { x: 6, y: 2 });
    move(ids.slice(1), { x: 56.5, y: 2 });
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.agents.every((p) => p.hp === 100 && !p.exposed)).toBe(true);
    verify();
  });

  it('supports an armed advance, a forced shutter and full-crew extraction', () => {
    const { w, ids, send, wait, move, act, verify } = run();
    const cover = () => {
      const end = w.time + 4;
      wait(() => w.time >= end);
      send({ kind: 'heal', agents: w.agents.filter((a) => a.hp <= 60).map((a) => a.id) });
    };
    send({ kind: 'weapons', agents: ids });
    move(ids, { x: 11.5, y: 31 });
    cover();
    act(ids, 'relay', () => w.relayOff);
    move(ids, { x: 10.3, y: 18 });
    move(ids, { x: 30, y: 17.5 });
    cover();
    send({ kind: 'attack', agents: ids, target: w.guards[3].id });
    wait(() => !living(w.guards[3]));
    cover();
    move(ids, { x: 45.5, y: 17.5 });
    act(ids, 'breach', () => w.shutterBreached);
    act(ids, 'gate', () => w.gateOpen);
    act(ids, 'evidence', () => w.evidence === 'carried');
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBeGreaterThan(0);
    verify();
  });
});
