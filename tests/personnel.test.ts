import { describe, expect, it } from 'vitest';
import { personnel } from '../src/content/personnel';
import { nextMission } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { completeInteraction, extractionStatus, landmark } from '../src/sim/orders';
import { controllable, distance, living } from '../src/sim/types';
import type { ObjectKind, Vec } from '../src/sim/types';
import { findPath, passable } from '../src/sim/navigation';
import { updateDetention } from '../src/sim/detention';
import { step, STEP } from '../src/sim/step';
import { missionGoals, guideLocation } from '../src/ui/objectives';
import { extractionRequirement } from '../src/ui/extraction';
import { Recorder, parseReplay, verifyReplay } from '../src/replay/core';
import { buildInfo } from '../scripts/build-info';

const place = (person: Vec, position: Vec) => {
  person.x = position.x;
  person.y = position.y;
};

function run(dressWounds = false) {
  const w = createWorld(personnel),
    build = buildInfo(process.cwd());
  const recorder = new Recorder(w, build, 'synthetic-personnel', '2026-09-28T00:00:00.000Z');
  const send = (c: Command) => {
    recorder.command(c);
    applyCommand(w, c);
  };
  const wait = (predicate: () => boolean, limit = 80) => {
    for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) {
      if (dressWounds) {
        const wounded = w.agents
          .filter((a) => controllable(a) && a.medkit && a.hp <= 55)
          .map((a) => a.id);
        if (wounded.length) send({ kind: 'heal', agents: wounded });
      }
      step(w);
      recorder.afterStep();
    }
    expect(
      predicate(),
      JSON.stringify({
        message: w.message,
        time: w.time,
        agents: w.agents.map((a) => ({
          name: a.name,
          x: a.x,
          y: a.y,
          hp: a.hp,
          path: a.path,
          order: a.order,
        })),
        guards: w.guards.map((g) => ({ id: g.id, x: g.x, y: g.y, hp: g.hp })),
      }),
    ).toBe(true);
  };
  const move = (index: number, point: Vec) => {
    send({ kind: 'move', agents: [w.agents[index].id], point });
    wait(() => distance(w.agents[index], point) < 0.25);
  };
  const act = (index: number, target: ObjectKind, done: () => boolean) => {
    send({ kind: 'interact', agents: [w.agents[index].id], target });
    wait(done);
  };
  const verify = () => {
    expect(w.status).toBe('won');
    expect(w.agents.filter(living)).toHaveLength(4);
    expect(verifyReplay(parseReplay(JSON.stringify(recorder.bundle())), build).error).toBeNull();
  };
  return { w, send, wait, move, act, verify };
}

