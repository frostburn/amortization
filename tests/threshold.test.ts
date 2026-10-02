import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { threshold } from '../src/content/threshold';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { distance, living, position } from '../src/sim/types';
import type { ObjectKind, World } from '../src/sim/types';
import { STEP, step } from '../src/sim/step';
import { available, dropEvidence, extractionStatus, interact, landmark } from '../src/sim/orders';
import { callLift, liftReady, liftRemaining } from '../src/sim/threshold';
import { sees, sightRange } from '../src/sim/vision';
import { throwFlash } from '../src/sim/flash';
import {
  Recorder,
  ReplayPlayer,
  compatibility,
  parseReplay,
  verifyReplay,
} from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';
import { mapTimers } from '../src/ui/map-timers';
import { earnedMedals } from '../src/ui/medals';

function advance(w: World, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) step(w);
}

it('escapes the human abandoned run using inside CUT with the surviving operative', () => {
  const bundle = parseReplay(
    readFileSync('tests/fixtures/threshold-playing-51fe9ea6.replay.json', 'utf8'),
  );
  const build = buildInfo(process.cwd());
  const player = new ReplayPlayer(bundle, build, compatibility(bundle, build).length > 0);
  while (!player.done) player.advance();
  expect(player.error).toBeNull();
  const w = player.world,
    a = w.agents[0];
  expect(w.agents.filter(living).map((a) => a.name)).toEqual(['Morrow']);
  expect(w.shutterOpen).toBe(false);
  applyCommand(w, { kind: 'interact', agents: [a.id], target: 'breach' });
  advance(w, 5);
  expect(mapTimers(w).find((t) => t.target === 'breach')?.rows[0].remaining).toBeGreaterThan(0);
  advance(w, 5);
  expect(w.shutterBreached).toBe(true);
  applyCommand(w, { kind: 'move', agents: [a.id], point: { x: 21.5, y: 20.5 } });
  advance(w, 5);
  expect(distance(a, { x: 21.5, y: 20.5 })).toBeLessThan(0.01);
  expect(a.hp).toBe(100);
  expect(w.status).toBe('playing');
});

