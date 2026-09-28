import { depot } from './depot';
import { archive } from './archive';
import { transfer } from './transfer';
import { custody } from './custody';
import { broadcast } from './broadcast';
import { severance } from './severance';
import { clearing } from './clearing';
import { mandate } from './mandate';

export const missions = [
  depot,
  archive,
  transfer,
  custody,
  broadcast,
  severance,
  clearing,
  mandate,
];
export const nextMission = (id: string) => missions[missions.findIndex((m) => m.id === id) + 1];
