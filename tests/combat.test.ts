import { describe, expect, it } from 'vitest';
import { createWorld, makeGuard } from '../src/sim/world';
import { reportGunfire, updateAwareness } from '../src/sim/awareness';
import { attack } from '../src/sim/orders';
import { step } from '../src/sim/step';
import { lineClear } from '../src/sim/navigation';

describe('security response', () => {
  it('survives a squad opening volley and returns fire at the same weapon range', () => {
    const w = createWorld();
    for (const a of w.agents) Object.assign(a, { x: 12, y: 22 });
    w.guards = [makeGuard('sentry', { x: 19.8, y: 22 }, [{ x: 19.8, y: 22 }])];
    attack(
      w,
      w.agents.map((a) => a.id),
      'sentry',
    );
    step(w);
    expect(w.guards[0].hp).toBeGreaterThan(0);
    expect(w.agents.some((a) => a.hp < a.maxHp)).toBe(true);
    expect(w.shots).toBe(5);
  });

  it('reports shots heard through cover without inventing a shooter identity', () => {
    const w = createWorld(),
      a = w.agents[0];
    Object.assign(a, { x: 17, y: 12 });
    w.guards = [makeGuard('listener', { x: 12, y: 12 }, [{ x: 12, y: 12 }])];
    expect(lineClear(w, w.guards[0], a)).toBe(false);
    reportGunfire(w, a);
    updateAwareness(w, 1);
    reportGunfire(w, a); // Sustained fire cannot keep postponing the report.
    expect(w.guards[0].radio).toBeCloseTo(1.5);
    expect(w.guards[0].target).toBeNull();
    updateAwareness(w, 1.6);
    expect(w.alarm).toBe(true);
    expect(w.known).toEqual([]);
    expect(w.shots).toBe(0);
  });

  it.each(['relay', 'guard'] as const)(
    'can interrupt a gunfire report by stopping the %s',
    (counter) => {
      const w = createWorld(),
        a = w.agents[0];
      Object.assign(a, { x: 17, y: 12 });
      w.guards = [makeGuard('listener', { x: 12, y: 12 }, [{ x: 12, y: 12 }])];
      reportGunfire(w, a);
      if (counter === 'relay') w.relayOff = true;
      else w.guards[0].hp = 0;
      updateAwareness(w, 3);
      expect(w.alarm).toBe(false);
    },
  );

  it('engages the nearest visible known threat instead of the last squad slot', () => {
    const w = createWorld(),
      g = makeGuard('sentry', { x: 16, y: 22 }, [{ x: 16, y: 22 }], 0);
    w.guards = [g];
    for (const [i, a] of w.agents.entries()) {
      Object.assign(a, { x: 18 + i, y: 22 });
      g.known.push(a.id);
      reportGunfire(w, a);
    }
    updateAwareness(w, 1 / 30);
    expect(g.target).toBe(w.agents[0].id);
    expect(w.agents[0].hp).toBeLessThan(100);
    expect(w.agents[3].hp).toBe(100);
  });

  it('brings support within six seconds of an alarm and stops further waves after radio sabotage', () => {
    const w = createWorld();
    w.alarm = true;
    w.time = 5.9;
    updateAwareness(w, 0);
    expect(w.waves).toBe(0);
    w.time = 6.1;
    updateAwareness(w, 0);
    expect(w.waves).toBe(1);
    w.relayOff = true;
    w.time = 60;
    updateAwareness(w, 0);
    expect(w.waves).toBe(1);
  });
});
