import { describe, expect, it } from 'vitest';
import { countermand } from '../src/content/countermand';
import { missions, nextMission } from '../src/content/missions';
import { createWorld, makeGuard } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { available, extractionStatus, landmark } from '../src/sim/orders';
import { STEP, step } from '../src/sim/step';
import { canWalk, findPath, passable } from '../src/sim/navigation';
import { distance, living } from '../src/sim/types';
import type { ObjectKind, World } from '../src/sim/types';
import { equip, updateWeapon } from '../src/sim/weapons';
import { shoot } from '../src/sim/combat';
import { facingAngle, SHIELD_TURN, shieldFaces, turnShield } from '../src/sim/shield';
import { decayPressure, readiness, suppress } from '../src/sim/pressure';
import { sees } from '../src/sim/awareness';
import { extractionRequirement } from '../src/ui/extraction';
import { attackPreview, objectRequirement } from '../src/ui/interactions';
import { guideLocation, missionGoals } from '../src/ui/objectives';
import { earnedMedals } from '../src/ui/medals';
import { Aftermath } from '../src/render/aftermath';
import { Recorder, parseReplay, verifyReplay, stateHash } from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';

const advance = (w: World, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(w);
};
function arena() {
  const w = createWorld({ ...countermand, solids: [], guards: [] });
  w.gateOpen = true;
  const a = w.agents[0];
  Object.assign(a, { x: 5, y: 5, previous: { x: 5, y: 5 }, weapon: true });
  const g = makeGuard('guard-0', { x: 10, y: 5 }, [{ x: 10, y: 5 }], Math.PI, 'pistol', {
    role: 'shield',
    posts: [],
  });
  w.guards = [g];
  return { w, a, g };
}

describe('shield officers and bounded suppression', () => {
  it('protects only the actual frontal arc; side fire and a flash expose an ordinary body', () => {
    const { w, a, g } = arena();
    expect(g.maxHp).toBe(90);
    expect(attackPreview(w, [a.id], g).detail).toContain('Shield covers 1/1');
    expect(shoot(w, a, g, false)).toBe(true);
    expect(g.hp).toBeCloseTo(90 - 17 * 0.12);
    expect(w.sounds.at(-1)).toMatchObject({ kind: 'hit', metal: true });
    a.cooldown = 0;
    a.x = 10;
    a.y = 10;
    expect(shieldFaces(g, a)).toBe(false);
    expect(attackPreview(w, [a.id], g).detail).not.toContain('Shield covers');
    shoot(w, a, g, false);
    expect(g.hp).toBeCloseTo(90 - 17 * 1.12);
    a.cooldown = 0;
    a.x = 5;
    a.y = 5;
    g.disoriented = 1;
    shoot(w, a, g, false);
    expect(g.hp).toBeCloseTo(90 - 17 * 2.12);
    expect(w.sounds.at(-1)).toMatchObject({ kind: 'hit', metal: false });
  });
  it('uses a bounded turn for body, vision, protection and firing, including across the angle seam', () => {
    const { w, a, g } = arena();
    a.x = 15;
    g.angle = 0;
    expect(sees(w, g, a)).toBe(false);
    expect(shoot(w, g, a, true)).toBe(false);
    expect(a.hp).toBe(100);
    turnShield(g, 1);
    expect(Math.abs(facingAngle(g) - Math.PI)).toBeCloseTo(SHIELD_TURN);
    for (let i = 0; i < 100; i++) turnShield(g, STEP);
    expect(sees(w, g, a)).toBe(true);
    expect(shoot(w, g, a, true)).toBe(true);
    g.shield!.angle = Math.PI - 0.05;
    g.angle = -Math.PI + 0.05;
    turnShield(g, STEP);
    expect(g.shield!.angle).toBeCloseTo(Math.PI - 0.05 + SHIELD_TURN * STEP);
    g.disoriented = 1;
    const angle = facingAngle(g);
    turnShield(g, 1);
    expect(facingAngle(g)).toBe(angle);
  });
  it('pressures only living opponents in a clear lane, ending at the impact', () => {
    const { w, a, g } = arena();
    g.x = 13;
    const near = makeGuard('near', { x: 10, y: 5.9 }, [{ x: 10, y: 5.9 }]);
    const beyond = makeGuard('beyond', { x: 14, y: 5 }, [{ x: 14, y: 5 }]);
    const covered = makeGuard('covered', { x: 10, y: 4.1 }, [{ x: 10, y: 4.1 }]);
    w.guards.push(near, beyond, covered);
    w.mission = {
      ...w.mission,
      solids: [{ id: 'cover', x: 8, y: 4.2, w: 3, h: 0.3, height: 1.6, kind: 'wall' }],
    };
    a.armament = equip('support');
    a.armament.settle = 0;
    shoot(w, a, g, false);
    expect(g.pressure).toBe(0.5);
    expect(near.pressure).toBe(0.5);
    expect(beyond.pressure).toBeUndefined();
    expect(covered.pressure).toBeUndefined();
    expect(a.pressure).toBeUndefined();
    for (let i = 0; i < 10; i++) suppress(w, a, g, false);
    expect(g.pressure).toBe(1);
    decayPressure(g, 3);
    expect(g.pressure).toBeUndefined();
  });
  it('lets a constantly suppressed coil rifle finish charging, reload, and obey movement orders', () => {
    const { w, a, g } = arena();
    a.armament = equip('coil');
    a.pressure = 1;
    expect(readiness(a)).toBeCloseTo(0.4);
    let fired = false;
    for (let i = 0; i < 100 && !fired; i++) fired = shoot(w, a, g, false, STEP);
    expect(fired).toBe(true);
    a.armament.reload = 2;
    a.armament.rounds = 0;
    updateWeapon(a, 2, false);
    expect(a.armament.rounds).toBe(3);
    w.guards = [];
    applyCommand(w, { kind: 'move', agents: [a.id], point: { x: 5, y: 10 } });
    advance(w, 1);
    expect(a.y).toBeCloseTo(8.2);
    expect(a.armament.charging).toBeUndefined();
    expect(a.pressure).toBeGreaterThan(0);
  });
  it('turns shields and releases pressure in the aftermath without changing the recorded world', () => {
    const { w, g } = arena();
    w.status = 'lost';
    g.pressure = 1;
    g.patrol = [{ x: 15, y: 5 }];
    const before = stateHash(w),
      aftermath = new Aftermath(w);
    for (let i = 0; i < 12; i++) aftermath.update(0.1);
    const view = aftermath.world.guards[0];
    expect(view.x).toBeGreaterThan(g.x);
    expect(facingAngle(view)).not.toBe(facingAngle(g));
    expect(view.pressure).toBeLessThan(0.5);
    expect(stateHash(w)).toBe(before);
  });
  it('leaves earlier mission state shapes untouched', () => {
    for (const m of missions.filter((m) => Number(m.number) < 12)) {
      const w = createWorld(m);
      advance(w, 1);
      expect(w).not.toHaveProperty('recall');
      for (const p of [...w.agents, ...w.guards]) {
        expect(p).not.toHaveProperty('pressure');
        expect(p).not.toHaveProperty('shield');
      }
    }
  });
});

