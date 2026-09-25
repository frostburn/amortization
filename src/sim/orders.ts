import { distance, living, EXTRACTION_RADIUS } from './types';
import type { Landmark, ObjectKind, Operative, Vec, World } from './types';
import { findPath, nearestFree } from './navigation';
import { notify } from './world';
import { raiseAlarm } from './awareness';

export function landmark(world: World, id: ObjectKind): Landmark {
  const source = world.mission.landmarks.find((o) => o.id === id)!;
  if (id === 'engineer') return { ...source, x: world.engineer.x, y: world.engineer.y };
  if (id === 'evidence') return { ...source, ...world.evidencePosition };
  return source;
}
export function available(world: World, id: ObjectKind) {
  return !(
    (id === 'disguise' && world.disguiseTaken) ||
    (id === 'gate' && world.gateOpen) ||
    (id === 'relay' && world.relayOff) ||
    (id === 'evidence' && world.evidence !== 'available')
  );
}
export function interactionPoint(world: World, agent: Operative, id: ObjectKind): Vec {
  if (id === 'gate' && agent.y > 20) return { x: 23, y: 21.25 };
  return landmark(world, id);
}
export function moveAgents(world: World, ids: string[], target: Vec) {
  const agents = world.agents.filter((a) => ids.includes(a.id) && living(a));
  agents.forEach((a, i) => {
    const p =
      agents.length === 1
        ? target
        : { x: target.x + ((i % 2) - 0.5) * 0.8, y: target.y + (Math.floor(i / 2) - 0.5) * 0.8 };
    const destination = nearestFree(world, p);
    a.path = findPath(world, a, destination);
    a.order = { kind: 'move', target: destination };
    a.interaction = 0;
    if (!a.path.length && distance(a, destination) > 0.5)
      notify(world, 'No clear route. Open the loading gate or use the west entrance.');
  });
}
export function interact(world: World, ids: string[], id: ObjectKind) {
  if (!available(world, id)) return;
  const agents = world.agents.filter((a) => ids.includes(a.id) && living(a));
  const target = landmark(world, id);
  const a = agents.sort((a, b) => distance(a, target) - distance(b, target))[0];
  if (!a) return;
  a.order = { kind: 'interact', target: id };
  a.interaction = 0;
  a.path = findPath(world, a, interactionPoint(world, a, id));
}
export function hold(world: World, ids: string[]) {
  for (const a of world.agents)
    if (ids.includes(a.id)) {
      a.order = { kind: 'hold' };
      a.path = [];
      a.interaction = 0;
    }
}
export function toggleWeapons(world: World, ids: string[]) {
  const agents = world.agents.filter((a) => ids.includes(a.id) && living(a) && !a.carrying);
  const draw = agents.some((a) => !a.weapon);
  for (const a of agents) {
    a.weapon = draw;
    if (!draw && a.order.kind === 'attack') {
      a.order = { kind: 'hold' };
      a.path = [];
    }
  }
}
export function attack(world: World, ids: string[], target: string) {
  for (const a of world.agents)
    if (ids.includes(a.id) && living(a) && !a.carrying) {
      a.weapon = true;
      a.order = { kind: 'attack', target };
      a.path = [];
    }
}
export function heal(world: World, ids: string[]) {
  for (const a of world.agents)
    if (ids.includes(a.id) && living(a) && a.medkit && a.hp < a.maxHp) {
      a.hp = Math.min(a.maxHp, a.hp + 55);
      a.medkit = false;
      notify(world, `${a.name} used a field dressing.`);
      world.sounds.push({ kind: 'interact', x: a.x });
    }
}
export function dropEvidence(world: World, ids: string[]) {
  for (const a of world.agents)
    if (ids.includes(a.id) && a.carrying) {
      a.carrying = false;
      world.evidence = 'available';
      world.evidencePosition = { x: a.x, y: a.y };
      notify(world, 'Diagnostic unit set down. Another operative can collect it.');
    }
}
export function completeInteraction(world: World, a: Operative, id: ObjectKind) {
  if (id === 'extract') {
    const van = landmark(world, 'extract');
    const waiting = !world.engineer.recruited
      ? 'Recruit Voss before requesting extraction.'
      : distance(world.engineer, van) > EXTRACTION_RADIUS
        ? 'Waiting for Voss at the van. Keep her escort nearby.'
        : world.agents.some((p) => living(p) && distance(p, van) > EXTRACTION_RADIUS)
          ? 'Waiting for the crew. Bring every survivor inside the extraction ring.'
          : null;
    if (waiting) {
      a.interaction = 0;
      a.path = [];
      a.order = world.engineer.recruited
        ? { kind: 'interact', target: 'extract' }
        : { kind: 'hold' };
      if (world.message !== waiting) notify(world, waiting);
      return;
    }
  }
  a.order = { kind: 'hold' };
  a.path = [];
  a.interaction = 0;
  if (!available(world, id)) return;
  world.sounds.push({ kind: 'interact', x: a.x });
  switch (id) {
    case 'disguise':
      world.disguiseTaken = true;
      a.disguised = true;
      a.weapon = false;
      notify(
        world,
        `${a.name}: maintenance cover acquired. Workshop access is safe; the marked office is restricted.`,
      );
      break;
    case 'gate':
      world.gateOpen = true;
      if (a.y > 20) {
        raiseAlarm(world, [a.id]);
        notify(world, 'Loading gate breached. The squad can enter.', 'warning');
      } else notify(world, 'Loading gate opened. The crew has a second entrance.');
      break;
    case 'relay':
      world.relayOff = true;
      notify(world, 'Radio relay disabled. No further reinforcements can be called.');
      break;
    case 'engineer':
      world.engineer.recruited = true;
      world.engineer.leader = a.id;
      world.engineer.path = [];
      notify(
        world,
        `Voss is following ${a.name}. The diagnostic unit is optional. Bring everyone to the van.`,
      );
      break;
    case 'evidence':
      world.evidence = 'carried';
      a.carrying = true;
      a.weapon = false;
      notify(
        world,
        `${a.name} is carrying the diagnostic unit. Both hands occupied. X sets it down.`,
      );
      break;
    case 'extract': {
      world.status = 'won';
      if (world.evidence === 'carried') world.evidence = 'extracted';
      notify(world, 'Contract fulfilled. Voss is out. The crew is clear.');
      break;
    }
  }
}
