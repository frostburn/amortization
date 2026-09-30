import { describe, expect, it } from 'vitest';
import { continuity } from '../src/content/continuity';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { floorOf, living, position } from '../src/sim/types';
import type { ObjectKind } from '../src/sim/types';
import { STEP, step } from '../src/sim/step';
import { canWalk, findPath, lineClear, passable } from '../src/sim/navigation';
import { shoot } from '../src/sim/combat';
import { throwFlash } from '../src/sim/flash';
import { extractionStatus, interact, landmark } from '../src/sim/orders';
import { earnedMedals } from '../src/ui/medals';
import { activeTurrets } from '../src/sim/security';
import { Recorder, parseReplay, verifyReplay } from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';
import { selectionFocus } from '../src/render/camera';

const advance = (w: ReturnType<typeof createWorld>, seconds: number) => {
  for (let i = 0; i < seconds / STEP; i++) step(w);
};

describe('separate storeys and Kestrel custody', () => {
  it('separates movement, firing, flash exposure and camera grouping at identical map coordinates', () => {
    const w = createWorld({ ...continuity, guards: [], security: undefined });
    const [a, b] = w.agents;
    Object.assign(a, { x: 25, y: 12, previous: { x: 25, y: 12 }, flashes: 1 });
    Object.assign(b, { x: 25, y: 12, floor: 1, previous: { x: 25, y: 12, floor: 1 } });
    expect(passable(w, b)).toBe(true);
    expect(passable(w, { x: 10, y: 10, floor: 1 })).toBe(false);
    expect(lineClear(w, a, b)).toBe(false);
    expect(canWalk(w, a, b)).toBe(false);
    expect(findPath(w, a, b)).toEqual([]);
    expect(shoot(w, a, b, false)).toBe(false);
    throwFlash(w, [a.id], { x: 25.5, y: 12 });
    advance(w, 1.1);
    expect(a.disoriented).toBeGreaterThan(0);
    expect(b.disoriented).toBeUndefined();
    expect(selectionFocus(w, [b.id, a.id, w.agents[2].id], 1)?.floor).toBe(1);
  });
  it('moves selected people only through stairs and walks a following prisoner down, with wait respected', () => {
    const w = createWorld({ ...continuity, guards: [], security: undefined });
    const a = w.agents[0],
      k = w.escort!;
    Object.assign(a, position(landmark(w, 'stairs-up')));
    interact(w, [a.id], 'stairs-up');
    advance(w, 1);
    expect(a.floor).toBe(1);
    expect(w.agents.slice(1).every((p) => !p.floor)).toBe(true);
    Object.assign(k, { x: 26, y: 14, recruited: true, leader: a.id, waiting: true });
    interact(w, [a.id], 'stairs-down');
    advance(w, 1);
    expect(floorOf(a)).toBe(0);
    expect(k.floor).toBe(1);
    applyCommand(w, { kind: 'escort-wait' });
    advance(w, 4);
    expect(floorOf(k)).toBe(0);
    expect(k.previous.floor).toBeUndefined();
  });
  it('requires both isolated feeds for cuffs, excludes a dead target from nonlethal medals, and waits for an upstairs captive', () => {
    const w = createWorld(continuity),
      a = w.agents[0],
      k = w.escort!;
    w.guards = [];
    Object.assign(a, position(k));
    a.previous = position(a);
    interact(w, [a.id], 'escort');
    advance(w, 4);
    expect(k.recruited).toBe(false);
    w.security!.isolated = ['power-west', 'power-east'];
    interact(w, [a.id], 'escort');
    advance(w, 4);
    expect(k.recruited).toBe(true);
    expect(activeTurrets(w)).toEqual([]);
    for (const p of w.agents) {
      Object.assign(p, position(landmark(w, 'extract')));
      delete p.floor;
    }
    expect(extractionStatus(w, 'extract').ready).toBe(false);
    expect(extractionStatus(w, 'extract').waiting).toContain('Kestrel');
    k.hp = 0;
    advance(w, 1);
    expect(w.status).toBe('playing');
    expect(extractionStatus(w, 'extract').ready).toBe(true);
    interact(
      w,
      w.agents.map((p) => p.id),
      'extract',
    );
    advance(w, 1);
    expect(w.status).toBe('won');
    expect(w.message).toContain('Kestrel is eliminated. REGISTER left behind.');
    expect(earnedMedals(w)).not.toContain('nonlethal');
    expect(earnedMedals(w)).not.toContain('custody');
  });
});

