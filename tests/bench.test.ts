import { expect, it } from 'vitest';
import { bench } from '../src/content/bench';
import { createWorld } from '../src/sim/world';
import { applyCommand, type Command } from '../src/sim/commands';
import { distance, living, position, type ObjectKind, type World } from '../src/sim/types';
import { STEP, step } from '../src/sim/step';
import {
  COMMAND_TIME,
  commandMarshal,
  dacre,
  dacreDefeated,
  interruptMarshal,
  openBench,
  updateFinale,
} from '../src/sim/finale';
import { available, extractionStatus, interact, landmark } from '../src/sim/orders';
import { captureReady } from '../src/sim/floors';
import { findPath, lineClear } from '../src/sim/navigation';
import { updateAwareness } from '../src/sim/awareness';
import { mapTimers } from '../src/ui/map-timers';
import { missionGoals } from '../src/ui/objectives';
import { nextMission } from '../src/content/missions';
import { Recorder, parseReplay, verifyReplay } from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';
import { earnedMedals } from '../src/ui/medals';

const advance = (w: World, seconds: number) => {
  for (let i = 0; i < seconds / STEP; i++) step(w);
};
const calm = () => {
  const w = createWorld(bench);
  for (const g of w.guards) g.hp = 0;
  w.relayOff = true;
  return w;
};

it('ends the campaign at the rooftop exit, without phantom ground gates', () => {
  expect(nextMission('threshold')).toBe(bench);
  expect(nextMission('bench')).toBeUndefined();
  const w = calm();
  w.escort!.hp = 0;
  const goal = missionGoals(w).find((g) => g.id === 'extract')!;
  expect(goal.label).toContain('HELI');
  expect(goal.targets).toEqual(['extract']);
});

it('requires separate free hands at both seals, saves interrupted work and permanently opens the actual collision door', () => {
  const w = calm(),
    [a, b] = w.agents;
  const outside = { x: 30.5, y: 15.2 },
    inside = bench.finale!.inside;
  expect(lineClear(w, outside, inside)).toBe(false);
  expect(findPath(w, outside, inside)).toEqual([]);
  Object.assign(a, position(landmark(w, 'seal-west')));
  Object.assign(b, position(landmark(w, 'seal-east')));
  interact(w, [a.id], 'seal-west');
  advance(w, 5);
  expect(w.finale!.progress).toBe(0);
  expect(mapTimers(w).find((t) => t.target === 'seal-west')?.rows[0].paused).toBe(true);
  b.carrying = true;
  interact(w, [b.id], 'seal-east');
  advance(w, 1);
  expect(w.finale!.progress).toBe(0);
  b.carrying = false;
  interact(w, [b.id], 'seal-east');
  advance(w, 2);
  const progress = w.finale!.progress;
  expect(progress).toBeGreaterThan(1);
  applyCommand(w, { kind: 'hold', agents: [a.id] });
  expect(w.finale!.westBy).toBeNull();
  advance(w, 3);
  expect(w.finale!.progress).toBe(progress);
  interact(w, [a.id], 'seal-west');
  advance(w, 1);
  a.disoriented = 1;
  advance(w, 0.5);
  expect(w.finale!.westBy).toBeNull();
  advance(w, 5);
  expect(w.finale!.open).toBe(true);
  expect(available(w, 'seal-west')).toBe(false);
  expect(available(w, 'breach')).toBe(false);
  expect(w.agents.slice(0, 2).every((p) => p.order.kind === 'hold')).toBe(true);
  expect(lineClear(w, outside, inside)).toBe(true);
  expect(findPath(w, outside, inside).at(-1)).toEqual(inside);
});

it('allows a lone survivor to CUT from inside and cuff Holt, but cannot arrest before Dacre falls', () => {
  const w = calm(),
    a = w.agents[0],
    boss = dacre(w)!;
  boss.hp = 160;
  w.relayOff = false;
  for (const other of w.agents.slice(1)) other.hp = 0;
  Object.assign(a, bench.finale!.inside);
  interact(w, [a.id], 'breach');
  advance(w, 8.2);
  expect(w.finale!.open).toBe(true);
  expect(w.alarm).toBe(true);
  Object.assign(a, position(w.escort!));
  interact(w, [a.id], 'escort');
  advance(w, 3.2);
  expect(w.escort!.recruited).toBe(false);
  boss.hp = 0;
  expect(captureReady(w)).toBe(true);
  interact(w, [a.id], 'escort');
  advance(w, 3.2);
  expect(w.escort!.recruited).toBe(true);
  expect(w.status).toBe('playing');
});

