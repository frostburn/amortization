import { describe, expect, it } from 'vitest';
import { custody } from '../src/content/custody';
import { createWorld, makeGuard } from '../src/sim/world';
import {
  available,
  completeInteraction,
  heal,
  interact,
  landmark,
  moveAgents,
  toggleWeapons,
  treatEscort,
  waitEscort,
} from '../src/sim/orders';
import { STEP, step } from '../src/sim/step';
import { distance, living } from '../src/sim/types';
import type { Vec, World } from '../src/sim/types';

function place(person: Vec, position: Vec) {
  person.x = position.x;
  person.y = position.y;
}

function advance(w: World, seconds: number) {
  for (let i = 0; i < seconds / STEP; i++) step(w);
}
function until(w: World, predicate: () => boolean, limit = 60) {
  for (let i = 0; i < limit / STEP && !predicate() && w.status === 'playing'; i++) step(w);
  expect(
    predicate(),
    `${w.message} / ${JSON.stringify({ time: w.time, escort: w.escort, agents: w.agents.map((a) => ({ x: a.x, y: a.y, hp: a.hp, order: a.order })) })}`,
  ).toBe(true);
}

describe('Protective custody', () => {
  it('requires unexposed, concealed maintenance cover for a release and leaves collection to the player', () => {
    const w = createWorld(custody),
      a = w.agents[0];
    expect(available(w, 'escort')).toBe(false);
    completeInteraction(w, a, 'escort');
    expect(w.escort!.recruited).toBe(false);
    completeInteraction(w, a, 'release');
    expect(w.escortLocked).toBe(true);
    a.disguised = true;
    a.weapon = true;
    completeInteraction(w, a, 'release');
    expect(w.escortLocked).toBe(true);
    a.weapon = false;
    a.exposed = true;
    completeInteraction(w, a, 'release');
    expect(w.escortLocked).toBe(true);
    a.exposed = false;
    completeInteraction(w, a, 'release');
    expect(w.escortLocked).toBe(false);
    expect(w.escort!.recruited).toBe(false);
    expect(available(w, 'escort')).toBe(true);
    expect(available(w, 'breach')).toBe(false);
    expect(w.alarm).toBe(false);
  });

  it('takes eight seconds to cut the transport and attracts local guards without radio service', () => {
    const w = createWorld(custody),
      a = w.agents[0];
    place(a, landmark(w, 'breach'));
    a.disguised = true;
    w.relayOff = true;
    interact(w, [a.id], 'breach');
    advance(w, 7);
    expect(w.escortLocked).toBe(true);
    advance(w, 1.2);
    expect(w.escortLocked).toBe(false);
    expect(w.guards.some((g) => g.mode === 'combat')).toBe(true);
    expect(w.escort!.hp).toBe(75);
    expect(w.escort!.recruited).toBe(false);
    expect(w.alarm).toBe(false);
  });

  it('recognizes and attacks the freed witness, and fails if she is killed', () => {
    const w = createWorld(custody),
      v = w.escort!;
    const p = { x: 25, y: 15.5 };
    w.guards = [makeGuard('sentry', p, [p], Math.PI / 2)];
    Object.assign(v, { x: 25, y: 17.5 });
    advance(w, 3);
    expect(w.shots).toBe(0);
    w.escortLocked = false;
    completeInteraction(w, w.agents[0], 'escort');
    waitEscort(w);
    advance(w, 0.8);
    expect(v.hp).toBe(75);
    advance(w, 3);
    expect(v.hp).toBeLessThan(75);
    expect(w.guards[0].target).toBe(v.id);
    expect(w.known).toContain(v.id);
    expect(w.agents.every((a) => !a.exposed)).toBe(true);
    until(w, () => w.status === 'lost');
    expect(w.message).toContain('Mara was killed');
    const kits = w.agents.map((a) => a.medkit);
    treatEscort(
      w,
      w.agents.map((a) => a.id),
    );
    expect(v.hp).toBe(0);
    expect(w.agents.map((a) => a.medkit)).toEqual(kits);
  });

  it('keeps a waiting witness in cover, supports handoff, and replaces a fallen escort', () => {
    const w = createWorld(custody),
      v = w.escort!,
      a = w.agents[0],
      b = w.agents[1];
    w.guards = [];
    w.escortLocked = false;
    Object.assign(v, { x: 14, y: 15 });
    Object.assign(a, { x: 14, y: 15 });
    completeInteraction(w, a, 'escort');
    waitEscort(w);
    moveAgents(w, [a.id], { x: 10, y: 15 });
    advance(w, 4);
    expect(distance(v, { x: 14, y: 15 })).toBe(0);
    waitEscort(w);
    until(w, () => distance(v, a) < 1.3);
    Object.assign(b, { x: v.x, y: v.y });
    completeInteraction(w, b, 'escort');
    expect(v.leader).toBe(b.id);
    b.hp = 0;
    step(w);
    expect(v.leader).toBe(a.id);
    expect(v.waiting).toBe(false);
  });

  it('spends one nearby, free-handed operative’s dressing on the witness', () => {
    const w = createWorld(custody),
      a = w.agents[0],
      v = w.escort!;
    w.escortLocked = false;
    completeInteraction(w, a, 'escort');
    v.hp = 10;
    treatEscort(w, [a.id]);
    expect(v.hp).toBe(10);
    expect(a.medkit).toBe(true);
    Object.assign(a, { x: v.x, y: v.y });
    a.carrying = true;
    treatEscort(w, [a.id]);
    expect(v.hp).toBe(10);
    a.carrying = false;
    treatEscort(w, [a.id]);
    expect(v.hp).toBe(65);
    expect(a.medkit).toBe(false);
    treatEscort(w, [a.id]);
    expect(v.hp).toBe(65);
  });

  it('requires a living witness and all survivors at one exit, not split between both', () => {
    const w = createWorld(custody),
      a = w.agents[0],
      v = w.escort!;
    const street = landmark(w, 'extract'),
      service = landmark(w, 'alternate');
    for (const p of w.agents) place(p, street);
    completeInteraction(w, a, 'extract');
    expect(w.status).toBe('playing');
    w.escortLocked = false;
    completeInteraction(w, a, 'escort');
    place(v, service);
    completeInteraction(w, a, 'extract');
    expect(w.status).toBe('playing');
    place(v, street);
    place(w.agents[3], service);
    completeInteraction(w, a, 'extract');
    expect(w.status).toBe('playing');
    place(w.agents[3], street);
    completeInteraction(w, a, 'extract');
    expect(w.status).toBe('won');
    expect(w.extractedAt).toBe('extract');
  });

  it('completes the covered service escape quietly with live patrols', () => {
    const w = createWorld(custody),
      a = w.agents[0],
      v = w.escort!;
    moveAgents(
      w,
      w.agents.slice(1).map((a) => a.id),
      { x: 5.4, y: 6.3 },
    );
    interact(w, [a.id], 'disguise');
    until(w, () => a.disguised);
    interact(w, [a.id], 'relay');
    until(w, () => w.relayOff);
    interact(w, [a.id], 'release');
    until(w, () => !w.escortLocked);
    interact(w, [a.id], 'escort');
    until(w, () => v.recruited);
    moveAgents(w, [a.id], { x: 24.4, y: 15 });
    until(w, () => !a.path.length);
    moveAgents(w, [a.id], { x: 10, y: 14.8 });
    until(w, () => !a.path.length);
    moveAgents(w, [a.id], { x: 5.4, y: 6.3 });
    until(w, () => distance(v, landmark(w, 'alternate')) < 3.5);
    interact(w, [a.id], 'alternate');
    until(w, () => w.status === 'won');
    expect(w.extractedAt).toBe('alternate');
    expect(w.shots).toBe(0);
    expect(w.alarm).toBe(false);
    expect(w.agents.every((a) => a.hp === 100)).toBe(true);
    expect(v.hp).toBe(75);
  });

  it('supports radio sabotage, a squad breach and a covered armed escape through the east street', () => {
    const w = createWorld(custody),
      ids = w.agents.map((a) => a.id),
      v = w.escort!;
    toggleWeapons(w, ids);
    moveAgents(w, ids, { x: 10.5, y: 11.5 });
    until(w, () => w.agents.filter(living).every((a) => !a.path.length));
    interact(w, ids, 'relay');
    until(w, () => w.relayOff);
    for (const p of [
      { x: 24.5, y: 15.3 },
      { x: 29.6, y: 18.5 },
    ]) {
      moveAgents(w, ids, p);
      until(w, () => w.agents.filter(living).every((a) => !a.path.length));
      advance(w, 2);
    }
    heal(w, ids);
    interact(w, ids, 'breach');
    until(w, () => !w.escortLocked);
    interact(w, ids, 'escort');
    until(w, () => v.recruited);
    waitEscort(w);
    interact(w, ids, 'gate');
    until(w, () => w.gateOpen);
    moveAgents(w, ids, { x: 33.5, y: 21 });
    until(w, () => w.agents.filter(living).every((a) => !a.path.length));
    advance(w, 5);
    heal(w, ids);
    waitEscort(w);
    moveAgents(w, ids, { x: 35.5, y: 25 });
    until(w, () => distance(v, landmark(w, 'extract')) < 3.5);
    interact(w, ids, 'extract');
    until(w, () => w.status === 'won');
    expect(w.relayOff).toBe(true);
    expect(w.waves).toBe(0);
    expect(w.shots).toBeGreaterThan(0);
    expect(w.agents.filter(living)).toHaveLength(4);
    expect(v.hp).toBeGreaterThan(0);
    expect(w.extractedAt).toBe('extract');
  });
});