describe('Key personnel', () => {
  it('starts with two controllable operatives and rejects orders to captives', () => {
    const w = createWorld(personnel),
      ids = w.agents.map((a) => a.id);
    expect(nextMission('mandate')).toBe(personnel);
    expect(w.agents.filter(controllable).map((a) => a.name)).toEqual(['Morrow', 'Sable']);
    for (const command of [
      { kind: 'move', agents: ids, point: { x: 8, y: 27 } },
      { kind: 'weapons', agents: ids },
      { kind: 'attack', agents: ids, target: 'guard-0' },
      { kind: 'interact', agents: [ids[1], ids[2]], target: 'equipment' },
    ] as Command[])
      applyCommand(w, command);
    for (const i of [1, 2]) {
      expect(w.agents[i].order).toEqual({ kind: 'hold' });
      expect(w.agents[i].path).toEqual([]);
      expect(w.agents[i].weapon).toBe(false);
    }
    expect(extractionStatus(w, 'extract').ready).toBe(false);
    for (const goal of missionGoals(w))
      for (const id of goal.targets) expect(guideLocation(w, id)).not.toBeNull();
  });

  it('cannot bypass detention from any outside edge, even after RADIO or the road gate opens', () => {
    const w = createWorld(personnel);
    w.gateOpen = true;
    w.relayOff = true;
    const inside = [{ x: 19, y: 26 }, { x: 32, y: 16 }, w.agents[1], w.agents[2]];
    for (const from of [w.agents[0], { x: 32, y: 3 }, { x: 46, y: 20 }, { x: 32, y: 33 }])
      for (const to of inside) expect(findPath(w, from, to)).toEqual([]);
    for (const p of [
      ...personnel.landmarks,
      ...personnel.spawns,
      ...personnel.guards.flatMap((g) => g.patrol),
    ])
      expect(passable(w, p), JSON.stringify(p)).toBe(true);
  });

  it('requires a distinct live console operator at release time; safety edges do not power locks', () => {
    const w = createWorld(personnel),
      runner = w.agents[0],
      operator = w.agents[3];
    place(operator, landmark(w, 'access-cells'));
    completeInteraction(w, operator, 'access-cells');
    expect(w.detention!.open).toContain('access-cells');
    place(runner, landmark(w, 'rescue-vale'));
    applyCommand(w, { kind: 'interact', agents: [runner.id], target: 'rescue-vale' });
    for (let i = 0; i < 20; i++) step(w);
    applyCommand(w, { kind: 'hold', agents: [operator.id] });
    completeInteraction(w, runner, 'rescue-vale');
    expect(w.agents[1].captive).toBe(true);
    expect(w.message).toContain('two people');
    Object.assign(runner, { x: 30.15, y: 16 });
    w.detention!.open = ['access-cells'];
    updateDetention(w);
    expect(passable(w, runner)).toBe(true);
    expect(w.detention!.operator).toBeNull();
    completeInteraction(w, runner, 'rescue-vale');
    expect(w.agents[1].captive).toBe(true);
    Object.assign(runner, { x: 32.8, y: 10.5 });
    updateDetention(w);
    expect(w.detention!.open).toEqual([]);
    completeInteraction(w, operator, 'access-cells');
    completeInteraction(w, runner, 'rescue-vale');
    expect(w.agents[1].captive).toBe(false);
    expect(w.agents[1].disarmed).toBe(true);
    applyCommand(w, { kind: 'weapons', agents: [w.agents[1].id] });
    expect(w.agents[1].weapon).toBe(false);
    expect(extractionRequirement(w)?.label).toBe('Free Vale and Rook');
  });

  it('releases remote power on movement, supports handoff, and reports a lost rescuer', () => {
    const w = createWorld(personnel),
      operator = w.agents[3],
      partner = w.agents[0];
    place(operator, landmark(w, 'access-intake'));
    completeInteraction(w, operator, 'access-intake');
    applyCommand(w, { kind: 'move', agents: [operator.id], point: { x: 8, y: 25 } });
    expect(w.detention!.open).toEqual([]);
    expect(w.detention!.operator).toBeNull();
    place(operator, landmark(w, 'access-cells'));
    completeInteraction(w, operator, 'access-cells');
    place(partner, landmark(w, 'access-cells'));
    completeInteraction(w, partner, 'access-cells');
    expect(operator.order).toEqual({ kind: 'hold' });
    expect(w.detention!.operator).toBe(partner.id);
    partner.hp = 0;
    step(w);
    expect(w.detention!.open).toEqual([]);
    expect(w.status).toBe('lost');
    expect(w.message).toContain('Morrow was killed');
  });

  it('keeps powered releases usable after an identity is exposed and every guard is dead', () => {
    const w = createWorld(personnel),
      operator = w.agents[3],
      runner = w.agents[0];
    w.guards.forEach((g) => {
      g.hp = 0;
    });
    w.relayOff = true;
    place(runner, landmark(w, 'rescue-rook'));
    Object.assign(runner, { exposed: true, weapon: true });
    completeInteraction(w, runner, 'rescue-rook');
    expect(w.agents[2].captive).toBe(true);
    place(operator, landmark(w, 'access-cells'));
    completeInteraction(w, operator, 'access-cells');
    completeInteraction(w, runner, 'rescue-rook');
    expect(w.agents[2].captive).toBe(false);
    completeInteraction(w, runner, 'escape-release');
    expect(w.detention!.released).toBe(false);
    expect(w.message).toContain('after Vale and Rook');
  });

  it('recovers equipment and completes an armed withdrawal after a coordinated rescue, with an exact replay', () => {
    const { w, act, move, send, wait, verify } = run(true);
    act(0, 'disguise', () => w.agents[0].disguised);
    act(3, 'access-intake', () => w.detention!.circuit === 'access-intake');
    move(0, { x: 18, y: 26.5 });
    act(0, 'relay', () => w.relayOff);
    act(3, 'access-cells', () => w.detention!.circuit === 'access-cells');
    move(0, { x: 28, y: 25 });
    move(0, { x: 28, y: 16.5 });
    move(0, { x: 32, y: 16.5 });
    act(0, 'rescue-rook', () => !w.agents[2].captive);
    act(0, 'rescue-vale', () => !w.agents[1].captive);
    act(0, 'escape-release', () => w.detention!.released);
    // Bring the console operator inside before exposing the infiltrator.
    move(0, { x: 18, y: 26.5 });
    move(3, { x: 18, y: 26.5 });
    for (const index of [0, 1]) {
      send({ kind: 'attack', agents: ['agent-0', 'agent-3'], target: w.guards[index].id });
      wait(() => !living(w.guards[index]));
    }
    for (const point of [
      { x: 28, y: 25 },
      { x: 28, y: 16.5 },
      { x: 32, y: 20.5 },
    ]) {
      send({ kind: 'move', agents: ['agent-0', 'agent-3'], point });
      wait(() => [w.agents[0], w.agents[3]].every((a) => !a.path.length));
    }
    send({ kind: 'attack', agents: ['agent-0', 'agent-3'], target: 'guard-3' });
    wait(() => !living(w.guards[3]));
    move(0, { x: 32, y: 28 }); // Withdraw the wounded pistol carrier; Sable covers.
    send({ kind: 'attack', agents: ['agent-3'], target: 'guard-2' });
    wait(() => !living(w.guards[2]));
    act(2, 'equipment', () => !w.agents[2].disarmed);
    act(1, 'equipment', () => !w.agents[1].disarmed);
    send({ kind: 'interact', agents: w.agents.map((a) => a.id), target: 'extract' });
    wait(() => w.status === 'won');
    expect(w.shots).toBeGreaterThan(0);
    expect(w.agents[0].exposed).toBe(true);
    expect(w.agents.every((a) => !a.disarmed)).toBe(true);
    verify();
  });

  it('rescues and extracts all four quietly with live patrols, no recovered guns, and an exact replay', () => {
    const { w, act, move, send, wait, verify } = run();
    act(0, 'disguise', () => w.agents[0].disguised);
    act(3, 'access-intake', () => w.detention!.circuit === 'access-intake');
    move(0, { x: 18, y: 26.5 });
    act(0, 'relay', () => w.relayOff);
    act(3, 'access-cells', () => w.detention!.circuit === 'access-cells');
    move(0, { x: 28, y: 25 });
    move(0, { x: 28, y: 16.5 });
    move(0, { x: 32, y: 16.5 });
    act(0, 'rescue-vale', () => !w.agents[1].captive);
    act(0, 'rescue-rook', () => !w.agents[2].captive);
    act(0, 'escape-release', () => w.detention!.released);
    for (const index of [0, 1, 2]) {
      move(index, { x: 32, y: 16.5 });
      move(index, { x: 28, y: 16.5 });
      move(index, { x: 24, y: 16.5 });
      move(index, { x: 18, y: 17 });
      move(index, { x: 18, y: 26.5 });
      move(index, { x: 7, y: 27 });
    }
    send({ kind: 'interact', agents: w.agents.map((a) => a.id), target: 'extract' });
    wait(() => w.status === 'won');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.agents.every((a) => a.hp === a.maxHp)).toBe(true);
    expect(w.agents.filter((a) => a.disarmed)).toHaveLength(2);
    verify();
  });
});
