import { describe, expect, it } from 'vitest';
import { broadcast } from '../src/content/broadcast';
import { severance } from '../src/content/severance';
import { createWorld, makeGuard } from '../src/sim/world';
import { equip, updateWeapon, WEAPONS, weaponRange } from '../src/sim/weapons';
import { shoot } from '../src/sim/combat';
import { applyCommand } from '../src/sim/commands';
import { suspicionRate, reportGunfire, updateAwareness } from '../src/sim/awareness';
import { maneuver, shareContact } from '../src/sim/tactics';
import { distance } from '../src/sim/types';
import { lineClear } from '../src/sim/navigation';
import { STEP, step } from '../src/sim/step';

function arena() {
  const w = createWorld({ ...broadcast, solids: [], guards: [] });
  w.gateOpen = true;
  const a = w.agents[0];
  Object.assign(a, { x: 5, y: 5, previous: { x: 5, y: 5 }, weapon: true });
  const g = makeGuard('guard-0', { x: 8, y: 5 }, [{ x: 8, y: 5 }], 0, 'pistol');
  g.cooldown = 100;
  w.guards = [g];
  return { w, a, g };
}

describe('mission weapons', () => {
  it('limits the new loadouts to operations five and six and gives sentries carbines', () => {
    expect(createWorld().agents.every((p) => !p.armament)).toBe(true);
    expect(createWorld(broadcast).agents.map((p) => p.armament!.kind)).toEqual([
      'pistol',
      'pistol',
      'carbine',
      'carbine',
    ]);
    const w = createWorld(severance);
    expect(w.agents.map((p) => p.armament!.kind)).toEqual([
      'pistol',
      'pistol',
      'shotgun',
      'carbine',
    ]);
    expect(w.guards.filter((g) => g.tactics).map((g) => g.armament!.kind)).toEqual([
      'carbine',
      'shotgun',
    ]);
  });

  it.each(['pistol', 'carbine', 'shotgun'] as const)(
    'shares %s damage, range, magazine and recovery across both sides',
    (kind) => {
      const { w, a, g } = arena(),
        spec = WEAPONS[kind];
      a.armament = equip(kind);
      g.armament = equip(kind);
      a.armament.settle = g.armament.settle = 0;
      g.cooldown = 0;
      g.x = a.x + spec.range + 0.01;
      expect(shoot(w, a, g, false)).toBe(false);
      g.x = a.x + spec.range - 0.01;
      expect(shoot(w, a, g, false)).toBe(true);
      expect(shoot(w, g, a, true)).toBe(true);
      expect(g.maxHp - g.hp).toBe(spec.damage);
      expect(a.maxHp - a.hp).toBe(spec.damage);
      expect(a.cooldown).toBe(g.cooldown);
      expect(a.armament.rounds).toBe(g.armament.rounds);
      expect(shoot(w, a, g, false)).toBe(false);
    },
  );

  it('requires a stationary carbine, while a shotgun attack actually closes to its own range', () => {
    const { w, a, g } = arena();
    a.armament = equip('carbine');
    applyCommand(w, { kind: 'move', agents: [a.id], point: { x: 5, y: 6 } });
    for (let i = 0; i < 10; i++) step(w);
    expect(w.shots).toBe(0);
    applyCommand(w, { kind: 'attack', agents: [a.id], target: g.id });
    for (let i = 0; i < 9; i++) step(w);
    expect(w.shots).toBe(0);
    for (let i = 0; i < 4; i++) step(w);
    expect(w.shots).toBeGreaterThan(0);
    a.armament = equip('shotgun');
    a.cooldown = 0;
    g.hp = 90;
    g.x = 15;
    applyCommand(w, { kind: 'attack', agents: [a.id], target: g.id });
    for (let i = 0; i < 120 && g.hp === 90; i++) step(w);
    expect(g.hp).toBeLessThan(90);
    expect(distance(a, g)).toBeLessThanOrEqual(weaponRange(a));
  });

  it('reloads once in simulation time, preserving progress through stowing, orders and movement', () => {
    const { w, a, g } = arena();
    a.armament = equip('shotgun');
    shoot(w, a, g, false);
    a.cooldown = 0;
    shoot(w, a, g, false);
    expect(a.armament.rounds).toBe(0);
    const before = a.armament.reload;
    applyCommand(w, { kind: 'weapons', agents: [a.id] });
    applyCommand(w, { kind: 'hold', agents: [a.id] });
    expect(a.armament.reload).toBe(before); // Paused commands cannot advance time.
    applyCommand(w, { kind: 'move', agents: [a.id], point: { x: 6, y: 6 } });
    for (let i = 0; i < 30; i++) step(w);
    expect(a.armament.reload).toBeCloseTo(before - 1);
    expect(a.armament.rounds).toBe(0);
    for (let i = 0; i < 30; i++) step(w);
    expect(a.armament.reload).toBe(0);
    expect(a.armament.rounds).toBe(2);
    updateWeapon(a, STEP, false);
    expect(a.armament.rounds).toBe(2);
  });

  it('keeps stowed long guns conspicuous and assigns KIT only to an eligible selected operative', () => {
    const w = createWorld(broadcast),
      [a, , c] = w.agents;
    expect(suspicionRate(w, c)).toBe(95);
    applyCommand(w, { kind: 'interact', agents: [c.id], target: 'disguise' });
    expect(c.order.kind).toBe('hold');
    expect(w.message).toContain('concealable pistol');
    applyCommand(w, { kind: 'interact', agents: [a.id, c.id], target: 'disguise' });
    expect(a.order).toEqual({ kind: 'interact', target: 'disguise' });
    expect(c.order.kind).toBe('hold');
    for (let i = 0; i < 150 && !a.disguised; i++) step(w);
    expect(a.disguised).toBe(true);
    expect(a.weapon).toBe(false);
  });

  it('moves a pressured sentry into real cover and keeps its route through subsequent shots', () => {
    const w = createWorld(broadcast),
      g = w.guards[3],
      a = w.agents[0];
    Object.assign(a, { x: 23, y: 13.7 });
    Object.assign(g, { hp: 64, lastSeen: { x: a.x, y: a.y }, mode: 'combat' });
    expect(maneuver(w, g, a)).toBe(true);
    expect(g.path.length).toBeGreaterThan(0);
    expect(lineClear(w, g.path.at(-1)!, a)).toBe(false);
    const route = structuredClone(g.path);
    reportGunfire(w, a);
    expect(g.path).toEqual(route);
  });

  it('shares observed positions with a nearby partner and sends that partner toward cover', () => {
    const w = createWorld(severance),
      sentry = w.guards[3],
      officer = w.guards[5],
      a = w.agents[0];
    Object.assign(a, { x: 16, y: 14.5 });
    shareContact(w, sentry, a);
    expect(officer.lastSeen).toEqual({ x: 16, y: 14.5 });
    a.y = 5; // An unseen move cannot update the shared position.
    expect(officer.lastSeen).toEqual({ x: 16, y: 14.5 });
    expect(maneuver(w, officer, undefined)).toBe(true);
    expect(distance(officer.path.at(-1)!, officer.lastSeen!)).toBeLessThan(
      distance(officer, officer.lastSeen!),
    );
  });

  it('introduces the specialist response pair only in Severance’s later wave', () => {
    const w = createWorld(severance);
    w.alarm = true;
    w.time = 6.1;
    updateAwareness(w, 0);
    expect(w.guards.filter((g) => g.id.startsWith('response-')).every((g) => !g.tactics)).toBe(
      true,
    );
    w.time = 30.1;
    updateAwareness(w, 0);
    expect(
      w.guards
        .filter((g) => g.id.startsWith('response-1') && g.tactics)
        .map((g) => g.armament!.kind),
    ).toEqual(['carbine', 'shotgun']);
  });
});
