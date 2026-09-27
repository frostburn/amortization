import { describe, expect, it } from 'vitest';
import { broadcast } from '../src/content/broadcast';
import { nextMission } from '../src/content/missions';
import { buildInfo } from '../scripts/build-info';
import { Recorder, parseReplay, verifyReplay } from '../src/replay/core';
import { published } from '../src/sim/broadcast';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { findPath, lineClear, passable } from '../src/sim/navigation';
import {
  available,
  completeInteraction,
  extractionStatus,
  hold,
  interact,
  landmark,
  moveAgents,
} from '../src/sim/orders';
import { STEP, step } from '../src/sim/step';
import { distance, living } from '../src/sim/types';
import type { Vec, World } from '../src/sim/types';
import { createWorld, makeGuard } from '../src/sim/world';
import { guideLocation, missionGoals } from '../src/ui/objectives';

function place(person: Vec, position: Vec) {
  person.x = position.x;
  person.y = position.y;
}
function advance(w: World, seconds: number) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(w);
}
function until(w: World, predicate: () => boolean, limit = 70, afterStep = () => {}) {
  for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) {
    step(w);
    afterStep();
  }
  expect(predicate(), `${w.time.toFixed(1)}s: ${w.message}`).toBe(true);
}
function controlsFixture() {
  // Isolate control ownership/timing. Full routes below retain every live patrol.
  const w = createWorld(broadcast);
  w.guards = [];
  place(w.agents[0], landmark(w, 'upload'));
  place(w.agents[1], landmark(w, 'mask'));
  return w;
}

