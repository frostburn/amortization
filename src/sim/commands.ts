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

/** Resolved gameplay intent, independent of selection, camera, and input device. */
export type Command =
  | { kind: 'move'; agents: string[]; point: Vec }
  | { kind: 'interact'; agents: string[]; target: ObjectKind }
  | { kind: 'attack'; agents: string[]; target: string }
  | { kind: 'hold' | 'weapons' | 'heal' | 'drop' | 'escort-aid'; agents: string[] }
  | { kind: 'escort-wait' };

export function applyCommand(world: World, command: Command) {
  if (world.status !== 'playing') return;
  switch (command.kind) {
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
  }
}
