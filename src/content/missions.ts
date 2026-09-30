import { threshold } from './threshold';
import { continuity } from './continuity';
import { depot } from './depot';
import { archive } from './archive';
import { transfer } from './transfer';
import { custody } from './custody';
import { broadcast } from './broadcast';
import { severance } from './severance';
import { clearing } from './clearing';
import { mandate } from './mandate';
import { personnel } from './personnel';
import { injunction } from './injunction';
import { countermand } from './countermand';
import { settlement } from './settlement';

export const missions = [
  depot,
  archive,
  transfer,
  custody,
  broadcast,
  severance,
  clearing,
  mandate,
  personnel,
  injunction,
  settlement,
  countermand,
  continuity,
  threshold,
];
export const nextMission = (id: string) => missions[missions.findIndex((m) => m.id === id) + 1];
