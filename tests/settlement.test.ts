import { describe, expect, it } from 'vitest';
import { settlement } from '../src/content/settlement';
import { nextMission } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { extractionStatus, landmark } from '../src/sim/orders';
import { settled } from '../src/sim/settlement';
import { sees, sightRange } from '../src/sim/awareness';
import { weaponRange } from '../src/sim/weapons';
import { STEP, step } from '../src/sim/step';
import { canWalk, findPath, passable } from '../src/sim/navigation';
import { distance, living } from '../src/sim/types';
import type { ObjectKind, World } from '../src/sim/types';
import { extractionRequirement } from '../src/ui/extraction';
import { objectRequirement } from '../src/ui/interactions';
import { guideLocation, missionGoals } from '../src/ui/objectives';
import { earnedMedals } from '../src/ui/medals';
import { Recorder, parseReplay, verifyReplay } from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';

const advance = (w: World, seconds: number) => {
  for (let i = 0; i < seconds / STEP; i++) step(w);
};
function station(w: World, index: number, target: ObjectKind) {
  const a = w.agents[index],
    p = landmark(w, target);
  Object.assign(a, { x: p.x, y: p.y, previous: { x: p.x, y: p.y } });
  applyCommand(w, { kind: 'interact', agents: [a.id], target });
}
function prepared() {
  const w = createWorld(settlement);
  w.guards = [];
  w.evidence = 'carried';
  w.agents[0].carrying = true;
  w.settlement!.reconciled = true;
  return w;
}

/** Actual guarded runs: only recorded player commands alter the starting world. */
function run() {
  const w = createWorld(settlement),
    ids = w.agents.map((a) => a.id),
    build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-settlement', '2026-09-29T00:00:00.000Z');
  const send = (command: Command) => {
    recorder.command(command);
    applyCommand(w, command);
  };
  const tick = () => {
    const hurt = w.agents.filter((a) => living(a) && a.hp <= 55 && a.medkit).map((a) => a.id);
    if (hurt.length) send({ kind: 'heal', agents: hurt });
    step(w);
    recorder.afterStep();
  };
  const wait = (predicate: () => boolean, limit = 120) => {
    for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) tick();
    expect(
      predicate(),
      JSON.stringify({
        time: w.time,
        message: w.message,
        agents: w.agents.map((a) => ({ id: a.id, x: a.x, y: a.y, hp: a.hp, order: a.order })),
      }),
    ).toBe(true);
    expect(w.agents.every(living)).toBe(true);
  };
  const move = (agents: string[], x: number, y: number) => {
    send({ kind: 'move', agents, point: { x, y } });
    wait(() => w.agents.filter((a) => agents.includes(a.id)).every((a) => !a.path.length));
  };
  const act = (agents: string[], target: ObjectKind, predicate: () => boolean) => {
    send({ kind: 'interact', agents, target });
    wait(predicate);
  };
  const retrieve = () => {
    act([ids[0]], 'disguise', () => w.agents[0].disguised);
    act([ids[1]], 'override', () => w.overrideBy === ids[1]);
    for (const [x, y] of [
      [9.5, 30],
      [9.5, 7],
      [24, 7],
      [24, 10],
      [26.5, 10],
      [26.5, 18.5],
      [35, 18.5],
    ])
      move([ids[0]], x, y);
    wait(() => w.guards[4].x > 40.5 && w.guards[4].x < 41.5 && Math.cos(w.guards[4].angle) > 0.9);
    for (const [x, y] of [
      [41.5, 18.5],
      [41.5, 15.8],
      [35.4, 15.8],
      [35.4, 9],
    ])
      move([ids[0]], x, y);
    act([ids[0]], 'relay', () => w.relayOff);
    act([ids[0]], 'evidence', () => w.agents[0].carrying);
    move([ids[0]], 47.8, 9);
    wait(() => w.guards[4].x > 46.5 && Math.cos(w.guards[4].angle) < -0.9);
    for (const [x, y] of [
      [47.8, 15.8],
      [41.5, 15.8],
      [41.5, 18.5],
      [26.5, 18.5],
      [26.5, 10],
      [24, 10],
      [24, 7],
      [9.5, 7],
      [9.5, 16],
    ])
      move([ids[0]], x, y);
    expect(w.shots).toBe(0);
    expect(w.agents.every((a) => a.hp === 100)).toBe(true);
  };
  const verify = () => {
    expect(w.status).toBe('won');
    expect(w.agents.every(living)).toBe(true);
    expect(w.evidence).toBe('extracted');
    expect(settled(w)).toBe(true);
    expect(verifyReplay(parseReplay(JSON.stringify(recorder.bundle())), build).error).toBeNull();
  };
  return { w, ids, send, wait, move, act, retrieve, verify };
}

