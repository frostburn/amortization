import { expect, it } from 'vitest';
import { createWorld } from '../src/sim/world';
import { stateHash } from '../src/replay/core';
import { recognisedOperatives, recognitionDetail } from '../src/ui/recognition';

it('distinguishes an investigation from recognition and follows a split selection', () => {
  const w = createWorld(),
    g = w.guards[0],
    [morrow, vale] = w.agents;
  g.mode = 'combat';
  g.suspicion[morrow.id] = 80;
  expect(recognisedOperatives(w, g, [morrow.id])).toEqual([]);
  g.known.push(morrow.id);
  g.suspicion[morrow.id] = 0;
  g.mode = 'patrol'; // Returning to patrol doesn't forget a face.
  const hash = stateHash(w);
  expect(recognisedOperatives(w, g, [vale.id])).toEqual([]);
  expect(recognisedOperatives(w, g, [morrow.id, vale.id])).toEqual([morrow]);
  expect(recognitionDetail(w, g, [morrow.id, vale.id])).toBe(
    'Identified in this selection: Morrow.',
  );
  expect(stateHash(w)).toBe(hash);
});

it('uses radio identities for guards, local identities for turrets, and ignores casualties', () => {
  const w = createWorld(),
    g = w.guards[0],
    a = w.agents[0];
  w.known.push(a.id);
  w.relayOff = true; // Silencing the radio cannot undo an earlier identification.
  expect(recognisedOperatives(w, g, [a.id])).toEqual([a]);
  g.turret = { circuit: 'power-west', homeAngle: 0, lock: 0 };
  expect(recognisedOperatives(w, g, [a.id])).toEqual([]);
  g.known.push(a.id);
  expect(recognisedOperatives(w, g, [a.id])).toEqual([a]);
  a.hp = 0;
  expect(recognisedOperatives(w, g, [a.id])).toEqual([]);
});
