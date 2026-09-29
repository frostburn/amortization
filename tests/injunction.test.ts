import { describe, expect, it } from 'vitest';
import { injunction } from '../src/content/injunction';
import { nextMission } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { landmark } from '../src/sim/orders';
import { findPath, passable } from '../src/sim/navigation';
import { distance, living } from '../src/sim/types';
import type { ObjectKind, Vec } from '../src/sim/types';
import { STEP, step } from '../src/sim/step';
import { published } from '../src/sim/broadcast';
import { extractionRequirement } from '../src/ui/extraction';
import { guideLocation, missionGoals } from '../src/ui/objectives';
import { Recorder, parseReplay, verifyReplay } from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';

function run() {
  const w = createWorld(injunction),
    ids = w.agents.map((a) => a.id);
  const build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-injunction', '2026-09-29T00:00:00.000Z');
  const send = (c: Command) => {
    recorder.command(c);
    applyCommand(w, c);
  };
  const tick = () => {
    step(w);
    recorder.afterStep();
  };
  const wait = (predicate: () => boolean, limit = 100) => {
    for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) tick();
    expect(
      predicate(),
      JSON.stringify({
        time: w.time,
        message: w.message,
        agents: w.agents.map((a) => ({ id: a.id, x: a.x, y: a.y, hp: a.hp, order: a.order })),
        guards: w.guards.map((g) => ({
          id: g.id,
          x: g.x,
          y: g.y,
          hp: g.hp,
          angle: g.angle,
          known: g.known,
        })),
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
  const spend = () => {
    for (const agent of ids.slice(2))
      send({ kind: 'flash', agents: [agent], point: { x: 1, y: 40 } });
    wait(() => !w.flashGrenades!.length);
    expect(w.agents.slice(2).map((a) => a.flashes)).toEqual([0, 0]);
  };
  const verify = () => {
    const bundle = parseReplay(JSON.stringify(recorder.bundle()));
    expect(verifyReplay(bundle, build).error).toBeNull();
    expect(w.status).toBe('won');
    expect(w.agents.filter(living)).toHaveLength(4);
  };
  return { w, ids, send, wait, move, act, spend, verify, tick, recorder };
}

describe('Stay of execution', () => {
  it('keeps RADIO inaccessible after an armed rush reaches the office entrance under a live alarm', () => {
    const { w, ids, send, tick, recorder } = run();
    send({ kind: 'weapons', agents: ids });
    send({ kind: 'interact', agents: ids, target: 'relay' });
    expect(w.agents.every((a) => a.order.kind === 'hold')).toBe(true);
    send({ kind: 'move', agents: ids, point: landmark(w, 'breach') });
    for (let i = 0; i < 35 / STEP && w.status === 'playing'; i++) {
      const hurt = w.agents.filter((a) => living(a) && a.medkit && a.hp <= 55).map((a) => a.id);
      if (hurt.length) send({ kind: 'heal', agents: hurt });
      tick();
    }
    expect(w.alarm).toBe(true);
    expect(w.relayOff).toBe(false);
    expect(w.waves).toBeGreaterThan(0);
    expect(w.agents.every((a) => distance(a, landmark(w, 'relay')) > 4)).toBe(true);
    expect(w.shutterOpen).toBe(false);
    expect(
      verifyReplay(parseReplay(JSON.stringify(recorder.bundle())), buildInfo(process.cwd())).error,
    ).toBeNull();
  });
  it('connects authored routes and keeps RADIO beyond both entrance and inner checkpoint', () => {
    expect(nextMission('personnel')).toBe(injunction);
    const w = createWorld(injunction);
    w.gateOpen = true;
    w.shutterOpen = true;
    for (const p of [
      ...injunction.landmarks,
      ...injunction.spawns,
      ...injunction.guards.flatMap((g) => [...g.patrol, ...(g.tactic?.posts ?? [])]),
      ...injunction.response.spawns,
      ...injunction.response.patrol,
      ...(injunction.response.specialists?.flatMap((t) => t.posts) ?? []),
    ]) {
      expect(passable(w, p), JSON.stringify(p)).toBe(true);
      const path = findPath(w, w.agents[0], p);
      expect(distance(path.at(-1) ?? w.agents[0], p), JSON.stringify(p)).toBeLessThan(0.01);
    }
    w.gateOpen = false;
    const path = findPath(w, { x: 9, y: 31 }, landmark(w, 'relay'));
    let length = 0,
      previous: Vec = { x: 9, y: 31 };
    for (const p of path) {
      length += distance(previous, p);
      previous = p;
    }
    expect(length).toBeGreaterThan(45);
    const route = [{ x: 9, y: 31 }, ...path];
    const crossing = route.slice(1).flatMap((p, i) => {
      const from = route[i],
        t = (20.175 - from.x) / (p.x - from.x);
      return t >= 0 && t <= 1 ? [from.y + (p.y - from.y) * t] : [];
    });
    expect(crossing.some((y) => y > 20 && y < 24)).toBe(true);
    for (const goal of missionGoals(w))
      for (const id of goal.targets) expect(guideLocation(w, id)).not.toBeNull();
    expect(extractionRequirement(w)?.label).toBe('Finish UPLINK');
    w.shutterOpen = false;
    const log = missionGoals(w).find((g) => g.id === 'evidence')!;
    expect(log.optional).toBe(true);
    expect(log.detail).toContain('optional');
    expect(log.detail).not.toContain('required for extraction');
  });

  it('requires eight seconds to force the office and another four to disable RADIO', () => {
    const w = createWorld(injunction),
      a = w.agents[0];
    w.guards = [];
    const p = landmark(w, 'breach');
    Object.assign(a, { x: p.x, y: p.y, previous: { x: p.x, y: p.y } });
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'breach' });
    for (let i = 0; i < 7.5 / STEP; i++) step(w);
    expect(w.shutterOpen).toBe(false);
    for (let i = 0; i < 0.6 / STEP; i++) step(w);
    expect(w.shutterBreached).toBe(true);
    expect(w.shutterOpen).toBe(true);
    expect(w.alarm).toBe(true);
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'relay' });
    for (let i = 0; i < 20 / STEP && a.path.length; i++) step(w);
    expect(a.path).toHaveLength(0);
    expect(a.interaction).toBeLessThan(1);
    for (let i = 0; i < 2.5 / STEP; i++) step(w);
    expect(w.relayOff).toBe(false);
    for (let i = 0; i < 1.5 / STEP; i++) step(w);
    expect(w.relayOff).toBe(true);
  });

  it('serves the mandate and extracts the whole crew quietly with both flashes spent and an exact replay', () => {
    const { w, ids, spend, move, act, wait, verify } = run();
    spend();
    move(ids.slice(2), { x: 5, y: 2 });
    move(ids.slice(2), { x: 53, y: 2 });
    move(ids.slice(2), { x: 52, y: 8 });
    act([ids[0]], 'disguise', () => w.agents[0].disguised);
    wait(() => w.guards[0].x > 15 && Math.cos(w.guards[0].angle) > 0.9);
    move([ids[1]], { x: 9.3, y: 29 });
    move([ids[1]], { x: 9.3, y: 19.2 });
    act([ids[1]], 'mask', () => w.broadcast!.maskBy === ids[1]);
    move([ids[0]], { x: 11.5, y: 23 });
    wait(() => w.guards[1].x < 16 && w.guards[1].y > 23.5 && Math.sin(w.guards[1].angle) > 0.8);
    move([ids[0]], { x: 21.8, y: 22 });
    move([ids[0]], { x: 22, y: 16.3 });
    move([ids[0]], { x: 26, y: 16.3 });
    wait(() => w.guards[4].y < 10 && Math.sin(w.guards[4].angle) < -0.8);
    move([ids[0]], { x: 28.5, y: 13 });
    move([ids[0]], { x: 24, y: 13 });
    move([ids[0]], { x: 24, y: 8 });
    act([ids[0]], 'upload', () => published(w));
    move([ids[0]], { x: 24, y: 13 });
    move([ids[0]], { x: 28.5, y: 16.3 });
    move([ids[0]], { x: 34.8, y: 16.3 });
    move([ids[0]], { x: 34.8, y: 19.5 });
    move([ids[0]], { x: 49, y: 19.5 });
    act([ids[0]], 'gate', () => w.gateOpen);
    move([ids[1]], { x: 9.3, y: 29 });
    move([ids[1]], { x: 5, y: 31 });
    move([ids[1]], { x: 5, y: 2 });
    move([ids[1]], { x: 53, y: 2 });
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.agents.every((a) => a.hp === 100)).toBe(true);
    verify();
  });

  it('prepares the deep relay before an armed completion with spent flashes and an exact replay', () => {
    const { w, ids, spend, move, send, wait, act, tick, verify } = run();
    spend();
    act([ids[1]], 'override', () => w.overrideBy === ids[1]);
    act([ids[0]], 'disguise', () => w.agents[0].disguised);
    move([ids[0]], { x: 11.5, y: 23 });
    wait(() => w.guards[1].x < 16 && w.guards[1].y > 23.5 && Math.sin(w.guards[1].angle) > 0.8);
    move([ids[0]], { x: 21.8, y: 22 });
    move([ids[0]], { x: 22, y: 16.3 });
    move([ids[0]], { x: 34.8, y: 16.3 });
    move([ids[0]], { x: 34.8, y: 19.5 });
    move([ids[0]], { x: 41.5, y: 19.5 });
    wait(() => w.guards[5].x > 44 && Math.cos(w.guards[5].angle) > 0.9);
    move([ids[0]], { x: 41.5, y: 16.5 });
    move([ids[0]], { x: 37.2, y: 16.5 });
    move([ids[0]], { x: 37.2, y: 9 });
    act([ids[0]], 'relay', () => w.relayOff);
    expect(w.agents[0].exposed).toBe(false);
    expect(w.time).toBeGreaterThan(30);
    move([ids[0]], { x: 37.2, y: 9 });
    wait(() => w.guards[5].x > 44 && Math.cos(w.guards[5].angle) > 0.9);
    move([ids[0]], { x: 37.2, y: 16.5 });
    move([ids[0]], { x: 41.5, y: 19.5 });
    move([ids[0]], { x: 34.8, y: 19.5 });
    move([ids[0]], { x: 22, y: 16.3 });
    move([ids[1]], { x: 5, y: 32 });
    send({ kind: 'weapons', agents: ids });
    let fighters = ids.slice(1);
    const fight = (target: string) => {
      const guard = w.guards.find((g) => g.id === target)!;
      send({ kind: 'attack', agents: fighters, target });
      const end = w.time + 45;
      while (living(guard) && w.time < end && w.status === 'playing') {
        const hurt = w.agents.filter((a) => living(a) && a.medkit && a.hp <= 55).map((a) => a.id);
        if (hurt.length) send({ kind: 'heal', agents: hurt });
        tick();
      }
      expect(
        living(guard),
        JSON.stringify({
          target,
          time: w.time,
          crew: w.agents.map((a) => ({ hp: a.hp, x: a.x, y: a.y })),
          guards: w.guards.filter(living).map((g) => ({ id: g.id, x: g.x, y: g.y, hp: g.hp })),
        }),
      ).toBe(false);
      send({ kind: 'hold', agents: ids });
    };
    move(fighters, { x: 10.5, y: 31 });
    fight('guard-0');
    fight('guard-1');
    move(fighters, { x: 18, y: 22 });
    fight('guard-3');
    expect(w.relayOff).toBe(true);
    fighters = ids;
    move(ids, { x: 22, y: 16.3 });
    fight('guard-4');
    move(ids, { x: 28.5, y: 16.3 });
    fight('guard-2');
    fight('guard-6');
    expect(w.waves).toBe(0);
    fight('guard-7');
    act(ids, 'upload', () => published(w));
    act(ids, 'gate', () => w.gateOpen);
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBeGreaterThan(0);
    wait(() => w.status === 'won');
    verify();
  });
});
