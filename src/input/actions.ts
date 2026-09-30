import type { Mission } from '../sim/types';

export type Action =
  | 'flash'
  | 'objectives'
  | `detention:${'access-intake' | 'access-cells' | 'escape-release'}`
  | `security:${'authorise' | 'power-west' | 'power-east'}`
  | `extract:${'extract' | 'alternate'}`
  | 'operations'
  | 'next'
  | `mission:${Mission['id']}`
  | 'pause'
  | 'sound'
  | `volume:${number}`
  | 'briefing'
  | 'begin'
  | 'restart'
  | 'all'
  | 'regroup'
  | 'hold'
  | 'weapons'
  | 'interact'
  | 'heal'
  | `heal:${number}`
  | 'locate-escort'
  | 'escort-wait'
  | 'escort-aid'
  | 'call-transfer'
  | `settlement:${'reconcile' | 'countersign' | 'settle'}`
  | 'work:file-recall'
  | 'work:mask'
  | 'work:upload'
  | 'work:breach'
  | 'plant:charge-west'
  | 'plant:charge-east'
  | 'detonate'
  | 'drop'
  | 'vision'
  | 'home'
  | 'follow'
  | 'zoom-in'
  | 'zoom-out';

// Each order's shortcut, label and help travel together. Controls and the HUD
// both consume these definitions, so the displayed key is the bound key.
export const ORDER_BUTTONS = [
  { id: 'regroup', key: 'g', label: 'Regroup', hint: 'Regroup at the lead selected operative' },
  { id: 'hold', key: 's', label: 'Hold', hint: 'Hold position' },
  { id: 'weapons', key: 'f', label: 'Draw weapons', hint: 'Draw or stow weapons' },
  { id: 'interact', key: 'e', label: 'Interact', hint: 'Interact with nearest object' },
] satisfies { id: Action; key: string; label: string; hint: string }[];