it('roots Dacre during a visible signal and remembers its initial contact, then moves surviving retinue without spawning anyone', () => {
  const w = createWorld(bench),
    boss = dacre(w)!,
    a = w.agents[0];
  w.relayOff = true;
  Object.assign(a, { x: 27, y: 25 });
  boss.mode = 'combat';
  boss.known = [a.id];
  const rounds = boss.armament!.rounds;
  updateAwareness(w, 0.1);
  expect(boss.marshal!.target).toEqual(position(a));
  expect(boss.armament!.rounds).toBe(rounds);
  expect(boss.path).toEqual([]);
  expect(mapTimers(w).find((t) => t.target === 'dacre')?.rows[0].remaining).toBeCloseTo(1.9);
  const observed = position(a),
    count = w.guards.length;
  Object.assign(a, { x: 7, y: 30 });
  commandMarshal(w, boss, undefined, COMMAND_TIME);
  const moving = w.guards.filter((g) => g.commandMove);
  expect(moving.length).toBeGreaterThanOrEqual(2);
  expect(new Set(moving.map((g) => JSON.stringify(g.commandMove!.goal))).size).toBe(moving.length);
  for (const g of moving) {
    expect(g.lastSeen).toEqual(observed);
    expect(g.hp).toBe(g.maxHp);
    expect(g.tactics!.posts).toContainEqual(g.commandMove!.goal);
  }
  expect(w.guards).toHaveLength(count);
  expect(boss.marshal!.target).toBeNull();
  expect(commandMarshal(w, boss, a, 0.1)).toBe(false);
});

it('cancels Dacre’s signal on damage, flash or death, and never gives orders without a visible contact', () => {
  const w = createWorld(bench),
    boss = dacre(w)!,
    a = w.agents[0];
  expect(commandMarshal(w, boss, undefined, 0.1)).toBe(false);
  for (const mode of ['hit', 'flash'] as const) {
    boss.marshal!.readyAt = 0;
    boss.disoriented = 0;
    commandMarshal(w, boss, a, 0.1);
    if (mode === 'hit') boss.hp--;
    else boss.disoriented = 1;
    interruptMarshal(w, boss);
    expect(boss.marshal!.target).toBeNull();
    expect(boss.marshal!.readyAt).toBeGreaterThan(w.time);
    expect(w.guards.some((g) => g.commandMove)).toBe(false);
  }
  expect(w.finale!.interrupted).toBe(2);
  boss.disoriented = 0;
  boss.marshal!.readyAt = 0;
  commandMarshal(w, boss, a, 0.1);
  boss.hp = 0;
  updateFinale(w, 0);
  expect(mapTimers(w).some((t) => t.target === 'dacre')).toBe(false);
});

it('requires both principals resolved and all survivors plus a cuffed Holt on the roof; a dead Holt does not fail the mission', () => {
  const w = createWorld(bench),
    exit = landmark(w, 'extract');
  for (const a of w.agents) Object.assign(a, position(exit));
  expect(extractionStatus(w, 'extract').ready).toBe(false);
  dacre(w)!.hp = 0;
  expect(extractionStatus(w, 'extract').ready).toBe(false);
  openBench(w);
  w.escort!.recruited = true;
  w.escort!.waiting = true;
  expect(extractionStatus(w, 'extract').waiting).toContain('Holt');
  Object.assign(w.escort!, position(exit));
  expect(extractionStatus(w, 'extract').ready).toBe(true);
  delete w.agents[3].floor;
  expect(extractionStatus(w, 'extract').waiting).toContain('Sable');
  w.agents[3].floor = 1;
  w.escort!.hp = 0;
  advance(w, 0.1);
  expect(w.status).toBe('playing');
  expect(extractionStatus(w, 'extract').ready).toBe(true);
  interact(
    w,
    w.agents.map((a) => a.id),
    'extract',
  );
  advance(w, 1);
  expect(w.status).toBe('won');
  expect(earnedMedals(w)).not.toContain('custody');
});

