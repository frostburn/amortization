import { published } from '../sim/broadcast';
import { demolished, detonationStatus } from '../sim/demolition';
import { landmark } from '../sim/orders';
import { living } from '../sim/types';
import type { World } from '../sim/types';

/** Live extraction becomes actionable once the contract is secured, before the crew boards.
 * Recorded commands retain their original semantics so older attempts can still be replayed.
 */
export function extractionRequirement(
  world: World,
): { label: string; detail: string; goal: 'primary' | 'evidence' } | null {
  if (world.status === 'won') return null;
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
      detail: `Extraction locked: finish UPLINK (${percent}% uploaded). Keep an operative working until the audit is published. LOG is optional.`,
      goal: 'primary',
    };
  }
  if (
    ['ledger', 'case'].includes(world.mission.objective) &&
    !world.agents.some((a) => living(a) && a.carrying)
  ) {
    const tag = landmark(world, 'evidence').tag;
    return {
      label: `Collect ${tag}`,
      detail: `Extraction locked: an operative must carry ${tag} before the crew can leave.`,
      goal: 'evidence',
    };
  }
  const witness = world.escort;
  if (witness && (!witness.recruited || !living(witness)))
    return {
      label: `Rescue ${witness.name}`,
      detail: `Extraction locked: recruit ${witness.name} and bring them out alive. Optional cargo does not unlock the exit.`,
      goal: 'primary',
    };
  return null;
}
