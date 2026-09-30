import { expect, it } from 'vitest';
import { threshold } from '../src/content/threshold';
import { broadcast } from '../src/content/broadcast';
import { settlement } from '../src/content/settlement';
import { mandate } from '../src/content/mandate';
import { continuity } from '../src/content/continuity';
import { stateHash } from '../src/replay/core';
import { raiseAlarm } from '../src/sim/awareness';
import { applyCommand } from '../src/sim/commands';
import { interact, landmark } from '../src/sim/orders';
import { STEP, step } from '../src/sim/step';
import { callLift } from '../src/sim/threshold';
import { position } from '../src/sim/types';
import type { ObjectKind, World } from '../src/sim/types';
import { createWorld } from '../src/sim/world';
import { mapTimers } from '../src/ui/map-timers';

const advance = (w: World, seconds: number) => {
  for (let i = 0; i < Math.round(seconds / STEP); i++) step(w);
};
const rows = (w: World, id: ObjectKind) => mapTimers(w).find((t) => t.target === id)?.rows ?? [];
function work(w: World, index: number, target: ObjectKind) {
  Object.assign(w.agents[index], position(landmark(w, target)));
  interact(w, [w.agents[index].id], target);
}

it('drains the current patrol deadline while RADIO work independently fills', () => {
  const w = createWorld({ ...threshold, guards: [] });
  expect(rows(w, 'relay')).toEqual([]);
  raiseAlarm(w);
  work(w, 0, 'relay');
  advance(w, 2);
  const [patrol, workBar] = rows(w, 'relay');
  expect(patrol.label).toBe('Patrol 1');
  expect(patrol.remaining).toBeCloseTo(4);
  expect(patrol.fraction).toBeCloseTo(4 / 6);
  expect(workBar.label).toBe('Disable');
  expect(workBar.remaining).toBeCloseTo(3);
  expect(workBar.fraction).toBeCloseTo(2 / 5);
  const before = stateHash(w);
  expect(rows(w, 'relay')).toEqual([patrol, workBar]);
  expect(stateHash(w)).toBe(before);
  advance(w, 3.1);
  expect(w.relayOff).toBe(true);
  expect(rows(w, 'relay')).toEqual([]);
});

it('resets the next patrol bar to its own interval and removes exhausted dispatches', () => {
  const w = createWorld(threshold);
  raiseAlarm(w);
  advance(w, 6.1);
  expect(w.waves).toBe(1);
  expect(rows(w, 'relay')[0].label).toBe('Patrol 2');
  expect(rows(w, 'relay')[0].remaining).toBeCloseTo(23.9);
  expect(rows(w, 'relay')[0].fraction).toBeCloseTo(23.9 / 24);
  advance(w, 24);
  expect(w.waves).toBe(2);
  expect(rows(w, 'relay')).toEqual([]);
});

it('does not start LINK work while walking and clears cancelled, dead or completed work', () => {
  const w = createWorld({ ...threshold, guards: [] });
  const a = w.agents[0];
  a.carrying = true;
  w.evidence = 'carried';
  interact(w, [a.id], 'key-lift');
  expect(rows(w, 'key-lift')).toEqual([]);
  work(w, 0, 'key-lift');
  advance(w, 2);
  expect(rows(w, 'key-lift')[0].remaining).toBeCloseTo(3);
  applyCommand(w, { kind: 'hold', agents: [a.id] });
  expect(rows(w, 'key-lift')).toEqual([]);
  work(w, 0, 'key-lift');
  advance(w, 1);
  a.hp = 0;
  expect(rows(w, 'key-lift')).toEqual([]);
});

it('shows lift arrival independently of LINK and keeps OPEN instead of a negative countdown', () => {
  const w = createWorld({ ...threshold, guards: [] });
  expect(rows(w, 'extract')).toEqual([]);
  callLift(w);
  advance(w, 9);
  expect(rows(w, 'extract')[0].label).toBe('Arrives');
  expect(rows(w, 'extract')[0].fraction).toBeCloseTo(0.5);
  expect(rows(w, 'extract')[0].remaining).toBeCloseTo(9);
  advance(w, 15);
  expect(rows(w, 'extract')[0]).toEqual({ label: 'Open · waiting', fraction: 1, tone: 'work' });
  w.status = 'won';
  expect(mapTimers(w)).toEqual([]);
  w.status = 'lost';
  expect(mapTimers(w)).toEqual([]);
});

it('preserves paused upload and trace progress and removes a masked trace', () => {
  const w = createWorld({ ...broadcast, guards: [] });
  work(w, 0, 'upload');
  advance(w, 2);
  const active = rows(w, 'upload');
  expect(active.map((r) => r.label)).toEqual(['Upload', 'Trace']);
  applyCommand(w, { kind: 'hold', agents: [w.agents[0].id] });
  advance(w, 2);
  expect(rows(w, 'upload')).toEqual(active.map((r) => ({ ...r, paused: true })));
  work(w, 1, 'mask');
  advance(w, 1);
  expect(rows(w, 'upload').map((r) => r.label)).toEqual(['Upload']);
  work(w, 0, 'upload');
  advance(w, broadcast.broadcast!.duration + 1);
  expect(rows(w, 'upload')).toEqual([]);
});

it('shows saved settlement work as paused until both stations are staffed', () => {
  const w = createWorld({ ...settlement, guards: [] });
  w.settlement!.reconciled = true;
  w.evidence = 'carried';
  w.agents[0].carrying = true;
  work(w, 0, 'settle');
  advance(w, 1);
  expect(rows(w, 'settle')[0]).toMatchObject({ fraction: 0, paused: true });
  work(w, 1, 'countersign');
  advance(w, 2);
  const progress = rows(w, 'settle')[0];
  expect(progress.paused).toBe(false);
  expect(progress.fraction).toBeGreaterThan(0);
  applyCommand(w, { kind: 'hold', agents: [w.agents[1].id] });
  advance(w, 2);
  expect(rows(w, 'settle')[0]).toEqual({ ...progress, paused: true });
});

it('shows the temporary turret shutdown even after INSPECT becomes unavailable', () => {
  const w = createWorld({
    ...mandate,
    guards: [],
    security: { ...mandate.security!, turrets: [] },
  });
  Object.assign(w.agents[0], { disguised: true, weapon: false });
  work(w, 0, 'authorise');
  advance(w, 3);
  expect(w.security!.inspectionUsed).toBe(true);
  expect(rows(w, 'authorise')[0].label).toBe('Turrets off');
  expect(rows(w, 'authorise')[0].remaining).toBeCloseTo(21);
  advance(w, 22);
  expect(rows(w, 'authorise')).toEqual([]);
});

it('hides work on another floor and never gives held SHUNT a fictitious deadline', () => {
  const w = createWorld({ ...continuity, guards: [] });
  work(w, 0, 'power-west');
  advance(w, 1);
  expect(mapTimers(w, 0).some((t) => t.target === 'power-west')).toBe(true);
  expect(mapTimers(w, 1)).toEqual([]);
  const t = createWorld({ ...threshold, guards: [] });
  work(t, 1, 'override');
  advance(t, 2);
  expect(rows(t, 'override')).toEqual([{ label: 'Held by Vale', fraction: 1, tone: 'work' }]);
  applyCommand(t, { kind: 'hold', agents: [t.agents[1].id] });
  expect(rows(t, 'override')).toEqual([]);
});
