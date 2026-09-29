import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { missions } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import type { Mission } from '../src/sim/types';
import { earnedMedals, medalsFor } from '../src/ui/medals';
import { parseReplay, ReplayPlayer } from '../src/replay/core';

const win = (id: Mission['id']) => {
  const w = createWorld(missions.find((m) => m.id === id)!);
  w.status = 'won';
  w.agents.forEach((a) => {
    a.captive = false;
  });
  return w;
};

it('requires a winning full-crew extraction for every challenge medal', () => {
  const w = win('injunction');
  expect(earnedMedals(w)).toContain('full-crew');
  w.agents[0].hp = 0;
  expect(earnedMedals(w)).toEqual(['complete']);
  w.status = 'lost';
  expect(earnedMedals(w)).toEqual([]);
});

it('keeps alarm, disguise and casualties as separate constraints', () => {
  const w = win('injunction');
  w.alarm = true;
  w.disguiseTaken = true;
  w.guards[0].hp = 0;
  expect(earnedMedals(w)).toEqual(['complete', 'full-crew', 'live-alarm', 'untraced']);
  w.relayOff = true;
  expect(earnedMedals(w)).not.toContain('live-alarm');
  expect(earnedMedals(w)).not.toContain('quiet'); // Silencing RADIO cannot undo an alarm.
});

it('counts courier and demolition casualties but not unmanned turrets for Nonlethal', () => {
  const transfer = win('transfer');
  transfer.guards.find((g) => g.id === 'courier')!.hp = 0;
  expect(earnedMedals(transfer)).not.toContain('nonlethal');
  const mandate = win('mandate');
  mandate.guards
    .filter((g) => g.turret)
    .forEach((g) => {
      g.hp = 0;
    });
  expect(earnedMedals(mandate)).toContain('nonlethal');
  const blast = win('severance');
  blast.guards[0].hp = 0;
  expect(earnedMedals(blast)).not.toContain('nonlethal');
});

it('offers only applicable challenges and checks mission-specific conditions', () => {
  const archive = win('archive');
  expect(earnedMedals(archive)).toContain('light-touch');
  archive.shutterBreached = true;
  expect(earnedMedals(archive)).not.toContain('light-touch');
  expect(medalsFor(archive.mission).some((m) => m.id === 'intel')).toBe(false);
  const transfer = win('transfer');
  expect(earnedMedals(transfer)).not.toContain('diversion');
  transfer.courier!.diverted = true;
  expect(earnedMedals(transfer)).toContain('diversion');
  transfer.guards.find((g) => g.id === 'courier')!.hp = 0;
  expect(earnedMedals(transfer)).not.toContain('diversion');
  const broadcast = win('injunction');
  expect(earnedMedals(broadcast)).not.toContain('intel');
  broadcast.evidence = 'extracted';
  broadcast.broadcast!.traced = true;
  expect(earnedMedals(broadcast)).toContain('intel');
  expect(earnedMedals(broadcast)).not.toContain('untraced');
  const mandate = win('mandate');
  mandate.security!.isolated = ['power-west', 'power-east'];
  expect(earnedMedals(mandate)).toContain('power-down');
  mandate.guards.find((g) => g.turret)!.hp = 0;
  expect(earnedMedals(mandate)).not.toContain('power-down');
  const rescue = win('personnel');
  expect(earnedMedals(rescue)).toContain('travel-light');
  rescue.agents[1].disarmed = false;
  expect(earnedMedals(rescue)).not.toContain('travel-light');
});

it('awards the human quiet Mission 10 completion with its original checkpoints', () => {
  const bundle = parseReplay(
    readFileSync('tests/replays/injunction-quiet-d4da9148.replay.json', 'utf8'),
  );
  // Deliberately skip the build-label gate; strict playback still compares every
  // original checkpoint against the current implementation of this night mission.
  const player = new ReplayPlayer(bundle, bundle.build);
  while (!player.done) player.advance();
  expect(player.error).toBeNull();
  expect(earnedMedals(player.world)).toEqual([
    'complete',
    'full-crew',
    'quiet',
    'nonlethal',
    'untraced',
  ]);
  expect(player.world.agents.every((a) => a.hp === 100)).toBe(true);
});
