import { depot } from './depot';
import { archive } from './archive';
import { transfer } from './transfer';

export const missions = [depot, archive, transfer];
export const nextMission = (id: string) => missions[missions.findIndex((m) => m.id === id) + 1];
