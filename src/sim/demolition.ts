import { investigateNoise, raiseAlarm } from './awareness';
import { distance, isCharge, living } from './types';
import type { World } from './types';
import { notify } from './world';

export const demolished = (w: World) => !!w.demolition && w.demolition.detonatedAt !== null;

/** The marked circles are the blast boundary, including through intervening walls. */
export function detonationStatus(w: World) {
  const sites = w.mission.landmarks.filter((o) => isCharge(o.id));
  const remaining = sites.filter((o) => isCharge(o.id) && !w.demolition?.armed.includes(o.id));
  const unsafe = w.agents.filter(
    (a) =>
      living(a) && sites.some((o) => distance(a, o) <= (w.mission.demolition?.blastRadius ?? 0)),
  );
  const reason = !w.demolition
    ? 'No demolition contract.'
    : demolished(w)
      ? 'Both backups destroyed. Bring every survivor to VAN.'
      : remaining.length
        ? `Plant ${remaining.map((o) => o.tag).join(' and ')} first. Each charge needs ${w.mission.demolition!.armTime} seconds with free hands.`
        : unsafe.length
          ? `Move ${unsafe.map((a) => a.name).join(', ')} outside the marked blast areas. Walls do not protect the crew.`
          : null;
  return { ready: w.status === 'playing' && w.agents.some(living) && !reason, reason, unsafe };
}

export function detonate(w: World) {
  const status = detonationStatus(w);
  if (!status.ready) {
    if (status.reason) notify(w, status.reason);
    return;
  }
  w.demolition!.detonatedAt = w.time;
  const sites = w.mission.landmarks.filter((o) => isCharge(o.id));
  for (const guard of w.guards.filter(living)) {
    if (sites.some((o) => distance(guard, o) <= w.mission.demolition!.blastRadius)) {
      guard.hp = 0;
      guard.path = [];
      w.casualties++;
    }
  }
  for (const site of sites) {
    investigateNoise(w, site);
    w.sounds.push({ kind: 'blast', x: site.x, y: site.y });
  }
  raiseAlarm(w);
  notify(
    w,
    `Both debt backups destroyed. Extraction unlocked: bring every survivor to VAN.${w.relayOff ? ' RADIO is offline, but surviving guards heard the blast.' : ' Security has called reinforcements.'}`,
    'warning',
  );
}
