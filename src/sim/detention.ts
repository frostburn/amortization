import { controllable, distance, isAccess, isRescue, living, people } from './types';
import type { ObjectKind, Operative, World } from './types';
import { notify } from './world';

export const rescueComplete = (w: World) => !!w.detention && !w.agents.some((a) => a.captive);
export const detentionDoors = (w: World) => [
  ...(w.mission.detention?.gates
    .filter((g) => !w.detention!.open.includes(g.id))
    .map((g) => g.door) ?? []),
  ...(w.mission.detention?.cells.filter((c) => w.agents[c.agent].captive).map((c) => c.door) ?? []),
];

/** Re-evaluate the held circuit on commands as well as ticks. Door safety does
 * not supply cell-release power: wedging a gate can never replace a partner. */
export function updateDetention(w: World) {
  const d = w.detention,
    config = w.mission.detention;
  if (!d || !config) return;
  const operator = w.agents.find((a) => a.id === d.operator);
  const panel = w.mission.landmarks.find((o) => o.id === d.circuit);
  if (
    !operator ||
    !panel ||
    !controllable(operator) ||
    operator.carrying ||
    operator.order.kind !== 'interact' ||
    operator.order.target !== d.circuit ||
    distance(operator, panel) >= 1.15
  ) {
    d.operator = null;
    d.circuit = null;
  }
  d.open = config.gates
    .filter(
      (g) =>
        d.released ||
        (d.operator && d.circuit === g.id) ||
        (d.open.includes(g.id) &&
          people(w).some(
            (p) =>
              living(p) &&
              p.x >= g.door.x - 0.2 &&
              p.x <= g.door.x + g.door.w + 0.2 &&
              p.y >= g.door.y - 0.2 &&
              p.y <= g.door.y + g.door.h + 0.2,
          )),
    )
    .map((g) => g.id);
}

export function detentionAvailable(w: World, id: ObjectKind) {
  if (isAccess(id)) return !!w.detention && !w.detention.released;
  if (isRescue(id))
    return !!w.mission.detention?.cells.some((c) => c.id === id && w.agents[c.agent].captive);
  if (id === 'escape-release') return !!w.detention && !w.detention.released;
  if (id === 'equipment') return !!w.detention && w.agents.some((a) => a.disarmed);
  return true;
}

export function detentionRefusal(w: World, a: Operative, id: ObjectKind): string | null {
  if (!w.detention) return null;
  if ((isAccess(id) || isRescue(id) || id === 'escape-release' || id === 'equipment') && a.carrying)
    return 'Set the cargo down before working detention controls.';
  if (isRescue(id)) {
    updateDetention(w);
    if (
      !w.detention.operator ||
      w.detention.operator === a.id ||
      w.detention.circuit !== 'access-cells'
    )
      return 'Cell release needs two people: keep a partner holding CELLS at the remote console while another operates this local lock.';
  }
  if (id === 'escape-release' && !rescueComplete(w))
    return 'EXIT releases both gates after Vale and Rook are free. Keep the remote console staffed until then.';
  if (id === 'equipment' && !a.disarmed)
    return 'Only Vale or Rook needs the confiscated GEAR. Select a freed teammate to recover their own weapon and dressing.';
  return null;
}

export function workDetention(w: World, a: Operative, id: ObjectKind) {
  const d = w.detention!;
  if (isAccess(id)) {
    const previous = w.agents.find((p) => p.id === d.operator && p.id !== a.id);
    if (previous) {
      previous.order = { kind: 'hold' };
      previous.interaction = 0;
    }
    if (d.operator !== a.id || d.circuit !== id) {
      notify(
        w,
        `${a.name} holds ${id === 'access-intake' ? 'INTAKE' : 'CELLS'}. Select the infiltrator; moving or Hold releases remote power.`,
      );
      w.sounds.push({ kind: 'interact', action: id, x: a.x, y: a.y });
    }
    d.operator = a.id;
    d.circuit = id;
    a.order = { kind: 'interact', target: id };
    a.path = [];
  } else {
    a.order = { kind: 'hold' };
    a.path = [];
    a.interaction = 0;
    if (isRescue(id)) {
      const prisoner = w.agents[w.mission.detention!.cells.find((c) => c.id === id)!.agent];
      prisoner.captive = false;
      notify(
        w,
        `${prisoner.name} is free and controllable, but unarmed. Recover their GEAR or escort them out. ${rescueComplete(w) ? 'Use EXIT to release both gates and bring the console operator.' : 'Keep the console staffed for the other prisoner.'}`,
      );
    } else if (id === 'escape-release') {
      d.released = true;
      const operator = w.agents.find((p) => p.id === d.operator);
      if (operator) {
        operator.order = { kind: 'hold' };
        operator.interaction = 0;
      }
      d.operator = null;
      d.circuit = null;
      notify(
        w,
        'Emergency egress released. Both gates stay open. Regroup all four at VAN; GEAR is optional.',
      );
    } else if (id === 'equipment') {
      a.disarmed = false;
      a.medkit = true;
      notify(w, `${a.name} recovered their weapon and field dressing. Draw it when ready.`);
    }
    w.sounds.push({ kind: 'interact', action: id, x: a.x, y: a.y });
  }
  updateDetention(w);
}
