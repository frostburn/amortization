import { depot } from './depot';
import { archive } from './archive';

export const missions = [depot, archive];
export const nextMission = (id: string) => missions[missions.findIndex((m) => m.id === id) + 1];
