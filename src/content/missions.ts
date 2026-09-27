import { depot } from './depot';
import { archive } from './archive';
import { transfer } from './transfer';
import { custody } from './custody';
import { broadcast } from './broadcast';

export const missions = [depot, archive, transfer, custody, broadcast];
export const nextMission = (id: string) => missions[missions.findIndex((m) => m.id === id) + 1];
