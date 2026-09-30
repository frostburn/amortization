import { dispatchInvestigation } from './awareness';
import { notify } from './world';
import type { World } from './types';

export const liftRemaining = (w: World) =>
  w.threshold?.calledAt == null
    ? null
    : Math.max(0, w.threshold.calledAt + w.mission.threshold!.arrivalTime - w.time);
export const liftReady = (w: World) => liftRemaining(w) === 0;

export function callLift(w: World) {
  if (!w.threshold || w.threshold.calledAt !== null) return;
  w.threshold.calledAt = w.time;
  const link = w.mission.landmarks.find((o) => o.id === 'key-lift')!;
  const reserve = w.mission.threshold!.reserve.map((i) => `guard-${i}`);
  dispatchInvestigation(
    w,
    link,
    w.guards.filter((g) => reserve.includes(g.id)),
  );
  notify(
    w,
    `Lift called. ${w.mission.threshold!.arrivalTime}s to arrival. The wired bell has called the lobby reserve to LINK. Bring KEY and every survivor to LIFT.`,
    'warning',
  );
}

export function updateLift(w: World) {
  if (!w.threshold || w.threshold.announced || !liftReady(w)) return;
  w.threshold.announced = true;
  const door = w.mission.threshold!.door;
  w.sounds.push({ kind: 'interact', action: 'gate', ...door });
  notify(
    w,
    'LIFT has arrived and will wait. Bring KEY and every survivor into its ring, then order boarding.',
  );
}
