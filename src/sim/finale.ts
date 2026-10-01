import { controllable, disoriented, distance, living, position } from './types';
import type { Guard, ObjectKind, Operative, Person, Vec, World } from './types';
import { findPath, lineClear } from './navigation';
import { notify } from './world';
import { cancelCharge, weaponRange } from './weapons';
import { FLASH_FLIGHT } from './flash';
import { sees } from './vision';

export const MARSHAL_HEALTH = 160;
export const COMMAND_TIME = 2;
export const COMMAND_INTERVAL = 8;
export const SEAL_SETUP = 0.8;
export const isSeal = (id: ObjectKind) => id === 'seal-west' || id === 'seal-east';
export const dacre = (w: World) =>
  w.guards.find((g) => g.id === `guard-${w.mission.finale?.dacre}`);
export const dacreDefeated = (w: World) => !!w.mission.finale && !!dacre(w) && !living(dacre(w)!);
export const finaleResolved = (w: World) =>
  dacreDefeated(w) && !!w.escort && (!living(w.escort) || w.escort.recruited);

/** Called before the stunned-guard early return; a flash cancels rather than delays an order. */
export function interruptMarshal(w: World, g: Guard) {
  const m = g.marshal;
  if (!m) return;
  if (m.target && (disoriented(g) || g.hp < m.lastHp)) {
    m.target = null;
    m.remaining = 0;
    m.readyAt = w.time + COMMAND_INTERVAL;
    if (w.finale) w.finale.interrupted++;
    notify(w, 'Dacre’s order interrupted. His retinue has no new command.');
  }
  m.lastHp = g.hp;
}

/** The marshal orders only surviving, nearby partners he can signal, to authored posts. */
function commandRetinue(w: World, g: Guard, target: Vec) {
  for (const index of w.mission.finale?.retinue ?? []) {
    const partner = w.guards.find((p) => p.id === `guard-${index}`);
    if (
      !partner ||
      !living(partner) ||
      disoriented(partner) ||
      distance(g, partner) > 14 ||
      !lineClear(w, g, partner)
    )
      continue;
    const posts = [...(partner.tactics?.posts ?? [])].filter(
      (p) => distance(partner, p) > 0.6 && distance(p, target) < 14,
    );
    posts.sort(
      (a, b) =>
        Math.abs(distance(a, target) - weaponRange(partner) * 0.7) -
        Math.abs(distance(b, target) - weaponRange(partner) * 0.7),
    );
    for (const post of posts.slice(0, 2)) {
      const path = findPath(w, partner, post);
      if (!path.length || distance(path.at(-1)!, post) > 0.3) continue;
      let length = 0,
        from: Vec = partner;
      for (const p of path) {
        length += distance(from, p);
        from = p;
      }
      if (length > 16) continue;
      partner.mode = 'combat';
      // This is the location observed when the signal began, never a live unseen target.
      partner.lastSeen = position(target);
      partner.searchTime = 9;
      partner.path = path;
      partner.commandMove = { goal: position(post), until: w.time + length / 2.25 + 0.5 };
      cancelCharge(partner);
      break;
    }
  }
}

export function followMarshalOrder(w: World, g: Guard) {
  if (!g.commandMove) return false;
  if (w.time >= g.commandMove.until || !g.path.length || distance(g, g.commandMove.goal) < 0.35) {
    delete g.commandMove;
    return false;
  }
  return true;
}

/** A visible two-second commitment: Dacre cannot shoot while signalling. */
export function commandMarshal(w: World, g: Guard, visible: Person | undefined, dt: number) {
  const m = g.marshal;
  if (!m) return false;
  if (!m.target && w.time >= m.readyAt) {
    const partners = w.guards.filter(
      (p) =>
        w.mission.finale?.retinue.some((i) => p.id === `guard-${i}`) &&
        living(p) &&
        !disoriented(p) &&
        distance(g, p) <= 14 &&
        lineClear(w, g, p),
    );
    // A visible officer can relay a current, identified sighting. RADIO does
    // not silence local signals, but walls, stun and loss of sight do.
    const contact =
      visible ??
      w.agents.find(
        (a) => controllable(a) && partners.some((p) => p.known.includes(a.id) && sees(w, p, a)),
      );
    if (contact && partners.length) {
      m.target = position(contact);
      m.remaining = COMMAND_TIME;
      notify(
        w,
        'Dacre is signalling a crossfire. Hit or flash him to break the two-second order.',
        'warning',
      );
    }
  }
  if (!m.target) return false;
  g.path = [];
  cancelCharge(g);
  m.remaining = Math.max(0, m.remaining - dt);
  if (m.remaining === 0) {
    commandRetinue(w, g, m.target);
    m.target = null;
    m.readyAt = w.time + COMMAND_INTERVAL;
    notify(w, 'Dacre’s retinue is moving to crossfire positions.', 'warning');
  }
  return true;
}

export function workSeal(w: World, a: Operative, id: ObjectKind) {
  const f = w.finale!;
  const key = id === 'seal-west' ? 'westBy' : 'eastBy';
  if (f[key] === a.id) return;
  const previous = w.agents.find((p) => p.id === f[key]);
  if (previous?.order.kind === 'interact' && previous.order.target === id) {
    previous.order = { kind: 'hold' };
    previous.interaction = 0;
  }
  f[key] = a.id;
  notify(
    w,
    `${a.name} holds ${id === 'seal-west' ? 'SEAL A' : 'SEAL B'}. Staff both seals for four seconds to open the Bench permanently.`,
  );
}

export function openBench(w: World) {
  const f = w.finale!;
  f.open = true;
  for (const a of w.agents)
    if (a.order.kind === 'interact' && isSeal(a.order.target)) {
      a.order = { kind: 'hold' };
      a.interaction = 0;
      a.path = [];
    }
  f.westBy = f.eastBy = null;
  notify(w, 'The Bench is open and stays open. Defeat Dacre, then cuff Holt or eliminate him.');
  w.sounds.push({ kind: 'interact', action: 'gate', ...position(w.mission.finale!.door) });
}

export function updateFinale(w: World, dt: number) {
  const f = w.finale;
  if (!f) return;
  if (!f.defeated && dacreDefeated(w)) {
    f.defeated = true;
    const marshal = dacre(w)?.marshal;
    if (marshal) {
      marshal.target = null;
      marshal.remaining = 0;
    }
    notify(
      w,
      'Dacre is down. Holt will surrender at CUFF once you reach him. Surviving guards are still active.',
    );
  }
  if (f.open) return;
  const working = (owner: string | null, target: ObjectKind) => {
    const a = w.agents.find((p) => p.id === owner);
    const p = w.mission.landmarks.find((p) => p.id === target)!;
    return (
      a &&
      controllable(a) &&
      !disoriented(a) &&
      !a.carrying &&
      !w.flashGrenades?.some((g) => g.thrower === a.id && g.age < FLASH_FLIGHT) &&
      a.order.kind === 'interact' &&
      a.order.target === target &&
      a.interaction >= SEAL_SETUP &&
      distance(a, p) < 1.15 &&
      lineClear(w, a, p)
    );
  };
  if (!working(f.westBy, 'seal-west')) f.westBy = null;
  if (!working(f.eastBy, 'seal-east')) f.eastBy = null;
  if (!f.westBy || !f.eastBy || f.westBy === f.eastBy) return;
  f.progress = Math.min(w.mission.finale!.sealTime, f.progress + dt);
  if (f.progress >= w.mission.finale!.sealTime) openBench(w);
}
