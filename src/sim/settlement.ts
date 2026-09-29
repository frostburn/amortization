import { controllable, disoriented, distance, isSettlement } from './types';
import type { ObjectKind, Operative, SettlementTarget, World } from './types';
import { lineClear } from './navigation';
import { notify } from './world';
import { FLASH_FLIGHT } from './flash';

export const SETTLEMENT_SETUP = 0.8;
export const settled = (w: World) =>
  !!w.settlement && w.settlement.progress >= w.mission.settlement!.duration;

export function settlementRefusal(w: World, a: Operative, id: ObjectKind): string | null {
  if (!isSettlement(id)) return null;
  if (!w.settlement) return 'No settlement terminal on this operation.';
  if (id !== 'reconcile' && !w.settlement.reconciled)
    return 'Bring REGISTER to CHECK and reconcile it before authorising the repayments.';
  if (id === 'countersign')
    return a.carrying
      ? 'SIGN needs a separate operative with free hands. The REGISTER carrier works CLEAR.'
      : null;
  return a.carrying
    ? null
    : `Select the REGISTER carrier to work ${id === 'reconcile' ? 'CHECK' : 'CLEAR'}.`;
}

function working(w: World, id: string | null, target: SettlementTarget) {
  const a = w.agents.find((p) => p.id === id);
  const terminal = w.mission.landmarks.find((o) => o.id === target)!;
  return a &&
    controllable(a) &&
    !disoriented(a) &&
    !w.flashGrenades?.some((g) => g.thrower === a.id && g.age < FLASH_FLIGHT) &&
    a.order.kind === 'interact' &&
    a.order.target === target &&
    a.interaction >= SETTLEMENT_SETUP &&
    !settlementRefusal(w, a, target) &&
    distance(a, terminal) < 1.15 &&
    lineClear(w, a, terminal)
    ? a
    : null;
}

export function workSettlement(w: World, a: Operative, target: SettlementTarget) {
  const s = w.settlement!;
  if (target === 'reconcile') {
    s.reconciled = true;
    a.order = { kind: 'hold' };
    a.interaction = 0;
    w.sounds.push({ kind: 'interact', action: target, x: a.x, y: a.y });
    notify(
      w,
      'REGISTER reconciled. Its carrier can work CLEAR while a separate operative holds SIGN. Both must stay at their terminals.',
    );
    return;
  }
  const key = target === 'countersign' ? 'signer' : 'clerk';
  if (s[key] === a.id) return;
  const previous = w.agents.find((p) => p.id === s[key]);
  if (previous?.order.kind === 'interact' && previous.order.target === target) {
    previous.order = { kind: 'hold' };
    previous.interaction = 0;
  }
  s[key] = a.id;
  w.sounds.push({ kind: 'interact', action: target, x: a.x, y: a.y });
  notify(
    w,
    target === 'countersign'
      ? `${a.name} is holding SIGN. Keep them here while the REGISTER carrier works CLEAR.`
      : `${a.name} is at CLEAR with REGISTER. Repayments advance only while a separate operative holds SIGN.`,
  );
}

/** Both live operators are checked every tick, and after commands while paused. */
export function updateSettlement(w: World, dt: number) {
  const s = w.settlement;
  if (!s || settled(w)) return;
  const signer = working(w, s.signer, 'countersign');
  const clerk = working(w, s.clerk, 'settle');
  if (!signer) s.signer = null;
  if (!clerk) s.clerk = null;
  if (!s.reconciled || !signer || !clerk || signer.id === clerk.id) return;
  s.progress = Math.min(w.mission.settlement!.duration, s.progress + dt);
  if (!settled(w)) return;
  for (const a of [signer, clerk]) {
    a.order = { kind: 'hold' };
    a.interaction = 0;
  }
  s.signer = s.clerk = null;
  w.sounds.push({ kind: 'interact', action: 'settle', x: clerk.x, y: clerk.y });
  notify(
    w,
    'Repayments released. Both terminals are free. Bring REGISTER and every survivor to VAN.',
  );
}

export function settlementStatus(w: World) {
  if (settled(w)) return 'Repayments released. Bring REGISTER and every survivor to VAN.';
  if (!w.agents.some((a) => controllable(a) && a.carrying))
    return 'Collect REGISTER. Its carrier must bring the original to CHECK, then CLEAR.';
  if (!w.settlement!.reconciled) return 'Bring the REGISTER carrier to CHECK for six seconds.';
  const s = w.settlement!;
  const signer = w.agents.find((a) => a.id === s.signer);
  const clerk = w.agents.find((a) => a.id === s.clerk);
  return signer && clerk
    ? `${signer.name} countersigns for ${clerk.name}. Both must stay; neither can fire.`
    : signer
      ? `${signer.name} holds SIGN. Send the REGISTER carrier to CLEAR.`
      : clerk
        ? `${clerk.name} waits at CLEAR. Send a separate operative with free hands to SIGN.`
        : 'Hold SIGN with one operative and work CLEAR with the REGISTER carrier. Progress survives interruptions.';
}
