import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { countermand } from '../src/content/countermand';
import { ReplayPlayer, parseReplay } from '../src/replay/core';
import { shoot } from '../src/sim/combat';
import { evadeFire, receiveFire } from '../src/sim/incoming-fire';
import * as navigation from '../src/sim/navigation';
import { facingAngle, shieldFaces } from '../src/sim/shield';
import { STEP, step } from '../src/sim/step';
import { distance, living } from '../src/sim/types';
import { COIL_CHARGE } from '../src/sim/weapons';
import { createWorld, makeGuard } from '../src/sim/world';

function encounter(shield = true, cover = true) {
  const w = createWorld({
    ...countermand,
    guards: [],
    solids: cover ? [{ id: 'freight', x: 13, y: 9, w: 4, h: 1, height: 1.5, kind: 'crate' }] : [],
  });
  w.gateOpen = true;
  const a = w.agents[3];
  w.agents = [a];
  Object.assign(a, { x: 2.5, y: 7, previous: { x: 2.5, y: 7 }, weapon: false });
  const g = makeGuard(
    'guard',
    { x: 15, y: 7 },
    [{ x: 15, y: 7 }],
    Math.PI,
    'pistol',
    shield ? { role: 'shield', posts: [] } : undefined,
  );
  w.guards = [g];
  expect(shoot(w, a, g, false, COIL_CHARGE)).toBe(true);
  return { w, a, g };
}

describe('unheard incoming fire', () => {
  it.each([false, true])(
    'gets a surviving guard into physical cover without learning an unseen identity: shield %s',
    (shield) => {
      const { w, a, g } = encounter(shield);
      const source = { x: a.x, y: a.y };
      expect(g.mode).toBe('combat');
      expect(g.target).toBeNull();
      expect(g.known).toEqual([]);
      expect(g.radio).toBe(2.5);
      expect(evadeFire(w, g)).toBe(true);
      expect(navigation.lineClear(w, g.path.at(-1)!, source)).toBe(false);
      const path = structuredClone(g.path);
      receiveFire(w, g, a);
      expect(evadeFire(w, g)).toBe(true);
      expect(g.path).toEqual(path);
      // Moving the shooter silently cannot move the guard's remembered threat.
      Object.assign(a, { x: 1, y: 1, previous: { x: 1, y: 1 } });
      for (let i = 0; i < 4 / STEP; i++) step(w);
      expect(g.lastSeen).toEqual(source);
      expect(g.known).toEqual([]);
      expect(g.target).toBeNull();
      expect(navigation.lineClear(w, g, source)).toBe(false);
      if (shield) expect(shieldFaces(g, source)).toBe(true);
      expect(w.alarm).toBe(true);
    },
  );

  it('bounds failed cover searches and advances toward the last shot when there is no shelter', () => {
    const { w, a, g } = encounter(true, false);
    const search = vi.spyOn(navigation, 'findPath');
    try {
      Object.assign(a, { x: 1, y: 1, previous: { x: 1, y: 1 } });
      for (let i = 0; i < 0.9 / STEP; i++) step(w);
      expect(search.mock.calls.filter(([, from]) => from === g).length).toBeLessThanOrEqual(1);
      expect(g.x).toBeLessThan(15);
      expect(g.lastSeen).toEqual({ x: 2.5, y: 7 });
      expect(g.known).toEqual([]);
      expect(shieldFaces(g, { x: 2.5, y: 7 })).toBe(true);
    } finally {
      search.mockRestore();
    }
  });

  it('keeps the actual shield turn bounded and leaves a flashed officer exposed under distant fire', () => {
    const { w, a, g } = encounter();
    const angle = facingAngle(g);
    g.disoriented = 3;
    a.cooldown = 0;
    expect(shoot(w, a, g, false, COIL_CHARGE)).toBe(true);
    expect(g.hp).toBeCloseTo(90 - 52 * 0.12 - 52);
    for (let i = 0; i < 10; i++) step(w);
    expect(g.path).toEqual([]);
    expect(facingAngle(g)).toBe(angle);
    expect(shieldFaces(g, a)).toBe(false);
  });

  it.each(['7458f5ab', '669aab97', 'a2c4c905', 'a4df968b'])(
    'reacts to the recorded long-range opening in human run %s',
    (id) => {
      const bundle = parseReplay(
        readFileSync(`tests/fixtures/countermand-range-${id}.replay.json`, 'utf8'),
      );
      const player = new ReplayPlayer(bundle, bundle.build, true);
      const g = player.world.guards[0];
      // Keep the human commands untouched. These are exploit diagnostics, not
      // requirements to reproduce obsolete wins or to keep losing attempts lost.
      while (!player.done && !g.incoming) player.advance();
      expect(g.incoming).toBeDefined();
      expect(living(g)).toBe(true);
      expect(g.mode).toBe('combat');
      expect(g.path.length).toBeGreaterThan(0);
      const source = { ...g.incoming!.source },
        start = { x: g.x, y: g.y };
      expect(navigation.lineClear(player.world, g.path.at(-1)!, source)).toBe(false);
      let sheltered = false;
      for (let i = 0; i < 4 / STEP && !player.done; i++) {
        player.advance();
        sheltered ||= !navigation.lineClear(player.world, g, source);
      }
      expect(distance(g, start)).toBeGreaterThan(1);
      expect(sheltered).toBe(true);
    },
  );
});