describe('Threshold: a physical key and an independent lift bell', () => {
  it('uses night sight distances for every guard role despite the sunset palette', () => {
    const w = createWorld({ ...threshold, solids: [], archive: undefined });
    for (const g of w.guards) {
      Object.assign(g, { x: 30, y: 20, angle: 0 });
      if (g.shield) g.shield.angle = 0;
      const night = sightRange(g);
      expect(sightRange(g, w)).toBe(night);
      expect(sees(w, g, { x: g.x + night - 0.01, y: g.y })).toBe(true);
      expect(sees(w, g, { x: g.x + night + 0.01, y: g.y })).toBe(false);
      expect(sightRange(g, { ...w, mission: { ...w.mission, daylight: true } })).toBe(night * 1.5);
    }
  });

  it('requires five uninterrupted seconds from the key carrier and never restarts a completed call', () => {
    const w = createWorld({ ...threshold, guards: [] }),
      a = w.agents[0];
    Object.assign(a, position(landmark(w, 'key-lift')));
    interact(w, [a.id], 'key-lift');
    advance(w, 6);
    expect(w.threshold!.calledAt).toBeNull();
    expect(w.message).toContain('KEY carrier');
    a.carrying = true;
    w.evidence = 'carried';
    interact(w, [a.id], 'key-lift');
    advance(w, 3);
    expect(a.interaction).toBeGreaterThan(2);
    dropEvidence(w, [a.id]);
    advance(w, 3);
    expect(w.threshold!.calledAt).toBeNull();
    interact(w, [a.id], 'evidence');
    advance(w, 1);
    interact(w, [a.id], 'key-lift');
    advance(w, 4.9);
    expect(w.threshold!.calledAt).toBeNull();
    advance(w, 0.2);
    const called = w.threshold!.calledAt;
    expect(called).not.toBeNull();
    expect(available(w, 'key-lift')).toBe(false);
    expect(liftReady(w)).toBe(false);
    advance(w, 10);
    interact(w, [a.id], 'key-lift');
    expect(w.threshold!.calledAt).toBe(called);
    advance(w, 9);
    expect(liftReady(w)).toBe(true);
    expect(liftRemaining(w)).toBe(0);
    advance(w, 60);
    expect(liftReady(w)).toBe(true);
    expect(w.status).toBe('playing');
  });

  it('dispatches only the existing lobby reserve to the bell even when RADIO is disabled', () => {
    const w = createWorld(threshold),
      before = structuredClone(w.guards.slice(0, 5));
    w.relayOff = true;
    callLift(w);
    expect(w.guards).toHaveLength(threshold.guards.length);
    expect(w.guards.slice(0, 5)).toEqual(before);
    for (const g of w.guards.slice(5)) {
      expect(g.mode).toBe('combat');
      expect(g.lastSeen).toEqual(position(landmark(w, 'key-lift')));
      expect(g.known).toEqual([]);
      expect(g.target).toBeNull();
    }
    expect(w.known).toEqual([]);
    expect(w.alarm).toBe(false);
  });

  it('keeps the reserve patrolling the lobby after an unanswered bell without knowing hidden operatives', () => {
    const w = createWorld(threshold),
      original = structuredClone(threshold);
    w.relayOff = true;
    callLift(w);
    advance(w, 75);
    const reserve = w.guards.slice(5);
    for (const g of reserve) {
      expect(g.mode).toBe('patrol');
      expect(g.x).toBeGreaterThanOrEqual(43);
      expect(g.y).toBeLessThanOrEqual(12.5);
      expect(g.known).toEqual([]);
      expect(g.target).toBeNull();
    }
    const before = reserve.map(position);
    advance(w, 3);
    expect(reserve.every((g, i) => distance(g, before[i]) > 0.5)).toBe(true);
    expect(w.alarm).toBe(false);
    expect(w.known).toEqual([]);
    expect(threshold).toEqual(original); // A restart retains the original deployment.
  });

  it('resets unfinished LINK work when its carrier is caught in a flash', () => {
    const w = createWorld({ ...threshold, guards: [] }),
      a = w.agents[0],
      rook = w.agents[2];
    Object.assign(a, position(landmark(w, 'key-lift')), { carrying: true });
    Object.assign(rook, { x: 44.5, y: 7 });
    w.evidence = 'carried';
    interact(w, [a.id], 'key-lift');
    advance(w, 3);
    expect(a.interaction).toBeGreaterThan(2.9);
    throwFlash(w, [rook.id], position(a));
    advance(w, 1.1);
    expect(a.disoriented).toBeGreaterThan(0);
    expect(a.interaction).toBe(0);
    expect(w.threshold!.calledAt).toBeNull();
    advance(w, 6.6);
    expect(w.threshold!.calledAt).not.toBeNull();
  });

  it('waits for every survivor and the recovered original after a carrier falls', () => {
    const w = createWorld({ ...threshold, guards: [] }),
      exit = landmark(w, 'extract');
    for (const a of w.agents) Object.assign(a, position(exit));
    w.agents[0].carrying = true;
    w.evidence = 'carried';
    expect(extractionStatus(w, 'extract').waiting).toContain('LINK');
    callLift(w);
    expect(extractionStatus(w, 'extract').waiting).toContain('arriving');
    advance(w, 19);
    const called = w.threshold!.calledAt;
    w.agents[0].hp = 0;
    advance(w, 0.1);
    expect(w.evidence).toBe('available');
    expect(extractionStatus(w, 'extract').waiting).toContain('service key');
    interact(w, [w.agents[1].id], 'evidence');
    advance(w, 1);
    w.agents[2].x = 40;
    expect(extractionStatus(w, 'extract').waiting).toContain('Rook');
    interact(
      w,
      w.agents.filter(living).map((a) => a.id),
      'extract',
    );
    advance(w, 10);
    expect(w.status, w.message).toBe('won');
    expect(w.evidence).toBe('extracted');
    expect(w.threshold!.calledAt).toBe(called);
  });
});