describe('Countermand contract', () => {
  it('requires the original, resets unfinished work, retains filed work and still requires cargo at extraction', () => {
    const w = createWorld({ ...countermand, solids: [], guards: [] });
    const [a, b] = w.agents;
    const file = landmark(w, 'file-recall');
    Object.assign(a, { x: file.x, y: file.y, previous: { x: file.x, y: file.y } });
    Object.assign(b, { x: file.x, y: file.y, previous: { x: file.x, y: file.y } });
    expect(objectRequirement(w, 'file-recall', [a.id])).toContain('carrier');
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'file-recall' });
    advance(w, 10);
    expect(w.recall!.filed).toBe(false);
    w.evidence = 'carried';
    a.carrying = true;
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'file-recall' });
    advance(w, 4);
    expect(a.interaction).toBeGreaterThan(3);
    expect(extractionStatus(w, 'extract').ready).toBe(false);
    applyCommand(w, { kind: 'hold', agents: [a.id] });
    expect(a.interaction).toBe(0);
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'file-recall' });
    advance(w, 4);
    applyCommand(w, { kind: 'drop', agents: [a.id] });
    expect(a.interaction).toBe(0);
    expect(a.order.kind).toBe('hold');
    applyCommand(w, { kind: 'interact', agents: [b.id], target: 'evidence' });
    advance(w, 1);
    applyCommand(w, { kind: 'interact', agents: [b.id], target: 'file-recall' });
    advance(w, 8);
    expect(w.recall!.filed).toBe(false);
    advance(w, 1.1);
    expect(w.recall!.filed).toBe(true);
    expect(available(w, 'file-recall')).toBe(false);
    expect(extractionRequirement(w)).toBeNull();
    applyCommand(w, { kind: 'drop', agents: [b.id] });
    expect(w.recall!.filed).toBe(true);
    expect(extractionRequirement(w)?.goal).toBe('evidence');
  });
  it('interrupts filing when a live flash hits the carrier, and drops the original on death', () => {
    const w = createWorld({ ...countermand, solids: [], guards: [] });
    const a = w.agents[0],
      file = landmark(w, 'file-recall');
    Object.assign(a, { x: file.x, y: file.y, previous: { x: file.x, y: file.y }, carrying: true });
    w.evidence = 'carried';
    Object.assign(w.agents[2], { x: file.x, y: file.y + 5 });
    applyCommand(w, { kind: 'interact', agents: [a.id], target: 'file-recall' });
    advance(w, 4);
    applyCommand(w, { kind: 'flash', agents: [w.agents[2].id], point: { x: file.x, y: file.y } });
    advance(w, 1.1);
    expect(a.disoriented).toBeGreaterThan(0);
    expect(a.interaction).toBe(0);
    advance(w, 1.6);
    expect(a.interaction).toBeLessThan(0.3);
    a.hp = 0;
    step(w);
    expect(w.evidence).toBe('available');
    expect(w.evidencePosition).toMatchObject({ x: file.x, y: file.y });
    expect(w.recall!.filed).toBe(false);
  });
  it('connects all authored positions, exposes valid locators and advances the campaign', () => {
    const w = createWorld(countermand);
    expect(nextMission('settlement')).toBe(countermand);
    expect(w.mission.daylight && w.mission.trackingCamera).toBe(true);
    expect(distance(landmark(w, 'relay'), countermand.spawns[0])).toBeGreaterThan(40);
    w.gateOpen = true;
    for (const point of [
      ...countermand.landmarks,
      ...countermand.spawns,
      ...countermand.guards.flatMap((g) => [...g.patrol, ...(g.tactic?.posts ?? [])]),
      ...countermand.response.spawns,
      ...countermand.response.patrol,
      ...countermand.response.specialists!.flatMap((t) => t.posts),
    ]) {
      expect(passable(w, point), JSON.stringify(point)).toBe(true);
      const path = findPath(w, countermand.spawns[0], point);
      expect(distance(path.at(-1) ?? countermand.spawns[0], point)).toBeLessThan(0.5);
      let from = countermand.spawns[0];
      for (const next of path) {
        expect(canWalk(w, from, next)).toBe(true);
        from = next;
      }
    }
    for (const goal of missionGoals(w))
      for (const target of goal.targets) expect(guideLocation(w, target)).not.toBeNull();
    expect(missionGoals(w).find((g) => g.id === 'evidence')!.optional).toBe(false);
  });
});

