import { available, landmark } from '../sim/orders';
import { courierGuard } from '../sim/courier';
import { canAuthorise } from '../sim/security';
import {
  controllable,
  distance,
  inside,
  isAccess,
  isCharge,
  isExtraction,
  isRescue,
  living,
} from '../sim/types';
import type { ObjectKind, World } from '../sim/types';
import { longGun, weaponRange } from '../sim/weapons';
import { lineClear } from '../sim/navigation';
import { extractionRequirement } from './extraction';

export const armedSelection = (w: World, selected: string[]) =>
  w.agents.filter((a) => selected.includes(a.id) && controllable(a) && !a.carrying && !a.disarmed);

/** Geometry feedback, not a promise of an immediate shot: reloads, settling and
 * coil charging still apply. An attack order draws weapons and holds position. */
export function attackPreview(w: World, selected: string[], target: World['guards'][number]) {
  const armed = armedSelection(w, selected);
  if (!armed.length)
    return {
      kind: 'unarmed' as const,
      detail: 'Selected crew cannot fire. Select an armed operative with free hands.',
    };
  const near = armed.filter((a) => distance(a, target) <= weaponRange(a));
  if (!near.length)
    return {
      kind: 'blocked' as const,
      detail: 'Out of range. Move closer; attack orders hold position.',
    };
  const clear = near.filter((a) => lineClear(w, a, target)).length;
  if (!clear)
    return {
      kind: 'blocked' as const,
      detail: 'Line of fire blocked. Move to clear sight; attack orders hold position.',
    };
  return {
    kind: 'attack' as const,
    detail: `${clear} selected ${clear === 1 ? 'operative has' : 'operatives have'} a clear line of fire. Attack draws weapons and holds position.`,
  };
}

/** Read-only prerequisites for map affordances, independent of travel distance.
 * The simulation still owns command acceptance; inspection never issues an order
 * or calls its mutating refusal checks (notably the held detention circuit).
 */
export function objectRequirement(w: World, id: ObjectKind, selected: string[]): string | null {
  if (isExtraction(id)) return extractionRequirement(w)?.detail ?? null;
  if (id === 'escort' && w.escortLocked)
    return 'Release the transport with WARRANT in disguise, or force it with CUT.';
  if (id === 'evidence' && w.evidence === 'courier' && w.courier?.phase !== 'inspection')
    return 'Use DIVERT and CALL to arrange an inspection, or defeat the courier to recover CASE.';
  // Finished controls normally disappear. Armed charges retain their own status.
  if (!available(w, id)) return null;
  if (id === 'escape-release' && w.agents.some((a) => a.captive)) {
    const names = w.agents
      .filter((a) => a.captive)
      .map((a) => a.name)
      .join(' and ');
    return `Free ${names} first. Keep a partner holding CELLS while another works the prisoner locks. EXIT then latches both gates open.`;
  }
  const agents = w.agents.filter((a) => selected.includes(a.id) && controllable(a));
  if (!agents.length) return 'Select a free operative to use this control.';
  const free = agents.filter((a) => !a.carrying);
  if (
    !free.length &&
    (isAccess(id) ||
      isRescue(id) ||
      isCharge(id) ||
      [
        'equipment',
        'escape-release',
        'override',
        'breach',
        'divert',
        'dispatch',
        'release',
        'mask',
        'upload',
        'authorise',
        'power-west',
        'power-east',
      ].includes(id))
  )
    return 'Set the cargo down before working this control.';
  if (isRescue(id) && w.detention) {
    const operator = w.agents.find((a) => a.id === w.detention!.operator);
    if (
      w.detention.circuit !== 'access-cells' ||
      !operator ||
      !controllable(operator) ||
      operator.carrying ||
      operator.order.kind !== 'interact' ||
      operator.order.target !== 'access-cells' ||
      distance(operator, landmark(w, 'access-cells')) >= 1.15
    )
      return 'Keep a partner holding CELLS at the remote console to power this local prisoner lock.';
    if (!free.some((a) => a.id !== operator.id))
      return `Leave ${operator.name} holding CELLS. Select a different operative to work this local lock.`;
  }
  if (id === 'equipment' && !free.some((a) => a.disarmed))
    return 'Select a freed, unarmed Vale or Rook. Each recovers their own weapon and dressing here.';
  if (id === 'disguise' && !agents.some((a) => !longGun(a)))
    return 'Select Morrow or Vale for KIT. Long guns cannot be concealed.';
  if (id === 'release' && !free.some((a) => a.disguised && !a.weapon && !a.exposed))
    return 'WARRANT needs an unexposed maintenance identity with weapons concealed.';
  if (id === 'authorise' && !agents.some((a) => canAuthorise(w, a)))
    return 'INSPECT needs an unexposed maintenance identity, a concealed pistol and free hands.';
  if (id === 'evidence') {
    if (w.evidence === 'courier') {
      const courier = courierGuard(w);
      if (
        !courier ||
        !living(courier) ||
        courier.mode === 'combat' ||
        !agents.some(
          (a) =>
            a.disguised && !a.weapon && !courier.known.includes(a.id) && !w.known.includes(a.id),
        )
      )
        return 'The courier needs a maintenance identity with weapons concealed, and must be out of combat. Select an operative they have not recognized.';
    }
    if (
      w.mission.archive &&
      !w.shutterOpen &&
      inside(w.evidencePosition, w.mission.secure) &&
      !agents.some((a) => inside(a, w.mission.secure))
    )
      return 'Keep a partner holding SHUNT, or use CUT, to reach the cargo inside the archive.';
  }
  return null;
}
