import { updateFinale } from './finale';
import {
  attack,
  dropEvidence,
  heal,
  hold,
  interact,
  moveAgents,
  toggleWeapons,
  treatEscort,
  waitEscort,
} from './orders';
import type { ObjectKind, Vec, World } from './types';
import { updateBroadcast } from './broadcast';
import { updateDetention } from './detention';
import { updateSettlement } from './settlement';
import { detonate } from './demolition';
import { throwFlash } from './flash';

/** Resolved gameplay intent, independent of selection, camera, and input device. */
export type Command =
  | { kind: 'move'; agents: string[]; point: Vec }
  | { kind: 'flash'; agents: string[]; point: Vec }
  | { kind: 'interact'; agents: string[]; target: ObjectKind }
  | { kind: 'attack'; agents: string[]; target: string }
  | { kind: 'hold' | 'weapons' | 'heal' | 'drop' | 'escort-aid'; agents: string[] }
  | { kind: 'escort-wait' }
  | { kind: 'detonate' };

export function applyCommand(world: World, command: Command) {
  if (world.status !== 'playing') return;
  switch (command.kind) {
    case 'flash':
      throwFlash(world, command.agents, command.point);
      break;
    case 'move':
      moveAgents(world, command.agents, command.point);
      break;
    case 'interact':
      interact(world, command.agents, command.target);
      break;
    case 'attack':
      attack(world, command.agents, command.target);
      break;
    case 'hold':
      hold(world, command.agents);
      break;
    case 'weapons':
      toggleWeapons(world, command.agents);
      break;
    case 'heal':
      heal(world, command.agents);
      break;
    case 'drop':
      dropEvidence(world, command.agents);
      break;
    case 'escort-aid':
      treatEscort(world, command.agents);
      break;
    case 'escort-wait':
      waitEscort(world);
      break;
    case 'detonate':
      detonate(world);
      break;
  }
  // Orders can be issued while paused. Release cancelled station work now so
  // the HUD reflects those orders without advancing upload or trace time.
  updateBroadcast(world, 0);
  updateDetention(world);
  updateSettlement(world, 0);
  updateFinale(world, 0);
}
