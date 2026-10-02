import { controllable } from '../sim/types';
import type { Guard, World } from '../sim/types';

/** Recognition persists after suspicion decays; a noise investigation identifies nobody.
 * Wired turrets do not receive the radio network's operative identities. */
export function recognisedOperatives(w: World, guard: Guard, selected: string[]) {
  return w.agents.filter(
    (a) =>
      selected.includes(a.id) &&
      controllable(a) &&
      (guard.known.includes(a.id) || (!guard.turret && w.known.includes(a.id))),
  );
}

export function recognitionDetail(w: World, guard: Guard, selected: string[]) {
  const recognised = recognisedOperatives(w, guard, selected);
  return recognised.length
    ? `Identified in this selection: ${recognised.map((a) => a.name).join(', ')}.`
    : 'No selected operative identified yet.';
}
