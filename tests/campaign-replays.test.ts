import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { buildInfo } from '../scripts/build-info';
import { compatibility, parseReplay, ReplayPlayer } from '../src/replay/core';
import { earnedMedals, medalsFor } from '../src/ui/medals';
import { interact } from '../src/sim/orders';
import { step } from '../src/sim/step';
import { inside, living } from '../src/sim/types';
import { intersects } from '../src/sim/navigation';

const build = buildInfo(process.cwd());
function replay(file: string) {
  const bundle = parseReplay(readFileSync(file, 'utf8'));
  const p = new ReplayPlayer(bundle, build, compatibility(bundle, build).length > 0);
  while (!p.done) p.advance();
  expect(p.error).toBeNull();
  return p.world;
}

it.each(['depot', 'archive'])(
  'the human 100%% campaign can still earn every %s medal',
  (mission) => {
    const files = readdirSync('tests/replays').filter((n) => n.startsWith(`${mission}-medals-`));
    const worlds = files.map((f) => replay(`tests/replays/${f}`));
    const earned = new Set(worlds.flatMap(earnedMedals));
    expect(worlds.every((w) => w.status === 'won' && w.agents.every(living))).toBe(true);
    expect([...earned].sort()).toEqual(
      medalsFor(worlds[0].mission)
        .map((m) => m.id)
        .sort(),
    );
  },
);

it('offers a reachable inside CUT in the reported archive trap', () => {
  const w = replay('tests/fixtures/archive-trapped-0295743a.replay.json');
  expect(w.shutterOpen).toBe(false);
  expect(w.agents.filter(living).every((a) => inside(a, w.mission.secure))).toBe(true);
  const free = w.agents.find((a) => living(a) && !a.carrying)!;
  interact(w, [free.id], 'breach');
  expect(free.path.length).toBeGreaterThan(0);
  for (let i = 0; i < 360 && !w.shutterBreached; i++) step(w);
  expect(w.shutterBreached).toBe(true);
});

it('keeps the recorded west-street extraction rally outside the hostile annex', () => {
  const bundle = parseReplay(
    readFileSync('tests/fixtures/archive-return-7be4687d.replay.json', 'utf8'),
  );
  const p = new ReplayPlayer(bundle, build, true);
  while (p.tick < 1120) p.advance();
  const w = p.world;
  expect(w.agents[0].carrying).toBe(true);
  for (const a of w.agents) {
    expect(inside(a, w.mission.restricted)).toBe(false);
    expect(a.path.length).toBeGreaterThan(0);
    expect(
      a.path.some((point, i) => intersects(i ? a.path[i - 1] : a, point, w.mission.restricted)),
    ).toBe(false);
  }
  // Isolate route completion from pursuit fire: the recorded carrier has 20 HP.
  // The unmodified successful recordings separately verify combat survivability.
  w.guards = [];
  for (let i = 0; i < 1500 && w.status === 'playing'; i++) step(w);
  expect(w.status).toBe('won');
  expect(w.agents.every(living)).toBe(true);
});
