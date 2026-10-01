import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { missions } from '../src/content/missions';
import { createWorld } from '../src/sim/world';
import type { Mission } from '../src/sim/types';
import { earnedMedals, medalsFor } from '../src/ui/medals';
import { fingerprint, parseReplay, ReplayPlayer } from '../src/replay/core';

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
  // Skip the build label and Quill's changed mission copy; strict playback still
  // compares every original checkpoint and the result against current rules.
  bundle.mission.hash = fingerprint(missions.find((m) => m.id === bundle.mission.id));
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

it.each([
  ['broadcast', ['42048895', '740307a2', 'ec959f54', 'f8b2c49a']],
  ['severance', ['2f9a7242', '37611591', 'bdbb0b9a', 'e366104a', 'e3aa7439', 'e73b41fe']],
  ['clearing', ['985e3e2b', 'ddbce34b']],
  ['mandate', ['e345eb76', 'd1724911', '39124e87']],
  ['personnel', ['9892e832', 'b8923bce', '6bf37c05']],
] as const)(
  'the human %s runs collectively earn every medal with exact checkpoints',
  (mission, ids) => {
    const collected = new Set<string>();
    for (const id of ids) {
      const bundle = parseReplay(
        readFileSync(`tests/replays/${mission}-human-${id}.replay.json`, 'utf8'),
      );
      // Build labels and Quill's presentation copy changed. Keep every original
      // state checkpoint and result, independently of those metadata gates.
      bundle.mission.hash = fingerprint(missions.find((m) => m.id === bundle.mission.id));
      const player = new ReplayPlayer(bundle, bundle.build);
      while (!player.done) player.advance();
      expect(player.error, id).toBeNull();
      const medals = earnedMedals(player.world);
      medals.forEach((medal) => collected.add(medal));
      if (player.world.agents.some((a) => a.hp <= 0)) expect(medals, id).toEqual(['complete']);
      if (id === '2f9a7242') {
        expect(player.world.shots).toBe(0);
        expect(medals).not.toContain('nonlethal'); // The charges killed guards.
      }
    }
    expect([...collected].sort()).toEqual(
      medalsFor(missions.find((m) => m.id === mission)!)
        .map((m) => m.id)
        .sort(),
    );
  },
);

it('covers every Personnel medal with the human escape and two explicitly authored routes', () => {
  const mission = missions.find((m) => m.id === 'personnel')!;
  const collected = new Set<string>();
  const routes = [
    {
      file: 'replays/personnel-human-9892e832.replay.json',
      medals: ['complete', 'full-crew', 'quiet', 'nonlethal', 'travel-light'],
    },
    {
      file: 'fixtures/personnel-authored-open-channel.replay.json',
      medals: ['complete', 'full-crew', 'nonlethal', 'live-alarm', 'travel-light'],
    },
    {
      file: 'fixtures/personnel-authored-no-disguise.replay.json',
      medals: ['complete', 'full-crew', 'quiet', 'no-kit', 'intel', 'travel-light'],
    },
  ];
  for (const { file, medals } of routes) {
    const bundle = parseReplay(readFileSync(`tests/${file}`, 'utf8'));
    // Only briefing advice changed. Keep all original checkpoint/result checks,
    // bypassing presentation metadata and the source-build label in memory.
    bundle.mission.hash = fingerprint(mission);
    const player = new ReplayPlayer(bundle, bundle.build);
    while (!player.done) player.advance();
    expect(player.error, file).toBeNull();
    const earned = earnedMedals(player.world);
    expect(earned, file).toEqual(medals);
    earned.forEach((medal) => collected.add(medal));
  }
  expect([...collected].sort()).toEqual(
    medalsFor(mission)
      .map((m) => m.id)
      .sort(),
  );
});
