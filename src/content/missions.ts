import { depot } from './depot';
import { archive } from './archive';
import { transfer } from './transfer';
import { custody } from './custody';

export const missions = [depot, archive, transfer, custody];
export const nextMission = (id: string) => missions[missions.findIndex((m) => m.id === id) + 1];