describe('Public offering', () => {
  it('connects the campaign and has reachable controls, patrol points and cover edges', () => {
    expect(nextMission('custody')).toBe(broadcast);
    expect(nextMission('broadcast')).toBeUndefined();
    const w = createWorld(broadcast);
    const positions = [
      ...broadcast.landmarks,
      ...broadcast.spawns,
      ...broadcast.guards.flatMap((g) => g.patrol),
      ...broadcast.solids
        .flatMap((s) => [
          { x: s.x - 0.205, y: s.y + s.h / 2 },
          { x: s.x + s.w + 0.205, y: s.y + s.h / 2 },
          { x: s.x + s.w / 2, y: s.y - 0.205 },
          { x: s.x + s.w / 2, y: s.y + s.h + 0.205 },
        ])
        .filter((p) => passable(w, p)),
    ];
    for (const position of positions) {
      expect(passable(w, position), JSON.stringify(position)).toBe(true);
      const path = findPath(w, w.agents[0], position);
      expect(distance(path.at(-1)!, position)).toBeLessThan(0.001);
    }
  });

  it('holds LOOP across other orders and releases it on move, Hold, handoff or death', () => {
    const w = controlsFixture(),
      [a, b, c] = w.agents;
    interact(w, [b.id], 'mask');
    until(w, () => w.broadcast!.maskBy === b.id);
    interact(w, [a.id], 'upload');
    advance(w, 3);
    expect(w.broadcast).toMatchObject({ maskBy: b.id, uploadBy: a.id, trace: 0 });
    place(c, landmark(w, 'mask'));
    interact(w, [c.id], 'mask');
    until(w, () => w.broadcast!.maskBy === c.id);
    expect(b.order).toEqual({ kind: 'hold' });
    moveAgents(w, [c.id], { x: 6, y: 14 });
    step(w);
    expect(w.broadcast!.maskBy).toBeNull();
    expect(w.broadcast!.trace).toBeGreaterThan(0);
    interact(w, [b.id], 'mask');
    until(w, () => w.broadcast!.maskBy === b.id);
    expect(w.broadcast!.trace).toBe(0);
    hold(w, [b.id]);
    step(w);
    expect(w.broadcast!.maskBy).toBeNull();
    interact(w, [b.id], 'mask');
    until(w, () => w.broadcast!.maskBy === b.id);
    b.hp = 0;
    step(w);
    expect(w.broadcast!.maskBy).toBeNull();
  });

  it('saves both upload and trace on interruption; repeated orders and handoffs never double progress', () => {
    const w = controlsFixture(),
      [a, , c] = w.agents,
      b = w.broadcast!;
    interact(w, [a.id], 'upload');
    until(w, () => b.progress > 2);
    const saved = b.progress,
      trace = b.trace;
    hold(w, [a.id]);
    advance(w, 2);
    expect(b.progress).toBe(saved);
    expect(b.trace).toBe(trace);
    place(c, landmark(w, 'upload'));
    interact(w, [a.id], 'upload');
    interact(w, [c.id], 'upload');
    until(w, () => b.uploadBy === c.id);
    expect(a.order).toEqual({ kind: 'hold' });
    const before = b.progress;
    for (let i = 0; i < 30; i++) {
      interact(w, [c.id], 'upload');
      step(w);
    }
    expect(b.progress - before).toBeCloseTo(1);
    c.hp = 0;
    step(w);
    expect(b.uploadBy).toBeNull();
    expect(b.progress - before).toBeCloseTo(1);
    interact(w, [a.id], 'upload');
    until(w, () => published(w));
    expect(b.traced).toBe(true);
    expect(a.order).toEqual({ kind: 'hold' });
    expect(available(w, 'upload')).toBe(false);
    expect(available(w, 'mask')).toBe(false);
  });

  it.each([false, true])('a trace draws local guards, respecting RADIO disabled=%s', (relayOff) => {
    const w = controlsFixture(),
      a = w.agents[0];
    const p = { x: 29, y: 12.5 };
    w.guards = [makeGuard('listener', p, [p], Math.PI / 2)];
    expect(lineClear(w, p, a)).toBe(false);
    w.relayOff = relayOff;
    a.disguised = true;
    interact(w, [a.id], 'upload');
    until(w, () => w.broadcast!.traced);
    expect(w.guards[0].mode).toBe('combat');
    expect(w.guards[0].lastSeen).toMatchObject({ x: 29.5, y: 6.2 });
    expect(w.alarm).toBe(!relayOff);
    expect(w.message).toContain(relayOff ? 'no reinforcements' : 'Reinforcements called');
    expect(available(w, 'mask')).toBe(false);
    hold(w, [a.id]);
    advance(w, 7);
    expect(w.waves).toBe(relayOff ? 0 : 1);
    expect(w.broadcast!.traced).toBe(true);
  });

  it('releases cancelled work while paused and requires setup again before resuming', () => {
    const w = controlsFixture(),
      [a, b] = w.agents;
    applyCommand(w, { kind: 'interact', agents: [b.id], target: 'mask' });
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'upload' });
    advance(w, 2);
    const saved = w.broadcast!.progress,
      time = w.time;
    applyCommand(w, { kind: 'hold', agents: [a.id, b.id] });
    expect(w.broadcast).toMatchObject({ progress: saved, uploadBy: null, maskBy: null });
    expect(w.time).toBe(time);
    applyCommand(w, { kind: 'interact', agents: [b.id], target: 'mask' });
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'upload' });
    advance(w, 0.5);
    expect(w.broadcast!.progress).toBe(saved);
    advance(w, 0.4);
    expect(w.broadcast!.progress).toBeGreaterThan(saved);
    expect(w.broadcast!.trace).toBe(0);
  });

  it('requires free hands and makes a working armed operative unable to fire', () => {
    const w = controlsFixture(),
      [a, b] = w.agents;
    a.carrying = true;
    a.order = { kind: 'move', target: { x: 29, y: 7 } };
    interact(w, [a.id], 'upload');
    expect(a.order.kind).toBe('move');
    expect(w.message).toContain('Set the cargo down');
    place(b, a);
    interact(w, [a.id, b.id], 'upload');
    expect(b.order).toEqual({ kind: 'interact', target: 'upload' });
    b.weapon = true;
    const p = { x: 26.5, y: 6.2 };
    const g = makeGuard('sentry', p, [p], 0);
    g.mode = 'combat';
    g.target = b.id;
    g.known = [b.id];
    w.guards = [g];
    advance(w, 2);
    expect(g.hp).toBe(g.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(w.broadcast!.progress).toBeGreaterThan(0);
  });

  it('requires publication and every survivor at VAN, while LOG stays optional', () => {
    const w = controlsFixture();
    const van = landmark(w, 'extract');
    for (const a of w.agents) place(a, van);
    completeInteraction(w, w.agents[0], 'extract');
    expect(w.status).toBe('playing');
    expect(extractionStatus(w, 'extract').waiting).toContain('Publish');
    w.broadcast!.progress = broadcast.broadcast!.duration;
    place(w.agents[1], landmark(w, 'mask'));
    completeInteraction(w, w.agents[0], 'extract');
    expect(w.status).toBe('playing');
    expect(extractionStatus(w, 'extract').waiting).toContain('Vale');
    place(w.agents[1], van);
    completeInteraction(w, w.agents[0], 'extract');
    expect(w.status).toBe('won');
    expect(w.evidence).toBe('available');
    expect(w.message).toContain('audit is public');
  });

  it('guides split work, traced recovery and the final rally without requiring LOG', () => {
    const w = controlsFixture(),
      primary = () => missionGoals(w)[0];
    expect(primary().targets).toEqual(['mask', 'upload', 'disguise']);
    expect(guideLocation(w, 'upload')).toMatchObject({ tag: 'UPLINK', x: 29.5, y: 6.2 });
    interact(w, [w.agents[1].id], 'mask');
    until(w, () => !!w.broadcast!.maskBy);
    expect(primary().detail).toContain('Vale holds LOOP');
    expect(missionGoals(w)[1].optional).toBe(true);
    w.broadcast!.traced = true;
    expect(primary().targets).toEqual(['upload', 'relay']);
    expect(primary().detail).toContain('can no longer hide');
    w.broadcast!.progress = broadcast.broadcast!.duration;
    expect(primary().complete).toBe(true);
    expect(primary().targets).toEqual(['extract']);
    expect(missionGoals(w)[2].detail).toContain('LOG is optional');
  });

  it('publishes quietly in patrol windows and reproduces the full command replay', () => {
    const w = createWorld(broadcast),
      a = w.agents[0],
      ids = w.agents.map((p) => p.id);
    const build = buildInfo(process.cwd());
    const recorder = new Recorder(w, build, 'synthetic-broadcast', '2026-09-27T00:00:00.000Z');
    const send = (command: Command) => {
      recorder.command(command);
      applyCommand(w, command);
    };
    const wait = (predicate: () => boolean) => until(w, predicate, 70, () => recorder.afterStep());
    send({ kind: 'interact', agents: [ids[1]], target: 'mask' });
    send({ kind: 'move', agents: ids.slice(2), point: { x: 37.2, y: 26 } });
    send({ kind: 'interact', agents: [a.id], target: 'disguise' });
    wait(() => a.disguised);
    send({ kind: 'interact', agents: [a.id], target: 'relay' });
    wait(() => w.relayOff);
    send({ kind: 'interact', agents: [a.id], target: 'gate' });
    wait(() => w.gateOpen);
    let withdrawals = 0,
      savedWork = 0;
    for (let attempt = 0; attempt < 4 && !published(w); attempt++) {
      send({ kind: 'interact', agents: [a.id], target: 'upload' });
      // React to the visible suspicion meter, then watch the patrol leave westward.
      wait(() => published(w) || w.guards.some((g) => (g.suspicion[a.id] ?? 0) > 15));
      if (published(w)) break;
      withdrawals++;
      savedWork = Math.max(savedWork, w.broadcast!.progress);
      send({ kind: 'move', agents: [a.id], point: { x: 29, y: 12.5 } });
      wait(() => !a.path.length);
      wait(() => {
        const g = w.guards[2];
        return g.x < 25 && g.y > 12 && Math.cos(g.angle) < -0.5;
      });
    }
    expect(published(w)).toBe(true);
    expect(withdrawals).toBeGreaterThan(0);
    expect(savedWork).toBeGreaterThan(0);
    expect(w.broadcast!.maskBy).toBeNull();
    expect(w.agents[1].order).toEqual({ kind: 'hold' });
    send({ kind: 'move', agents: [ids[1]], point: { x: 6, y: 26 } });
    wait(() => !w.agents[1].path.length);
    send({ kind: 'interact', agents: ids, target: 'extract' });
    wait(() => w.status === 'won');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.broadcast!.traced).toBe(false);
    expect(w.guards.every((g) => g.hp === g.maxHp)).toBe(true);
    expect(w.agents.every((p) => p.hp === 100 && !p.exposed)).toBe(true);
    const bundle = parseReplay(JSON.stringify(recorder.bundle()));
    const result = verifyReplay(bundle, build);
    expect(result.error).toBeNull();
    expect(result.result).toEqual(bundle.result);
  });

  it('supports an armed advance, a traced upload, and extraction with the full crew', () => {
    const w = createWorld(broadcast),
      a = w.agents[0],
      ids = w.agents.map((p) => p.id);
    const send = (command: Command) => applyCommand(w, command);
    send({ kind: 'weapons', agents: ids });
    send({ kind: 'move', agents: ids, point: { x: 10.5, y: 17.8 } });
    until(w, () => w.agents.filter(living).every((p) => !p.path.length));
    send({ kind: 'interact', agents: ids, target: 'relay' });
    until(w, () => w.relayOff);
    for (const point of [
      { x: 13, y: 12.8 },
      { x: 23, y: 13.2 },
      { x: 29, y: 12.7 },
      { x: 29, y: 10.5 },
    ]) {
      send({ kind: 'move', agents: ids, point });
      until(w, () => w.agents.filter(living).every((p) => !p.path.length));
      send({ kind: 'heal', agents: w.agents.filter((p) => p.hp <= 55).map((p) => p.id) });
    }
    send({ kind: 'interact', agents: [a.id], target: 'upload' });
    until(w, () => published(w));
    send({ kind: 'interact', agents: ids, target: 'gate' });
    until(w, () => w.gateOpen);
    send({ kind: 'interact', agents: ids, target: 'extract' });
    until(w, () => w.status === 'won');
    expect(w.broadcast!.traced).toBe(true);
    expect(w.shots).toBeGreaterThan(0);
    expect(w.agents.some((p) => !p.medkit)).toBe(true);
    expect(w.agents.filter(living)).toHaveLength(4);
    expect(w.waves).toBe(0);
    expect(w.extractedAt).toBe('extract');
  });
});