function run() {
  const w = createWorld(bench),
    ids = w.agents.map((a) => a.id),
    build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-bench', '2026-09-30T00:00:00.000Z');
  const send = (c: Command) => {
    recorder.command(c);
    applyCommand(w, c);
  };
  const wait = (done: () => boolean, limit = 50) => {
    for (let i = 0; i < limit / STEP && !done() && w.status === 'playing'; i++) {
      const hurt = w.agents.filter((a) => living(a) && a.hp <= 55 && a.medkit).map((a) => a.id);
      if (hurt.length) send({ kind: 'heal', agents: hurt });
      step(w);
      recorder.afterStep();
    }
    const context = JSON.stringify({
      time: w.time,
      message: w.message,
      agents: w.agents.map((a) => ({ ...position(a), hp: a.hp, order: a.order })),
      guards: w.guards
        .filter(living)
        .map((g) => ({ id: g.id, ...position(g), hp: g.hp, mode: g.mode })),
      holt: w.escort,
    });
    expect(done(), context).toBe(true);
    expect(w.agents.every(living), context).toBe(true);
  };
  const move = (agents: string[], x: number, y: number, floor = 0) => {
    const point = { x, y, ...(floor ? { floor } : {}) };
    send({ kind: 'move', agents, point });
    wait(() =>
      w.agents
        .filter((a) => agents.includes(a.id))
        .every((a) => !a.path.length && distance(a, point) < 2),
    );
  };
  const act = (agents: string[], target: ObjectKind, done: () => boolean) => {
    send({ kind: 'interact', agents, target });
    wait(done);
  };
  const fight = (id: string, fighters = ids) => {
    const target = id === 'holt' ? w.escort! : w.guards.find((g) => g.id === id)!;
    if (!living(target)) return;

    send({ kind: 'attack', agents: fighters, target: id });
    wait(() => !living(target));
    send({ kind: 'hold', agents: fighters });
  };
  const verify = () =>
    expect(verifyReplay(parseReplay(JSON.stringify(recorder.bundle())), build).error).toBeNull();
  return { w, ids, send, wait, move, act, fight, verify };
}

for (const custody of [true, false])
  it(`completes the guarded finale with ${custody ? 'paired seals and Holt in custody' : 'CUT and Holt eliminated'}, then replays exactly`, () => {
    const { w, ids, send, wait, move, act, fight, verify } = run();
    act([ids[0]], 'disguise', () => w.agents[0].disguised);
    move([ids[0]], 10, 17);
    move([ids[0]], 10, 6);
    act([ids[0]], 'relay', () => w.relayOff);
    move([ids[0]], 13, 6);
    move(ids, 10, 17);
    move(ids, 10, 6);
    move(ids, 17, 6);
    fight('guard-2');
    fight('guard-0');
    move(ids, 18, 8);
    move(ids, 28, 9);
    move(ids, 26, 18);
    send({ kind: 'flash', agents: [ids[2]], point: position(w.guards[4]) });
    fight('guard-4');
    fight(dacre(w)!.id);
    send({ kind: 'flash', agents: [ids[3]], point: { x: 30, y: 26 } });
    send({ kind: 'attack', agents: [ids[3]], target: 'guard-5' });
    fight('guard-6', ids.slice(0, 3));
    fight('guard-5', [ids[2], ids[3]]);
    fight('guard-1');
    if (custody) {
      send({ kind: 'interact', agents: [ids[0]], target: 'seal-west' });
      act([ids[1]], 'seal-east', () => w.finale!.open);
      expect(w.finale!.progress).toBe(bench.finale!.sealTime);
      act([ids[0]], 'escort', () => w.escort!.recruited);
    } else {
      act([ids[0]], 'breach', () => w.finale!.open);
      move(ids, 35, 15);
      fight('holt');
    }
    expect(dacreDefeated(w)).toBe(true);
    act([ids[1]], 'evidence', () => w.agents[1].carrying);
    move(ids, 29, 15);
    move(ids, 18, 8);
    act(ids, 'stairs-up', () => w.agents.every((a) => a.floor === 1));
    if (custody) wait(() => w.escort!.floor === 1);
    move(ids, 8, 18, 1);
    move([ids[0], ids[2], ids[3]], 22.5, 18, 1);
    fight('guard-7', [ids[0], ids[2], ids[3]]);
    move(ids, 25, 7, 1);
    move(ids, 40, 8, 1);
    move(ids, 40, 18, 1);
    act(ids, 'extract', () => w.status === 'won');
    expect(w.evidence).toBe('extracted');
    expect(earnedMedals(w).includes('custody')).toBe(custody);
    expect(earnedMedals(w)).not.toContain('nonlethal');
    expect(w.shots).toBeGreaterThan(0);
    verify();
  });
