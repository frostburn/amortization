import { RESPONSE_TIMES } from '../sim/awareness';
import { published } from '../sim/broadcast';
import { FLASH_FLIGHT } from '../sim/flash';
import { lineClear } from '../sim/navigation';
import { available, interactionDuration, interactionPoint, landmark } from '../sim/orders';
import { inspectionRemaining } from '../sim/security';
import { settled } from '../sim/settlement';
import { liftRemaining } from '../sim/threshold';
import { controllable, disoriented, distance, floorOf } from '../sim/types';
import type { ObjectKind, Operative, World } from '../sim/types';

export interface MapTimerRow {
  label: string;
  fraction: number;
  tone: 'work' | 'danger' | 'wait';
  remaining?: number;
  paused?: boolean;
}
export interface MapTimer {
  target: ObjectKind;
  tag: string;
  rows: MapTimerRow[];
}

const actions: Partial<Record<ObjectKind, string>> = {
  relay: 'Disable',
  'key-lift': 'Link key',
  breach: 'Cut lock',
  'file-recall': 'File recall',
  reconcile: 'Reconcile',
  'power-west': 'Isolate',
  'power-east': 'Isolate',
  'charge-west': 'Arm charge',
  'charge-east': 'Arm charge',
  authorise: 'Authorise',
  escort: 'Handcuff',
  'rescue-vale': 'Release',
  'rescue-rook': 'Release',
  equipment: 'Equip',
  'escape-release': 'Unlock',
  release: 'Release',
  gate: 'Unlock',
  divert: 'Divert',
};

const interrupted = (w: World, a: Operative, target: ObjectKind) => {
  const p = interactionPoint(w, a, target);
  return (
    disoriented(a) ||
    !!w.flashGrenades?.some((g) => g.thrower === a.id && g.age < FLASH_FLIGHT) ||
    distance(a, p) >= 1.15 ||
    !lineClear(w, a, p)
  );
};

/** Read-only presentation of simulation time. No wall-clock animation or guessed travel ETA. */
export function mapTimers(w: World, floor = 0): MapTimer[] {
  if (w.status !== 'playing') return [];
  const timers = new Map<ObjectKind, MapTimer>();
  const add = (target: ObjectKind, row: MapTimerRow) => {
    if (!w.mission.landmarks.some((o) => o.id === target)) return;
    const location = landmark(w, target);
    if (floorOf(location) !== floor) return;
    let timer = timers.get(target);
    if (!timer) {
      timer = { target, tag: location.tag, rows: [] };
      timers.set(target, timer);
    }
    timer.rows.push({ ...row, fraction: Math.max(0, Math.min(1, row.fraction)) });
  };
  if (w.alarm && !w.relayOff && w.waves < RESPONSE_TIMES.length) {
    const deadline = RESPONSE_TIMES[w.waves];
    const duration = deadline - (w.waves ? RESPONSE_TIMES[w.waves - 1] : 0);
    const remaining = Math.max(0, deadline - (w.time - w.alarmTime));
    add('relay', {
      label: `Patrol ${w.waves + 1}`,
      fraction: remaining / duration,
      remaining,
      tone: 'danger',
    });
  }
  // One-shot work starts on arrival, not when an order is issued. Indefinite
  // stations have their own state below, never a permanently completed setup bar.
  const workers = new Map<ObjectKind, Operative>();
  for (const a of w.agents) {
    if (!controllable(a) || a.order.kind !== 'interact' || a.interaction <= 0) continue;
    const id = a.order.target;
    if (!available(w, id) || interactionDuration(w, a, id) < 1) continue;
    if (!workers.has(id) || workers.get(id)!.interaction < a.interaction) workers.set(id, a);
  }
  for (const [id, a] of workers) {
    const duration = interactionDuration(w, a, id);
    add(id, {
      label: actions[id] ?? 'Working',
      remaining: Math.max(0, duration - a.interaction),
      fraction: a.interaction / duration,
      tone: 'work',
      paused: interrupted(w, a, id),
    });
  }
  const operator = w.agents.find((a) => a.id === w.overrideBy && controllable(a));
  if (
    operator &&
    !w.shutterBreached &&
    operator.order.kind === 'interact' &&
    operator.order.target === 'override' &&
    !interrupted(w, operator, 'override')
  )
    add('override', { label: `Held by ${operator.name}`, fraction: 1, tone: 'work' });

  const lift = liftRemaining(w);
  if (lift !== null)
    add('extract', {
      label: lift > 0 ? 'Arrives' : 'Open · waiting',
      fraction: 1 - lift / w.mission.threshold!.arrivalTime,
      ...(lift > 0 ? { remaining: lift } : {}),
      tone: lift > 0 ? 'wait' : 'work',
    });

  const b = w.broadcast;
  if (b && !published(w) && (b.progress > 0 || b.uploadBy)) {
    const config = w.mission.broadcast!;
    add('upload', {
      label: 'Upload',
      fraction: b.progress / config.duration,
      remaining: config.duration - b.progress,
      tone: 'work',
      paused: !b.uploadBy,
    });
    if (!b.traced && !b.maskBy && (b.trace > 0 || b.uploadBy))
      add('upload', {
        label: 'Trace',
        fraction: 1 - b.trace / config.traceTime,
        remaining: config.traceTime - b.trace,
        tone: 'danger',
        paused: !b.uploadBy,
      });
  }
  const s = w.settlement;
  if (s && !settled(w) && (s.progress > 0 || s.clerk))
    add('settle', {
      label: 'Transfer',
      fraction: s.progress / w.mission.settlement!.duration,
      remaining: w.mission.settlement!.duration - s.progress,
      tone: 'work',
      paused: !s.signer || !s.clerk,
    });
  const inspection = inspectionRemaining(w);
  if (inspection > 0)
    add('authorise', {
      label: 'Turrets off',
      fraction: inspection / w.mission.security!.inspectionTime,
      remaining: inspection,
      tone: 'wait',
    });
  return [...timers.values()];
}