describe('Value date', () => {
  it('extends human perception in daylight without extending weapons, bypassing walls or changing night missions', () => {
    const w = createWorld(settlement),
      g = w.guards[0];
    Object.assign(g, { x: 20, y: 41, angle: 0 });
    const p = { x: 30, y: 41 };
    expect(sightRange(g, w)).toBe(11.25);
    expect(weaponRange(g)).toBe(6);
    expect(sees(w, g, p)).toBe(true);
    w.mission = { ...settlement, daylight: false };
    expect(sightRange(g, w)).toBe(7.5);
    expect(sees(w, g, p)).toBe(false);
    w.mission = {
      ...settlement,
      solids: [
        ...settlement.solids,
        { id: 'test-screen', x: 25, y: 39, w: 0.35, h: 4, height: 1.6, kind: 'wall' },
      ],
    };
    expect(sees(w, g, p)).toBe(false);
    expect(sees(w, g, { x: 17, y: 41 })).toBe(false);
  });

  it('requires the original at CHECK before either release terminal accepts work', () => {
    const w = createWorld(settlement);
    w.guards = [];
    station(w, 0, 'reconcile');
    expect(w.agents[0].order.kind).toBe('hold');
    expect(w.message).toContain('REGISTER carrier');
    station(w, 1, 'countersign');
    expect(w.agents[1].order.kind).toBe('hold');
    expect(objectRequirement(w, 'settle', ['agent-0'])).toContain('CHECK');
    w.agents[0].carrying = true;
    w.evidence = 'carried';
    station(w, 0, 'reconcile');
    advance(w, 3);
    applyCommand(w, { kind: 'hold', agents: ['agent-0'] });
    station(w, 0, 'reconcile');
    advance(w, 3.5);
    expect(w.settlement!.reconciled).toBe(false);
    advance(w, 2.6);
    expect(w.settlement!.reconciled).toBe(true);
    expect(w.agents[0].carrying).toBe(true);
    expect(extractionRequirement(w)?.label).toBe('Staff SIGN and CLEAR');
  });

  it('requires two separate operators, pauses immediately on orders, and resumes with saved progress', () => {
    const w = prepared();
    station(w, 0, 'countersign');
    expect(w.message).toContain('separate operative');
    station(w, 0, 'settle');
    advance(w, 3);
    expect(w.settlement!.progress).toBe(0);
    station(w, 1, 'countersign');
    advance(w, 3);
    expect(w.settlement!.progress).toBeGreaterThan(2);
    applyCommand(w, { kind: 'hold', agents: ['agent-1'] });
    expect(w.settlement!.signer).toBeNull();
    const saved = w.settlement!.progress;
    advance(w, 2);
    expect(w.settlement!.progress).toBe(saved);
    station(w, 1, 'countersign');
    advance(w, 20);
    expect(settled(w)).toBe(true);
    expect(w.agents.slice(0, 2).every((a) => a.order.kind === 'hold')).toBe(true);
    expect(w.status).toBe('playing');
    expect(extractionRequirement(w)).toBeNull();
  });

  it('interrupts work on lost cargo, flashes and operator death; a new carrier keeps reconciliation', () => {
    const w = prepared();
    station(w, 0, 'settle');
    station(w, 1, 'countersign');
    advance(w, 2);
    applyCommand(w, { kind: 'drop', agents: ['agent-0'] });
    expect(w.settlement!.clerk).toBeNull();
    const saved = w.settlement!.progress;
    advance(w, 1);
    expect(w.settlement!.progress).toBe(saved);
    station(w, 2, 'evidence');
    advance(w, 1);
    expect(w.agents[2].carrying).toBe(true);
    expect(w.settlement!.reconciled).toBe(true);
    station(w, 2, 'settle');
    advance(w, 1);
    w.agents[1].disoriented = 1.5;
    advance(w, 0.1);
    expect(w.settlement!.signer).toBeNull();
    const flashed = w.settlement!.progress;
    advance(w, 0.5);
    expect(w.settlement!.progress).toBe(flashed);
    w.agents[1].hp = 0;
    advance(w, 2);
    expect(w.settlement!.progress).toBe(flashed);
  });

  it('cannot extract without both released repayments and the original; reports an impossible solo operation', () => {
    const w = prepared(),
      van = landmark(w, 'extract');
    for (const a of w.agents) Object.assign(a, { x: van.x, y: van.y });
    expect(extractionStatus(w, 'extract').ready).toBe(false);
    w.settlement!.progress = settlement.settlement!.duration;
    expect(extractionStatus(w, 'extract').ready).toBe(true);
    w.agents[0].carrying = false;
    w.evidence = 'available';
    expect(extractionStatus(w, 'extract').waiting).toContain('beneficiary register');
    const solo = prepared();
    solo.agents.slice(1).forEach((a) => (a.hp = 0));
    step(solo);
    expect(solo.status).toBe('lost');
    expect(solo.message).toContain('Two operatives');
  });

  it('makes the SIGN operator give up firing until released', () => {
    const w = prepared(),
      g = createWorld(settlement).guards[0];
    Object.assign(g, { x: 16, y: 28, mode: 'combat', disoriented: 10 });
    w.guards = [g];
    w.agents[1].weapon = true;
    station(w, 1, 'countersign');
    advance(w, 2);
    expect(w.settlement!.signer).toBe(w.agents[1].id);
    expect(w.shots).toBe(0);
    applyCommand(w, { kind: 'hold', agents: [w.agents[1].id] });
    advance(w, 0.1);
    expect(w.shots).toBeGreaterThan(0);
  });

  it('connects the full authored map and objective locators with the records shutter opened', () => {
    expect(nextMission('injunction')).toBe(settlement);
    const w = createWorld(settlement);
    w.shutterOpen = w.gateOpen = true;
    for (const p of [
      ...settlement.landmarks,
      ...settlement.spawns,
      ...settlement.guards.flatMap((g) => [...g.patrol, ...(g.tactic?.posts ?? [])]),
      ...settlement.response.spawns,
      ...settlement.response.patrol,
      ...settlement.response.specialists!.flatMap((t) => t.posts),
    ]) {
      expect(passable(w, p), JSON.stringify(p)).toBe(true);
      const path = findPath(w, w.agents[0], p);
      expect(distance(path.at(-1) ?? w.agents[0], p), JSON.stringify(p)).toBeLessThan(0.01);
      let from = w.agents[0];
      for (const point of path) {
        expect(canWalk(w, from, point)).toBe(true);
        from = { ...from, ...point };
      }
    }
    for (const goal of missionGoals(w))
      for (const target of goal.targets) expect(guideLocation(w, target)).not.toBeNull();
    expect(missionGoals(w).find((g) => g.id === 'evidence')!.optional).toBe(false);
  });
});

