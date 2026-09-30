import { expect, it } from 'vitest';
import { clearing } from '../src/content/clearing';
import { createWorld, makeGuard } from '../src/sim/world';
import { equip, COIL_CHARGE, updateWeapon, WEAPONS } from '../src/sim/weapons';
import { shoot } from '../src/sim/combat';
import { applyCommand } from '../src/sim/commands';
import { updateAwareness } from '../src/sim/awareness';
import { STEP, step } from '../src/sim/step';

function arena() {
  const w = createWorld({ ...clearing, solids: [], archive: undefined, guards: [] });
  w.gateOpen = true;
  w.relayOff = true;
  const a = w.agents[0];
  Object.assign(a, { x: 10, y: 10, previous: { x: 10, y: 10 }, weapon: true });
  const g = makeGuard('guard-0', { x: 20, y: 10 }, [{ x: 20, y: 10 }], Math.PI, 'coil', {
    role: 'marksman',
    posts: [{ x: 20, y: 10 }],
  });
  w.guards = [g];
  return { w, a, g };
}

it('requires the same uninterrupted charge, range and ammunition on both sides', () => {
  for (const hostile of [false, true]) {
    const { w, a, g } = arena();
    a.armament = equip('coil');
    const from = hostile ? g : a,
      to = hostile ? a : g;
    for (let i = 0; i < 36; i++) expect(shoot(w, from, to, hostile, STEP)).toBe(false);
    expect(to.hp).toBe(to.maxHp);
    expect(from.armament!.charging?.remaining).toBeCloseTo(COIL_CHARGE - 36 * STEP);
    const remaining = from.armament!.charging!.remaining;
    expect(shoot(w, from, to, hostile, 0)).toBe(false);
    expect(from.armament!.charging!.remaining).toBe(remaining);
    shoot(w, from, to, hostile, STEP);
    expect(shoot(w, from, to, hostile, STEP)).toBe(true);
    expect(to.hp).toBe(to.maxHp - WEAPONS.coil.damage);
    expect(from.armament!.rounds).toBe(2);
    expect(from.armament!.charging).toBeUndefined();
    expect(from.cooldown).toBe(WEAPONS.coil.interval);
  }
});

it('cancels a coil lock on movement, range, occlusion and target changes', () => {
  const { w, a, g } = arena();
  a.armament = equip('coil');
  shoot(w, a, g, false, 1);
  expect(a.armament.charging?.remaining).toBeCloseTo(0.25);
  a.path = [{ x: 11, y: 10 }];
  shoot(w, a, g, false);
  expect(a.armament.charging).toBeUndefined();
  a.path = [];
  shoot(w, a, g, false, 1);
  g.x = 24;
  shoot(w, a, g, false);
  expect(a.armament.charging).toBeUndefined();
  g.x = 20;
  shoot(w, a, g, false, 1);
  w.mission.solids = [{ id: 'screen', x: 15, y: 8, w: 1, h: 4, height: 2, kind: 'wall' }];
  shoot(w, a, g, false);
  expect(a.armament.charging).toBeUndefined();
  w.mission.solids = [];
  shoot(w, a, g, false, 1);
  g.id = 'guard-1';
  shoot(w, a, g, false, STEP);
  expect(a.armament.charging?.remaining).toBeCloseTo(COIL_CHARGE - STEP);
  expect(w.shots).toBe(0);
});

it('clears inactive locks when stowed, working, or when a marksman loses sight', () => {
  const { w, a, g } = arena();
  a.armament = equip('coil');
  shoot(w, a, g, false, 1);
  applyCommand(w, { kind: 'weapons', agents: [a.id] });
  expect(a.armament.charging).toBeUndefined(); // Orders cancel a lock even while paused.
  step(w);
  expect(a.armament.charging).toBeUndefined();
  a.weapon = true;
  shoot(w, a, g, false, 1);
  a.order = { kind: 'interact', target: 'override' }; // A working, stationary owner cannot keep charging.
  step(w);
  expect(a.armament.charging).toBeUndefined();
  Object.assign(g, { mode: 'combat', known: [a.id], target: a.id, lastSeen: { x: a.x, y: a.y } });
  updateAwareness(w, STEP);
  expect(g.armament!.charging).toBeDefined();
  w.mission.solids = [{ id: 'screen', x: 15, y: 8, w: 1, h: 4, height: 2, kind: 'wall' }];
  updateAwareness(w, STEP);
  expect(g.armament!.charging).toBeUndefined();
  expect(g.path).toEqual([]); // Holds its firing posts instead of pursuing through cover.
});

it('gives the automatic a mobile, short magazine burst followed by a real reload', () => {
  const { w, a, g } = arena();
  a.armament = equip('automatic');
  g.x = 14;
  g.hp = 1000;
  a.path = [{ x: 11, y: 10 }];
  for (let i = 0; i < WEAPONS.automatic.magazine; i++) {
    a.cooldown = 0;
    expect(shoot(w, a, g, false)).toBe(true);
  }
  expect(a.armament.rounds).toBe(0);
  expect(a.armament.reload).toBe(WEAPONS.automatic.reload);
  a.cooldown = 0;
  expect(shoot(w, a, g, false)).toBe(false);
  updateWeapon(a, WEAPONS.automatic.reload - STEP, true);
  expect(a.armament.rounds).toBe(0);
  updateWeapon(a, STEP + 1e-8, true);
  expect(a.armament.rounds).toBe(WEAPONS.automatic.magazine);
});

it('holds a legal coil charge when a walking target crosses the pursuit stop threshold', () => {
  const { w, a, g } = arena();
  a.armament = equip('coil');
  g.armament = equip('pistol');
  delete g.tactics;
  Object.assign(g, {
    x: 22.49,
    y: 10,
    previous: { x: 22.49, y: 10 },
    angle: Math.PI / 2,
    patrol: [{ x: 22.49, y: 20 }],
    path: [{ x: 22.49, y: 20 }],
  });
  applyCommand(w, { kind: 'attack', agents: [a.id], target: g.id });
  let starts = 0,
    wasCharging = false;
  for (let i = 0; i < 120 && g.hp === g.maxHp; i++) {
    step(w);
    const charging = !!a.armament.charging;
    if (charging && !wasCharging) starts++;
    wasCharging = charging;
  }
  expect(g.hp).toBe(g.maxHp - WEAPONS.coil.damage);
  expect(starts).toBe(1);
  expect(a.armament.rounds).toBe(2);
});