/** Only player commands alter these starting worlds. Every completion is replayed
 * against its recorded checkpoints, including movement, timings and recovery. */
function run() {
  const w = createWorld(countermand),
    ids = w.agents.map((a) => a.id),
    build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-countermand', '2026-09-30T00:00:00.000Z');
  const send = (c: Command) => {
    recorder.command(c);
    applyCommand(w, c);
  };
  const tick = () => {
    const hurt = w.agents.filter((a) => living(a) && a.hp <= 55 && a.medkit).map((a) => a.id);
    if (hurt.length) send({ kind: 'heal', agents: hurt });
    step(w);
    recorder.afterStep();
  };
  const wait = (done: () => boolean, limit = 90) => {
    for (let i = 0; i < limit / STEP && !done() && w.status === 'playing'; i++) tick();
    expect(
      done(),
      JSON.stringify({
        time: w.time,
        message: w.message,
        agents: w.agents.map((a) => ({ x: a.x, y: a.y, hp: a.hp, order: a.order })),
        guards: w.guards.map((g) => ({ id: g.id, x: g.x, y: g.y, hp: g.hp, mode: g.mode })),
      }),
    ).toBe(true);
    expect(
      w.agents.every(living),
      JSON.stringify({
        time: w.time,
        agents: w.agents.map((a) => ({ name: a.name, hp: a.hp, x: a.x, y: a.y })),
        guards: w.guards.map((g) => ({
          id: g.id,
          x: g.x,
          y: g.y,
          hp: g.hp,
          angle: g.angle,
          mode: g.mode,
        })),
      }),
    ).toBe(true);
  };
  const move = (agents: string[], x: number, y: number) => {
    send({ kind: 'move', agents, point: { x, y } });
    wait(() => w.agents.filter((a) => agents.includes(a.id)).every((a) => !a.path.length));
  };
  const act = (agents: string[], target: ObjectKind, done: () => boolean) => {
    send({ kind: 'interact', agents, target });
    wait(done);
  };
  const verify = () => {
    expect(w.status).toBe('won');
    expect(w.agents.every(living)).toBe(true);
    expect(w.evidence).toBe('extracted');
    expect(w.recall!.filed).toBe(true);
    expect(verifyReplay(parseReplay(JSON.stringify(recorder.bundle())), build).error).toBeNull();
  };
  return { w, ids, send, wait, move, act, verify };
}

