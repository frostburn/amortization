import { describe, expect, it } from 'vitest';
import { buildInfo } from '../scripts/build-info';
import { depot } from '../src/content/depot';
import { missions } from '../src/content/missions';
import { applyCommand } from '../src/sim/commands';
import type { Command } from '../src/sim/commands';
import { createWorld } from '../src/sim/world';
import { STEP, step } from '../src/sim/step';
import { distance } from '../src/sim/types';
import type { Mission } from '../src/sim/types';
import {
  compatibility,
  fingerprint,
  MAX_TICKS,
  parseReplay,
  Recorder,
  ReplayPlayer,
  stateHash,
  verifyReplay,
} from '../src/replay/core';

const build = buildInfo(process.cwd());
function attempt(mission: Mission = depot) {
  const world = createWorld(mission);
  const recorder = new Recorder(world, build, 'test-attempt', '2026-09-27T00:00:00.000Z');
  const send = (command: Command) => {
    recorder.command(command);
    applyCommand(world, command);
  };
  const advance = (ticks: number) => {
    for (let i = 0; i < ticks && world.status === 'playing'; i++) {
      step(world);
      recorder.afterStep();
      // The browser drains this queue at render rate, not simulation rate.
      if (i % 7 === 0) world.sounds.length = 0;
    }
  };
  const until = (predicate: () => boolean) => {
    for (let i = 0; i < 1800 && !predicate() && world.status === 'playing'; i++) advance(1);
    expect(predicate(), world.message).toBe(true);
  };
  return { world, recorder, send, advance, until };
}

