import { dispatchInvestigation, investigateNoise, raiseAlarm } from './awareness';
import { lineClear } from './navigation';
import { disoriented, distance, living } from './types';
import type { Operative, World } from './types';
import { notify } from './world';

export const BROADCAST_SETUP_TIME = 0.8;

export const published = (w: World) =>
  !!w.broadcast && w.broadcast.progress >= w.mission.broadcast!.duration;

/** Held work has one owner; a handoff releases the previous operator. */
export function workBroadcast(w: World, a: Operative, id: 'mask' | 'upload') {
  const b = w.broadcast!;
  const key = id === 'mask' ? 'maskBy' : 'uploadBy';
  if (b[key] === a.id) return;
  const previous = w.agents.find((p) => p.id === b[key]);
  if (previous?.order.kind === 'interact' && previous.order.target === id) {
    previous.order = { kind: 'hold' };
    previous.interaction = 0;
    previous.path = [];
  }
  b[key] = a.id;
  w.sounds.push({ kind: 'interact', action: id, x: a.x, y: a.y });
  a.path = [];
  notify(
    w,
    id === 'mask'
      ? `${a.name} is holding LOOP. Keep them here while another operative works UPLINK. Selection changes preserve the loop.`
      : `${a.name} is uploading ${w.mission.broadcast?.subject ?? "Quill's audit"}. Move or Hold pauses it; progress is saved. ${b.maskBy ? 'LOOP is masking the signal.' : 'Without LOOP, the signal can be traced.'}`,
  );
}

export function updateBroadcast(w: World, dt: number) {
  const b = w.broadcast,
    config = w.mission.broadcast;
  if (!b || !config || published(w)) return;
  const working = (owner: string | null, id: 'mask' | 'upload') => {
    const a = w.agents.find((p) => p.id === owner);
    const target = w.mission.landmarks.find((o) => o.id === id)!;
    return (
      a &&
      living(a) &&
      !disoriented(a) &&
      !a.carrying &&
      a.order.kind === 'interact' &&
      a.order.target === id &&
      a.interaction >= BROADCAST_SETUP_TIME &&
      distance(a, target) < 1.15 &&
      lineClear(w, a, target)
    );
  };
  if (!working(b.maskBy, 'mask')) b.maskBy = null;
  if (!working(b.uploadBy, 'upload')) b.uploadBy = null;
  if (b.maskBy && !b.traced) b.trace = 0;
  if (!b.uploadBy) return;
  b.progress = Math.min(config.duration, b.progress + dt);
  if (!b.maskBy && !b.traced) {
    b.trace = Math.min(config.traceTime, b.trace + dt);
    if (b.trace >= config.traceTime) {
      b.traced = true;
      const terminal = w.mission.landmarks.find((o) => o.id === 'upload')!;
      investigateNoise(w, terminal);
      raiseAlarm(w);
      const dispatched = config.dispatchOnTrace && !w.relayOff;
      if (dispatched) dispatchInvestigation(w, terminal);
      notify(
        w,
        dispatched
          ? 'UPLINK traced. RADIO dispatched site guards and incoming teams to the registry. Defend the uploader or break off; progress is saved.'
          : `UPLINK traced. Nearby guards are converging.${w.relayOff ? ' RADIO is offline; no reinforcements.' : ' Reinforcements called.'} The upload can still finish.`,
        'warning',
      );
    }
  }
  if (published(w)) {
    // Free both operators immediately; neither should remain tied to a finished task.
    for (const a of w.agents) {
      if (a.order.kind === 'interact' && ['mask', 'upload'].includes(a.order.target)) {
        a.order = { kind: 'hold' };
        a.path = [];
        a.interaction = 0;
      }
    }
    b.uploadBy = b.maskBy = null;
    const terminal = w.mission.landmarks.find((o) => o.id === 'upload')!;
    w.sounds.push({ kind: 'interact', action: 'upload', x: terminal.x, y: terminal.y });
    notify(
      w,
      config.completed
        ? `${config.completed}. LOOP is released; bring every survivor to VAN. LOG is optional.`
        : "Audit published. Quill's evidence is public. LOOP is released; bring every survivor to VAN. LOG is optional.",
    );
  }
}