describe('Value date guarded completions', () => {
  it('hands the reconciled register to a partner and extracts all four without killing anyone', () => {
    const { w, ids, send, wait, move, act, retrieve, verify } = run();
    retrieve();
    move([ids[0]], 9.5, 12);
    act([ids[0]], 'reconcile', () => w.settlement!.reconciled);
    move([ids[1]], 9.5, 12);
    move([ids[1]], 13.5, 13);
    send({ kind: 'drop', agents: [ids[0]] });
    act([ids[1]], 'evidence', () => w.agents[1].carrying);
    act([ids[0]], 'countersign', () => w.settlement!.signer === ids[0]);
    for (const [x, y] of [
      [9.5, 12],
      [9.5, 7],
      [24, 7],
      [24, 10],
      [26.5, 10],
      [26.5, 18.5],
      [50, 18.5],
      [50, 16.5],
      [53, 16.5],
      [53, 28.8],
    ])
      move([ids[1]], x, y);
    act([ids[1]], 'settle', () => settled(w));
    move([ids[1]], 53, 28.8);
    act([ids[1]], 'gate', () => w.gateOpen);
    // Leave the watched gate immediately; idle waiting here lets the inspector catch up.
    move([ids[1]], 56, 8.5);
    move([ids[0]], 9.5, 33);
    move([ids[0]], 6, 33);
    act([ids[0], ids[2], ids[3]], 'extract', () =>
      w.agents.filter((a) => a.id !== ids[1]).every((a) => a.x > 54),
    );
    act([ids[1]], 'extract', () => w.status === 'won');
    wait(() => w.status === 'won');
    expect(w.guards.every(living)).toBe(true);
    expect(w.alarm).toBe(false);
    expect(earnedMedals(w)).toEqual(['complete', 'full-crew', 'quiet', 'nonlethal']);
    verify();
  });

  it('supports a prepared assault with a sheltered carrier and two separate release operators', () => {
    const { w, ids, send, wait, move, act, retrieve, verify } = run();
    retrieve();
    const fighters = ids.slice(1);
    move([ids[1]], 6, 33);
    move(ids.slice(2), 6, 33);
    send({ kind: 'weapons', agents: fighters });
    const fight = (target: string) => {
      const guard = w.guards.find((g) => g.id === target)!;
      if (!living(guard)) return;
      send({ kind: 'attack', agents: fighters, target });
      wait(() => !living(guard), 45);
      send({ kind: 'hold', agents: fighters });
    };
    for (const target of ['guard-0', 'guard-7', 'guard-2', 'guard-1']) fight(target);
    move(fighters, 37.5, 28);
    for (const target of ['guard-5', 'guard-3', 'guard-6']) fight(target);
    for (const [x, y] of [
      [9.5, 22.5],
      [15.5, 22.5],
      [15.5, 19],
      [11.8, 19],
      [11.8, 12],
    ])
      move([ids[0]], x, y);
    act([ids[0]], 'reconcile', () => w.settlement!.reconciled);
    act([ids[1]], 'countersign', () => w.settlement!.signer === ids[1]);
    act([ids[0]], 'settle', () => settled(w));
    act(ids.slice(2), 'gate', () => w.gateOpen);
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBeGreaterThan(0);
    expect(w.waves).toBe(0);
    verify();
  });
});
