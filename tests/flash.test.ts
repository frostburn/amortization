import { describe, expect, it } from 'vitest';
import { injunction } from '../src/content/injunction';
import { severance } from '../src/content/severance';
import { createWorld, makeGuard } from '../src/sim/world';
import { applyCommand } from '../src/sim/commands';
import {
  flashPreview,
  throwFlash,
  updateFlashes,
  FLASH_FLIGHT,
  FLASH_FUSE,
  FLASH_RECOVERY,
} from '../src/sim/flash';
import { updateAwareness } from '../src/sim/awareness';
import { shoot } from '../src/sim/combat';
import { disoriented } from '../src/sim/types';
import { step } from '../src/sim/step';
import { completeInteraction, landmark } from '../src/sim/orders';
import { updateBroadcast } from '../src/sim/broadcast';

const arena = () => {
  const w = createWorld({ ...injunction, solids: [], guards: [] });
  for (const [i, a] of w.agents.entries())
    Object.assign(a, { x: 10, y: 10 + i, previous: { x: 10, y: 10 + i } });
  return w;
};

describe('flash grenades', () => {
  it('previews without changing orders and commits only one eligible throw, never walking into range', () => {
    const w = arena(),
      ids = w.agents.map((a) => a.id);
    const snapshot = structuredClone(w);
    expect(flashPreview(w, ids, { x: 15, y: 13 }).thrower?.name).toBe('Sable');
    expect(w).toEqual(snapshot);
    throwFlash(w, ids, { x: 30, y: 13 });
    expect(w.agents).toEqual(snapshot.agents);
    expect(w.flashGrenades).toEqual([]);
    throwFlash(w, ids, { x: 15, y: 13 });
    expect(w.flashGrenades).toHaveLength(1);
    expect(w.agents.map((a) => a.flashes)).toEqual([undefined, undefined, 1, 0]);
    w.mission = {
      ...w.mission,
      solids: [{ id: 'cover', kind: 'wall', x: 12, y: 8, w: 0.35, h: 8, height: 2 }],
    };
    expect(flashPreview(w, ids, { x: 15, y: 13 }).reason).toContain('blocked');
    throwFlash(w, ids, { x: 15, y: 13 });
    expect(w.flashGrenades).toHaveLength(1);
  });

  it('occludes the blast, warns about allies and preserves movement while disabling fire', () => {
    const w = arena(),
      a = w.agents[2],
      b = w.agents[0];
    Object.assign(b, { x: 15, y: 12, previous: { x: 15, y: 12 } });
    Object.assign(w.agents[1], { x: 15, y: 15, previous: { x: 15, y: 15 } });
    w.mission = {
      ...w.mission,
      solids: [{ id: 'cover', kind: 'wall', x: 13, y: 14, w: 4, h: 0.35, height: 2 }],
    };
    expect(flashPreview(w, [a.id], { x: 15, y: 12 }).exposed.map((p) => p.id)).toEqual([b.id]);
    applyCommand(w, { kind: 'move', agents: [b.id], point: { x: 17, y: 12 } });
    throwFlash(w, [a.id], { x: 15, y: 12 });
    updateFlashes(w, FLASH_FLIGHT + FLASH_FUSE);
    expect(disoriented(b)).toBe(true);
    expect(disoriented(w.agents[1])).toBe(false);
    const guard = makeGuard('target', { x: 16, y: 12 }, [{ x: 16, y: 12 }]);
    expect(shoot(w, b, guard, false)).toBe(false);
    step(w);
    expect(b.x).toBeGreaterThan(15);
    expect(b.order.kind).toBe('move');
    updateFlashes(w, FLASH_RECOVERY);
    expect(disoriented(b)).toBe(false);
  });

  it('continues existing radio reports while stunned and does not identify an unheard thrower', () => {
    const w = arena(),
      a = w.agents[2];
    const guard = makeGuard('listener', { x: 15, y: 12 }, [{ x: 15, y: 12 }], 0, 'pistol');
    w.guards = [guard];
    guard.radio = 2;
    throwFlash(w, [a.id], { x: 15, y: 12 });
    expect(guard.known).toEqual([]);
    updateFlashes(w, FLASH_FLIGHT + FLASH_FUSE);
    expect(disoriented(guard)).toBe(true);
    expect(guard.known).toEqual([]);
    updateAwareness(w, 2);
    expect(w.alarm).toBe(true);
    expect(guard.target).toBeNull();
    expect(shoot(w, guard, a, true)).toBe(false);
  });

  it('identifies a visible thrower and refreshes recovery without stacking durations', () => {
    const w = arena(),
      a = w.agents[2];
    const guard = makeGuard('witness', { x: 15, y: 12 }, [{ x: 15, y: 12 }], Math.PI, 'pistol');
    w.guards = [guard];
    throwFlash(w, [a.id], { x: 15, y: 12 });
    expect(guard.known).toContain(a.id);
    expect(guard.radio).toBe(2.5);
    updateFlashes(w, FLASH_FLIGHT + FLASH_FUSE);
    throwFlash(w, [w.agents[3].id], { x: 15, y: 12 });
    updateFlashes(w, FLASH_FLIGHT + FLASH_FUSE);
    expect(guard.disoriented).toBe(FLASH_RECOVERY);
  });

  it('pauses upload without losing progress and resets unfinished charge placement', () => {
    const w = arena(),
      a = w.agents[0];
    const terminal = landmark(w, 'upload');
    Object.assign(a, { x: terminal.x, y: terminal.y });
    a.order = { kind: 'interact', target: 'upload' };
    a.interaction = 0.8;
    completeInteraction(w, a, 'upload');
    w.broadcast!.progress = 4;
    a.disoriented = 1;
    updateBroadcast(w, 0.5);
    expect(w.broadcast!.progress).toBe(4);
    expect(w.broadcast!.uploadBy).toBeNull();
    const demolition = createWorld({ ...severance, flashGrenades: true });
    const planter = demolition.agents[0],
      point = landmark(demolition, 'charge-west');
    Object.assign(planter, { x: point.x, y: point.y });
    planter.order = { kind: 'interact', target: 'charge-west' };
    planter.interaction = 4;
    demolition.flashGrenades!.push({
      from: point,
      to: point,
      thrower: demolition.agents[2].id,
      age: 0,
    });
    updateFlashes(demolition, FLASH_FLIGHT + FLASH_FUSE);
    expect(planter.interaction).toBe(0);
    expect(disoriented(planter)).toBe(true);
  });

  it('shows a timed credential check and lets cover or distance cancel it', () => {
    const w = arena(),
      a = w.agents[0];
    a.disguised = true;
    Object.assign(a, { x: 11, y: 13 });
    const g = makeGuard('inspector', { x: 14, y: 13 }, [{ x: 14, y: 13 }], Math.PI, 'pistol', {
      role: 'inspector',
      posts: [{ x: 14, y: 13 }],
    });
    w.guards = [g];
    updateAwareness(w, 1);
    expect(g.inspection).toEqual({ target: a.id, progress: 1 });
    a.x = 9;
    updateAwareness(w, 0.1);
    expect(g.inspection).toBeUndefined();
    a.x = 11;
    updateAwareness(w, 1);
    w.mission = {
      ...w.mission,
      solids: [{ id: 'screen', kind: 'wall', x: 12, y: 11, w: 0.35, h: 4, height: 2 }],
    };
    updateAwareness(w, 0.1);
    expect(g.inspection).toBeUndefined();
    expect(g.known).not.toContain(a.id);
    w.mission = { ...w.mission, solids: [] };
    updateAwareness(w, 1);
    g.disoriented = 1;
    updateAwareness(w, 0.5);
    expect(g.inspection).toBeUndefined();
    expect(g.known).not.toContain(a.id);
    delete g.disoriented;
    updateAwareness(w, 2.4);
    expect(g.known).not.toContain(a.id);
    updateAwareness(w, 0.1);
    expect(g.known).toContain(a.id);
    expect(a.exposed).toBe(true);
  });
});
