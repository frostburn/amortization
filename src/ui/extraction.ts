import { finaleResolved } from '../sim/finale';
import { liftReady, liftRemaining } from '../sim/threshold';
import { kestrelRemoved } from '../sim/floors';
import { published } from '../sim/broadcast';
import { settled, settlementStatus } from '../sim/settlement';
import { demolished, detonationStatus } from '../sim/demolition';
import { landmark } from '../sim/orders';
import { living, requiresCargo } from '../sim/types';
import type { World } from '../sim/types';

/** Live extraction becomes actionable once the contract is secured, before the crew boards.
 * Recorded commands retain their original semantics so older attempts can still be replayed.
 */
export function extractionRequirement(
  world: World,
): { label: string; detail: string; goal: 'primary' | 'evidence' } | null {
  if (world.status === 'won') return null;
  if (world.finale)
    return finaleResolved(world)
      ? null
      : {
          label: 'Remove Dacre and Holt',
          detail:
            'Defeat Dacre, then cuff or eliminate Holt. A cuffed Holt must come up to the rooftop HELI with his escort.',
          goal: 'primary',
        };
  if (world.threshold && !liftReady(world))
    return {
      label: world.threshold.calledAt === null ? 'Call LIFT at LINK' : 'Wait for LIFT',
      detail:
        world.threshold.calledAt === null
          ? 'Recover KEY, then send its carrier to LINK for five seconds. The local lift bell draws the lobby reserve even with RADIO offline.'
          : `LIFT arrives in ${Math.ceil(liftRemaining(world)!)}s and will wait. Stage every survivor and KEY in the lobby.`,
      goal: 'primary',
    };
  if (world.recall && !world.recall.filed)
    return {
      label: 'File RECALL',
      detail:
        'Extraction locked: collect RECALL, then have its carrier work FILE for nine uninterrupted seconds. Bring the original to VAN afterward.',
      goal: 'primary',
    };
  if (world.settlement && !settled(world))
    return {
      label: world.settlement.reconciled ? 'Staff SIGN and CLEAR' : 'Reconcile REGISTER',
      detail: 'Extraction locked: ' + settlementStatus(world),
      goal: 'primary',
    };
  if (
    world.detention &&
    (world.agents.some((a) => a.captive || !living(a)) || !world.detention.released)
  )
    return {
      label: world.agents.some((a) => a.captive) ? 'Free Vale and Rook' : 'Release EXIT',
      detail:
        'Extraction locked: free both prisoners with a partner holding CELLS, then use EXIT inside to release the gates. All four must leave alive; GEAR and the register are optional.',
      goal: 'primary',
    };
  if (world.demolition && !demolished(world))
    return {
      label: 'Destroy both backups',
      detail: `Extraction locked: ${detonationStatus(world).reason || 'both charges are ready and the crew is clear.'} Use Detonate after everyone is clear. REGISTER is optional.`,
      goal: 'primary',
    };
  if (world.mission.broadcast && !published(world)) {
    const percent = Math.floor(
      (100 * world.broadcast!.progress) / world.mission.broadcast.duration,
    );
    return {
      label: 'Finish UPLINK',
      detail: `Extraction locked: finish UPLINK (${percent}% uploaded). Keep an operative working until ${world.mission.broadcast.subject ? 'the mandate is served' : 'the audit is published'}. LOG is optional.`,
      goal: 'primary',
    };
  }
  if (requiresCargo(world.mission) && !world.agents.some((a) => living(a) && a.carrying)) {
    const tag = landmark(world, 'evidence').tag;
    return {
      label: `Collect ${tag}`,
      detail: `Extraction locked: an operative must carry ${tag} before the crew can leave.`,
      goal: 'evidence',
    };
  }
  if (world.mission.continuity)
    return kestrelRemoved(world)
      ? null
      : {
          label: 'Remove Kestrel',
          detail: 'Extraction locked: arrest Kestrel upstairs, or eliminate her.',
          goal: 'primary',
        };
  const witness = world.escort;
  if (witness && (!witness.recruited || !living(witness)))
    return {
      label: `Rescue ${witness.name}`,
      detail: `Extraction locked: recruit ${witness.name} and bring them out alive. Optional cargo does not unlock the exit.`,
      goal: 'primary',
    };
  return null;
}