describe('playtest replays', () => {
  it('reproduces a full quiet extraction from serialized commands and verifies every checkpoint', () => {
    const { world: w, recorder: r, send, until } = attempt();
    const a = w.agents[0],
      agents = [a.id];
    r.account(22, true, false);
    r.account(5, false, true);
    send({ kind: 'interact', agents, target: 'disguise' });
    until(() => a.disguised);
    send({ kind: 'interact', agents, target: 'relay' });
    until(() => w.relayOff);
    send({ kind: 'interact', agents, target: 'escort' });
    until(() => w.escort!.recruited);
    send({ kind: 'escort-wait' });
    send({ kind: 'escort-wait' });
    send({ kind: 'move', agents, point: { x: 4.8, y: 21.6 } });
    until(() => distance(a, { x: 4.8, y: 21.6 }) < 0.6);
    until(() => distance(w.escort!, { x: 4.5, y: 22.5 }) < 3.5);
    send({ kind: 'interact', agents, target: 'extract' });
    until(() => w.status === 'won');
    const bundle = parseReplay(JSON.stringify(r.bundle()));
    expect(bundle.checkpoints.length).toBeGreaterThan(5);
    expect(bundle.timing).toEqual({ activeSeconds: 5, planningSeconds: 22, slowSeconds: 5 });
    expect(bundle.endedBy).toBe('finished');
    expect(verifyReplay(bundle, build)).toEqual({
      tick: r.tick,
      error: null,
      result: bundle.result,
      currentRules: false,
    });
    r.account(99, true, false);
    expect(r.bundle()).toEqual(bundle);
  });

  it.each(missions)(
    'preserves same-tick ordering, recipient identity and unfinished snapshots in $id',
    (mission) => {
      const { world, recorder, send, advance } = attempt(mission);
      const agents = ['agent-0'];
      send({ kind: 'weapons', agents });
      agents[0] = 'agent-1';
      send({ kind: 'weapons', agents });
      send({ kind: 'move', agents: ['agent-0'], point: { x: 5, y: 20 } });
      send({ kind: 'hold', agents: ['agent-0'] });
      send({ kind: 'heal', agents });
      send({ kind: 'drop', agents });
      send({ kind: 'escort-aid', agents });
      send({ kind: 'attack', agents, target: 'guard-0' });
      const zeroTick = recorder.bundle();
      expect(zeroTick.commands[0].command).toEqual({ kind: 'weapons', agents: ['agent-0'] });
      expect(verifyReplay(parseReplay(JSON.stringify(zeroTick)), build).error).toBeNull();
      advance(333);
      const bundle = recorder.bundle();
      const player = new ReplayPlayer(parseReplay(JSON.stringify(bundle)), build);
      while (!player.done) player.advance();
      expect(player.error).toBeNull();
      expect(stateHash(player.world)).toBe(stateHash(world));
      expect(zeroTick.ticks).toBe(0);
      expect(bundle.ticks * STEP).toBeCloseTo(world.time);
    },
  );

  it('stops at the first divergent checkpoint and reports its tick and command position', () => {
    const { recorder, send, advance } = attempt();
    send({ kind: 'move', agents: ['agent-0'], point: { x: 5, y: 20 } });
    advance(320);
    const bundle = recorder.bundle();
    bundle.checkpoints[1].hash = '00000000';
    const result = verifyReplay(parseReplay(JSON.stringify(bundle)), build);
    expect(result.tick).toBe(150);
    expect(result.error).toContain('Tick 150, command 1');
  });

  it('distinguishes incompatible builds/configurations from current-rules outcome checks', () => {
    const { recorder, advance } = attempt();
    advance(10);
    const bundle = recorder.bundle();
    const changed = { ...build, simulationHash: 'a'.repeat(64) };
    expect(() => verifyReplay(bundle, changed)).toThrow('Simulation code differs');
    const definition = structuredClone(depot);
    definition.guards[0].position.x += 1;
    bundle.mission.definition = definition;
    bundle.mission.hash = fingerprint(definition);
    expect(compatibility(bundle, build)).toEqual([
      'Mission configuration differs from the recording.',
    ]);
    expect(() => verifyReplay(bundle, build)).toThrow('Mission configuration differs');
    expect(verifyReplay(bundle, changed, true).error).toBeNull();
    bundle.result.status = 'won';
    expect(verifyReplay(bundle, changed, true).error).toContain('current outcome is playing');
  });

  it('retains a frozen attempt across later gameplay and rejects malformed/unbounded files', () => {
    const { world, recorder, send, advance } = attempt();
    send({ kind: 'attack', agents: ['agent-0'], target: 'response-1-0' });
    advance(10);
    const frozen = recorder.finish('restart');
    step(world);
    expect(recorder.bundle()).toEqual(frozen);
    expect(parseReplay(JSON.stringify(frozen)).endedBy).toBe('restart');
    const bad = (change: (b: typeof frozen) => void) => {
      const b = structuredClone(frozen);
      change(b);
      expect(() => parseReplay(JSON.stringify(b))).toThrow();
    };
    bad((b) => {
      b.version = 2 as 1;
    });
    bad((b) => {
      b.ticks = MAX_TICKS + 1;
    });
    bad((b) => {
      b.commands[0].tick = 12;
    });
    bad((b) => {
      b.commands[0].command = { kind: 'move', agents: ['agent-0'], point: { x: Infinity, y: 0 } };
    });
    bad((b) => {
      b.checkpoints.shift();
    });
    bad((b) => {
      b.checkpoints.push(b.checkpoints[0]);
    });
    expect(() => parseReplay('{}')).toThrow('Unsupported');
  });

  it('accepts an earlier win under current rules without applying the remaining orders', () => {
    const { recorder, send, advance } = attempt();
    advance(1);
    send({ kind: 'weapons', agents: ['agent-0'] });
    advance(1);
    const bundle = recorder.bundle();
    bundle.result.status = 'won';
    const player = new ReplayPlayer(bundle, build, true);
    // State fixture: changed rules end the mission before the recorded weapon order.
    player.world.status = 'won';
    player.advance();
    expect(player.done).toBe(true);
    expect(player.error).toBeNull();
    expect(player.world.agents[0].weapon).toBe(false);
  });

  it('imports interactions with removed landmarks for explicit current-rules playback', () => {
    const { recorder, send, advance } = attempt();
    send({ kind: 'interact', agents: ['agent-0'], target: 'disguise' });
    advance(10);
    const bundle = recorder.bundle();
    const archived = structuredClone(depot);
    // A historical mission used this ID; it is no longer present in current mission code.
    const oldId = 'old-disguise' as 'disguise';
    archived.landmarks.find((item) => item.id === 'disguise')!.id = oldId;
    bundle.mission.definition = archived;
    bundle.mission.hash = fingerprint(archived);
    bundle.commands[0].command = { kind: 'interact', agents: ['agent-0'], target: oldId };
    const parsed = parseReplay(JSON.stringify(bundle));
    expect(() => verifyReplay(parsed, build)).toThrow('Mission configuration differs');
    expect(verifyReplay(parsed, build, true).error).toBeNull();
    bundle.commands[0].command = { kind: 'interact', agents: ['agent-0'], target: 'disguise' };
    expect(() => parseReplay(JSON.stringify(bundle))).toThrow('Unknown recorded mission item');
  });
});