describe('Countermand guarded completions', () => {
  it.each([false, true])(
    'punishes a straight loading-lane rush even with RADIO disabled: %s',
    (isolated) => {
      const w = createWorld(countermand),
        ids = w.agents.map((a) => a.id);
      w.relayOff = isolated;
      applyCommand(w, { kind: 'attack', agents: ids, target: 'guard-0' });
      for (let i = 0; i < 24 / STEP; i++) {
        applyCommand(w, {
          kind: 'heal',
          agents: w.agents.filter((a) => living(a) && a.hp <= 55 && a.medkit).map((a) => a.id),
        });
        step(w);
      }
      expect(w.alarm).toBe(!isolated);
      expect(w.agents.some((a) => !living(a))).toBe(true);
    },
  );
  it('draws the first shield away from Rook with a separate flanking threat', () => {
    const { w, ids, send, wait, move } = run();
    move(ids, 6, 33);
    send({ kind: 'attack', agents: [ids[2]], target: 'guard-0' });
    send({ kind: 'move', agents: [ids[3]], point: { x: 18, y: 23 } });
    wait(() => !w.agents[3].path.length);
    expect(w.guards[0].pressure).toBeGreaterThan(0);
    send({ kind: 'attack', agents: [ids[3]], target: 'guard-0' });
    wait(() => !living(w.guards[0]));
    expect(w.agents.every(living)).toBe(true);
    expect(w.agents[2].hp).toBe(100);
  });
  it('uses the north approach to flank the shield posts and extract the filed recall', () => {
    const { w, ids, send, wait, move, act, verify } = run();
    const fight = (target: string, fighters = ids) => {
      const g = w.guards.find((g) => g.id === target)!;
      if (!living(g)) return;
      send({ kind: 'attack', agents: fighters, target });
      wait(() => !living(g), 45);
      send({ kind: 'hold', agents: fighters });
    };
    move(ids, 6, 10.5);
    fight('guard-2');
    move(ids, 30, 8);
    fight('guard-3');
    fight('guard-4');
    act([ids[1]], 'relay', () => w.relayOff);
    move(ids, 47, 17);
    fight('guard-6');
    fight('guard-5');
    // Re-form at the east booth entrance before engaging its patrol. Leave the
    // pistol carriers sheltered while the long guns cover the doorway.
    move([ids[2], ids[3]], 55.8, 33);
    fight('guard-8', [ids[2], ids[3]]);
    for (const g of w.guards.filter((g) => living(g) && g.id.startsWith('response-'))) fight(g.id);
    act([ids[0]], 'evidence', () => w.agents[0].carrying);
    act([ids[0]], 'file-recall', () => w.recall!.filed);
    act([ids[1]], 'gate', () => w.gateOpen);
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBeGreaterThan(0);
    expect(living(w.guards[5])).toBe(false);
    expect(living(w.guards[6])).toBe(false);
    expect([0, 1, 7].every((i) => living(w.guards[i]))).toBe(true);
    verify();
  });

  it('uses maintenance access and patrol windows to recall dispatches without a kill', () => {
    const { w, ids, move, act, wait, verify } = run();
    act([ids[0]], 'disguise', () => w.agents[0].disguised);
    move([ids[0]], 6, 10.5);
    move([ids[0]], 30, 8);
    move([ids[0]], 39.5, 8);
    move([ids[0]], 42.5, 10);
    act([ids[0]], 'relay', () => w.relayOff);
    wait(() => w.guards[3].x < 36 && Math.cos(w.guards[3].angle) > 0);
    act([ids[0]], 'evidence', () => w.agents[0].carrying);
    move([ids[0]], 42.5, 10);
    move([ids[0]], 39.5, 10);
    move([ids[0]], 39.5, 5.15);
    move([ids[0]], 56, 5.15);
    move([ids[0]], 55.8, 16.5);
    move([ids[0]], 55.8, 29.4);
    wait(() => w.guards[8].x > 49 && w.guards[8].x < 50 && Math.cos(w.guards[8].angle) < 0);
    move([ids[0]], 55.8, 33);
    expect(
      w.shots,
      JSON.stringify({
        time: w.time,
        hp: w.agents[0].hp,
        guards: w.guards.map((g) => ({ id: g.id, mode: g.mode, known: g.known, x: g.x, y: g.y })),
      }),
    ).toBe(0);
    act([ids[0]], 'file-recall', () => w.recall!.filed);
    wait(() => w.guards[8].x > 49 && w.guards[8].x < 50 && Math.cos(w.guards[8].angle) < 0);
    move([ids[0]], 55.8, 33);
    move([ids[0]], 55.8, 29.4);
    act([ids[0]], 'gate', () => w.gateOpen);
    move([ids[0]], 59, 10);
    act(ids, 'extract', () => w.status === 'won');
    expect(w.shots).toBe(0);
    expect(w.agents.every((a) => a.hp === 100)).toBe(true);
    expect(w.guards.every(living)).toBe(true);
    expect(w.alarm).toBe(false);
    expect(earnedMedals(w)).toContain('nonlethal');
    verify();
  });
});