function run() {
  const w = createWorld(continuity),
    ids = w.agents.map((a) => a.id),
    build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-continuity', '2026-09-30T00:00:00.000Z');
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
      k: w.escort,
      guards: w.guards.filter(living).map((g) => ({ id: g.id, ...position(g), mode: g.mode })),
    });
    expect(done(), context).toBe(true);
    expect(w.agents.every(living), context).toBe(true);
  };
  const move = (agents: string[], x: number, y: number, floor = 0) => {
    send({ kind: 'move', agents, point: { x, y, ...(floor ? { floor } : {}) } });
    wait(() => w.agents.filter((a) => agents.includes(a.id)).every((a) => !a.path.length));
  };
  const act = (agents: string[], target: ObjectKind, done: () => boolean) => {
    send({ kind: 'interact', agents, target });
    wait(done);
  };
  const verify = () =>
    expect(verifyReplay(parseReplay(JSON.stringify(recorder.bundle())), build).error).toBeNull();
  return { w, ids, send, move, act, wait, verify };
}

it('arrests Kestrel and escorts her downstairs without killing anyone on the live guarded site', () => {
  const { w, ids, move, act, wait, verify } = run(),
    scout = [ids[0]];
  act(scout, 'disguise', () => w.agents[0].disguised);
  move(scout, 24, 23);
  act(scout, 'authorise', () => w.security!.inspectionUsed);
  act(scout, 'power-west', () => w.security!.isolated.includes('power-west'));
  move(scout, 35, 22);
  move(scout, 40, 22);
  act(scout, 'power-east', () => w.security!.isolated.includes('power-east'));
  move(scout, 40, 22);
  move(scout, 35, 22);
  act(scout, 'stairs-up', () => w.agents[0].floor === 1);
  move(scout, 25, 27, 1);
  move(scout, 38.5, 27, 1);
  move(scout, 40, 23, 1);
  act(scout, 'escort', () => w.escort!.recruited);
  move(scout, 40, 23, 1);
  move(scout, 38.5, 27, 1);
  move(scout, 25, 27, 1);
  act(scout, 'stairs-down', () => !w.agents[0].floor);
  wait(() => !w.escort!.floor);
  move(scout, 24, 23);
  move(scout, 15, 24);
  act(ids, 'extract', () => w.status === 'won');
  expect(w.guards.every(living)).toBe(true);
  expect(w.message).toContain('Kestrel is in custody. REGISTER left behind.');
  expect(earnedMedals(w)).toContain('custody');
  expect(earnedMedals(w)).toContain('nonlethal');
  verify();
});

it('fights through both storeys, eliminates Kestrel with feeds still live, and extracts the register', () => {
  const { w, ids, send, move, act, wait, verify } = run();
  const fight = (id: string, fighters = ids) => {
    const target = id === 'kestrel' ? w.escort! : w.guards.find((g) => g.id === id)!;
    if (!living(target)) return;
    send({ kind: 'attack', agents: fighters, target: id });
    wait(() => !living(target));
    send({ kind: 'hold', agents: fighters });
  };
  move(ids, 15, 24);
  move(ids, 24, 23);
  fight('guard-2');
  act(ids, 'stairs-up', () => w.agents.every((a) => a.floor === 1));
  fight('turret-2');
  fight('guard-4');
  move(ids, 25, 27, 1);
  move(ids, 35, 27, 1);
  fight('turret-3');
  move(ids, 40, 23, 1);
  // Approach the officer from the side of the control screen instead of rushing its lane.
  move(ids, 48, 22, 1);
  fight('guard-6');
  fight('guard-7');
  fight('kestrel');
  move([ids[2]], 47, 20, 1);
  send({ kind: 'flash', agents: [ids[2]], point: { x: 42, y: 19, floor: 1 } });
  fight('guard-5', ids.slice(0, 3));
  expect(w.security!.isolated).toEqual([]);
  expect(activeTurrets(w)).toEqual([]);
  act([ids[0]], 'evidence', () => w.agents[0].carrying);
  move(ids, 40, 27, 1);
  move(ids, 35, 27, 1);
  move(ids, 25, 27, 1);
  act(ids, 'stairs-down', () => w.agents.every((a) => !a.floor));
  move(ids, 24, 23);
  move(ids, 15, 24);
  act(ids, 'extract', () => w.status === 'won');
  expect(w.evidence).toBe('extracted');
  expect(w.message).toContain('Kestrel is eliminated. REGISTER secured.');
  expect(earnedMedals(w)).not.toContain('custody');
  expect(w.shots).toBeGreaterThan(0);
  verify();
});