function run() {
  const w = createWorld(threshold),
    ids = w.agents.map((a) => a.id),
    build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-threshold', '2026-09-30T00:00:00.000Z');
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
      guards: w.guards.filter(living).map((g) => ({ id: g.id, ...position(g), mode: g.mode })),
    });
    expect(done(), context).toBe(true);
    expect(w.agents.every(living), context).toBe(true);
  };
  const move = (agents: string[], x: number, y: number) => {
    send({ kind: 'move', agents, point: { x, y } });
    wait(() =>
      w.agents
        .filter((a) => agents.includes(a.id))
        .every((a) => !a.path.length && distance(a, { x, y }) < 2),
    );
  };
  const act = (agents: string[], target: ObjectKind, done: () => boolean) => {
    send({ kind: 'interact', agents, target });
    wait(done);
  };
  const verify = () =>
    expect(verifyReplay(parseReplay(JSON.stringify(recorder.bundle())), build).error).toBeNull();
  return { w, ids, send, move, act, wait, verify };
}

it('uses a partner at SHUNT, carries KEY along the staff walk and boards without killing anyone', () => {
  const { w, ids, send, move, act, wait, verify } = run(),
    scout = [ids[0]],
    partner = [ids[1]];
  act(partner, 'override', () => w.overrideBy === ids[1]);
  act(scout, 'disguise', () => w.agents[0].disguised);
  move(scout, 12, 21);
  move(scout, 21.5, 19.5);
  move(scout, 17, 16);
  move(scout, 17, 9);
  act(scout, 'evidence', () => w.agents[0].carrying);
  move(scout, 17, 16);
  move(scout, 21.5, 19.5);
  move(scout, 12, 21);
  send({ kind: 'hold', agents: partner });
  move(ids, 12, 21);
  move(ids, 12, 5.5);
  move(ids, 28, 5);
  move(ids, 35, 5);
  move(ids, 40.5, 5);
  wait(() => w.guards[4].y > 15.5 && w.guards[4].angle > 0);
  move(ids, 48, 8.5);
  act(scout, 'key-lift', () => w.threshold!.calledAt !== null);
  move(scout, 48, 8.5);
  wait(() => liftReady(w));
  expect(w.status).toBe('playing');
  act(ids, 'extract', () => w.status === 'won');
  expect(w.guards.every(living)).toBe(true);
  expect(w.alarm).toBe(false);
  expect(w.shots).toBe(0);
  expect(w.evidence).toBe('extracted');
  expect(earnedMedals(w)).toEqual(['complete', 'full-crew', 'quiet', 'nonlethal', 'light-touch']);
  verify();
});

it.each([false, true])(
  'forces dispatch and extracts all four with RADIO disabled=%s',
  (disableRadio) => {
    const { w, ids, send, move, act, wait, verify } = run();
    const fight = (id: string) => {
      const target = w.guards.find((g) => g.id === id)!;
      if (!living(target)) return;
      send({ kind: 'attack', agents: ids, target: id });
      wait(() => !living(target));
      send({ kind: 'hold', agents: ids });
    };
    move(ids, 12, 27);
    fight('guard-1');
    move(ids, 21.5, 20);
    act([ids[0]], 'breach', () => w.shutterBreached);
    fight('guard-0');
    fight('guard-2');
    if (disableRadio) act([ids[1]], 'relay', () => w.relayOff);
    act([ids[0]], 'evidence', () => w.agents[0].carrying);
    move(ids, 21.5, 19.5);
    move(ids, 28, 20);
    fight('guard-4');
    move(ids, 35, 7);
    move(ids, 42, 9);
    act([ids[0]], 'key-lift', () => w.threshold!.calledAt !== null);
    move(ids, 48, 8.5);
    wait(() => liftReady(w));
    act(ids, 'extract', () => w.status === 'won');
    expect(w.alarm).toBe(true);
    expect(w.shutterBreached).toBe(true);
    expect(w.shots).toBeGreaterThan(0);
    expect(w.guards.filter((g) => !living(g)).length).toBeGreaterThan(2);
    expect(w.evidence).toBe('extracted');
    expect(earnedMedals(w)).toEqual(
      disableRadio
        ? ['complete', 'full-crew', 'no-kit']
        : ['complete', 'full-crew', 'no-kit', 'live-alarm'],
    );
    verify();
  },
);
