import { describe, expect, it } from 'vitest';
import { missions } from '../src/content/missions';
import { depot } from '../src/content/depot';
import { archive } from '../src/content/archive';
import { transfer } from '../src/content/transfer';
import { custody } from '../src/content/custody';
import { createWorld } from '../src/sim/world';
import { completeInteraction, dropEvidence, landmark } from '../src/sim/orders';
import { courierGuard } from '../src/sim/courier';
import { guideLocation, missionGoals, transferFeedback } from '../src/ui/objectives';
import { extractionRequirement } from '../src/ui/extraction';
import type { GoalId } from '../src/ui/objectives';
import type { World } from '../src/sim/types';

const goal = (w: World, id: GoalId = 'primary') => missionGoals(w).find((g) => g.id === id)!;

describe('mission guidance', () => {
  it('locates the rescue and the available disguise, then follows a recruited witness', () => {
    const w = createWorld(depot);
    expect(goal(w).targets).toEqual(['escort', 'disguise']);
    completeInteraction(w, w.agents[0], 'disguise');
    expect(goal(w).targets).toEqual(['escort']);
    completeInteraction(w, w.agents[0], 'escort');
    w.escort!.x = 11;
    expect(goal(w).complete).toBe(true);
    expect(guideLocation(w, 'escort')!.x).toBe(11);
    expect(goal(w, 'evidence').optional).toBe(true);
  });

  it('explains both release options and stops recommending an unusable identity', () => {
    const w = createWorld(custody),
      a = w.agents[0];
    expect(goal(w).targets).toEqual(['disguise', 'release', 'breach']);
    completeInteraction(w, a, 'disguise');
    expect(goal(w).detail).toContain('Morrow');
    a.exposed = true;
    expect(goal(w).targets).toEqual(['breach']);
    expect(goal(w).detail).toContain('identity is lost or exposed');
    completeInteraction(w, a, 'breach');
    expect(goal(w).targets).toEqual(['escort']);
    expect(goal(w).detail).toContain('when the escape route is ready');
  });

  it('explains the shunt handoff and keeps a held control relevant until withdrawal', () => {
    const w = createWorld(archive),
      a = w.agents[1];
    expect(goal(w).targets).toEqual(['override', 'breach']);
    expect(goal(w, 'evidence').targets).toEqual(['evidence', 'override', 'breach']);
    const shunt = landmark(w, 'override');
    a.x = shunt.x;
    a.y = shunt.y;
    completeInteraction(w, a, 'override');
    expect(goal(w).detail).toContain('Vale is holding SHUNT');
    expect(goal(w).detail).toContain('Select a different operative');
    expect(goal(w).targets).toEqual(['override', 'evidence']);
    completeInteraction(w, w.agents[0], 'evidence');
    expect(goal(w).targets).toEqual(['override', 'extract']);
    expect(goal(w).detail).toContain('Bring the shunt operator');
  });

  it('asks for CALL after diversion and locates the moving courier until handover', () => {
    const w = createWorld(transfer),
      a = w.agents[0];
    completeInteraction(w, a, 'divert');
    expect(goal(w).label).toContain('Use CALL');
    expect(goal(w).complete).toBe(false);
    expect(goal(w).targets).toEqual(['dispatch', 'inspection']);
    completeInteraction(w, a, 'dispatch');
    expect(goal(w).targets).toEqual(['evidence', 'inspection']);
    courierGuard(w)!.x = 19;
    expect(guideLocation(w, 'evidence')!.x).toBe(19);
    w.courier!.phase = 'inspection';
    expect(goal(w).label).toContain('Collect CASE');
    courierGuard(w)!.mode = 'combat';
    expect(goal(w).detail).toContain('will not accept a signature');
    expect(goal(w).targets).toEqual(['evidence']);
  });

  it('distinguishes an uncalled diversion from a courier interrupted by combat or scrutiny', () => {
    const w = createWorld(transfer),
      a = w.agents[0],
      courier = courierGuard(w)!;
    // The 76590a8c run diverted after the alarm, but never issued CALL.
    w.alarm = true;
    completeInteraction(w, a, 'divert');
    expect(transferFeedback(w)).toMatchObject({
      status: 'DIVERT set · CALL still needed',
      needsCall: true,
      interrupted: false,
    });
    expect(goal(w).detail).toContain('alarm has not cancelled');
    expect(goal(w).detail).toContain('CALL has not been requested');
    completeInteraction(w, a, 'dispatch');
    expect(transferFeedback(w)).toMatchObject({ needsCall: false, interrupted: false });
    courier.mode = 'combat';
    expect(transferFeedback(w)?.status).toContain('in combat');
    expect(goal(w).detail).toContain('transfer is paused');
    courier.mode = 'challenge';
    expect(transferFeedback(w)?.status).toContain('checking an intruder');
    expect(goal(w).detail).not.toContain('will not accept a signature');
    courier.mode = 'patrol';
    expect(transferFeedback(w)?.status).toBe('Courier: moving to inspection');
    w.courier!.phase = 'inspection';
    courier.mode = 'challenge';
    expect(goal(w).label).toContain('Collect CASE');
    w.evidence = 'available';
    w.courier!.phase = 'secured';
    courier.mode = 'combat';
    expect(transferFeedback(w)?.status).toBe('Courier: CASE on the ground');
  });

  it('tracks carried evidence and a later drop without pointing back at its original shelf', () => {
    const w = createWorld(depot),
      a = w.agents[0];
    completeInteraction(w, a, 'evidence');
    a.x = 13;
    a.y = 16;
    expect(guideLocation(w, 'evidence')).toMatchObject({ x: 13, y: 16, tag: 'UNIT' });
    expect(goal(w, 'evidence').detail).toContain('Morrow carries UNIT');
    dropEvidence(w, [a.id]);
    a.x = 7;
    expect(guideLocation(w, 'evidence')).toMatchObject({ x: 13, y: 16 });
    expect(goal(w, 'evidence').complete).toBe(false);
  });

  it('shows both extraction requirements and only points to locations present in the mission', () => {
    const w = createWorld(custody),
      a = w.agents[0];
    const exit = landmark(w, 'alternate');
    a.x = exit.x;
    a.y = exit.y;
    expect(goal(w, 'extract').label).toContain('before extraction');
    expect(goal(w, 'extract').targets).toEqual(goal(w).targets);
    w.escort!.recruited = true;
    expect(goal(w, 'extract').detail).toContain('same extraction ring');
    expect(goal(w, 'extract').detail).toContain('SERVICE: 1/4 crew');
    expect(goal(w, 'extract').targets).toEqual(['extract', 'alternate', 'gate']);
    w.gateOpen = true;
    expect(goal(w, 'extract').targets).toEqual(['extract', 'alternate']);
    for (const mission of missions) {
      const world = createWorld(mission);
      for (const g of missionGoals(world))
        for (const id of g.targets) expect(guideLocation(world, id)).not.toBeNull();
    }
  });

  it.each(missions)('unlocks $id exits only when the required objective is secured', (mission) => {
    const w = createWorld(mission);
    expect(extractionRequirement(w)).not.toBeNull();
    // Optional evidence in rescue/broadcast missions must never enable the end action.
    w.evidence = 'carried';
    w.agents[0].carrying = true;
    if (w.settlement) {
      expect(extractionRequirement(w)).not.toBeNull();
      w.settlement.reconciled = true;
      w.settlement.progress = mission.settlement!.duration;
    } else if (w.detention) {
      expect(extractionRequirement(w)).not.toBeNull();
      w.agents.forEach((a) => {
        a.captive = false;
      });
      expect(extractionRequirement(w)?.label).toBe('Release EXIT');
      w.detention.released = true;
    } else if (w.demolition) {
      expect(extractionRequirement(w)?.detail).toContain('Detonate');
      w.demolition.armed = ['charge-west', 'charge-east'];
      expect(extractionRequirement(w)).not.toBeNull();
      w.demolition.detonatedAt = 0;
    } else if (w.broadcast) {
      w.broadcast.progress = 0.9333333333333332; // First exit attempt in replay 52011baa.
      expect(extractionRequirement(w)?.detail).toContain(
        `${Math.floor((100 * w.broadcast.progress) / mission.broadcast!.duration)}% uploaded`,
      );
      expect(goal(w, 'extract').targets).toContain('upload');
      w.broadcast.progress = mission.broadcast!.duration;
    } else if (w.escort) {
      expect(extractionRequirement(w)?.detail).toContain('recruit');
      w.escort.recruited = true;
    }
    expect(extractionRequirement(w)).toBeNull();
    expect(goal(w, 'extract').targets).toContain('extract');
    if (!w.broadcast && !w.escort && !w.demolition && !w.detention) {
      dropEvidence(w, [w.agents[0].id]);
      expect(extractionRequirement(w)?.goal).toBe('evidence');
      expect(goal(w, 'extract').targets).toContain('evidence');
      expect(goal(w, 'extract').targets).not.toContain('extract');
    }
  });

  it('does not send the player back into a locked archive for a ledger dropped outside it', () => {
    const w = createWorld(archive),
      a = w.agents[0];
    completeInteraction(w, a, 'evidence');
    a.x = 6;
    a.y = 15;
    dropEvidence(w, [a.id]);
    expect(w.shutterOpen).toBe(false);
    expect(goal(w).complete).toBe(true);
    expect(goal(w).targets).toEqual(['evidence', 'extract']);
    expect(goal(w, 'evidence').targets).toEqual(['evidence']);
    expect(goal(w, 'evidence').detail).toContain('Interact with LEDGER');
    expect(guideLocation(w, 'evidence')).toMatchObject({ x: 6, y: 15 });
  });
});
