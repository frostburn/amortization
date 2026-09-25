import { distance, inside, living, EXTRACTION_RADIUS } from './types';
import type { Landmark, ObjectKind, Operative, Vec, World } from './types';
import { findPath, nearestFree } from './navigation';
import { notify } from './world';
import { investigateNoise, raiseAlarm } from './awareness';
import { updateShutter } from './shutter';

export function landmark(world: World, id: ObjectKind): Landmark {
  const source = world.mission.landmarks.find((o) => o.id === id)!;
  if (id === 'engineer' && world.engineer)
    return { ...source, x: world.engineer.x, y: world.engineer.y };
  if (id === 'evidence') return { ...source, ...world.evidencePosition };
  return source;
}
export function available(world: World, id: ObjectKind) {
  return (
    world.mission.landmarks.some((o) => o.id === id) &&
    !(
      (id === 'disguise' && world.disguiseTaken) ||
      (id === 'gate' && world.gateOpen) ||
      (id === 'relay' && world.relayOff) ||
      (id === 'evidence' && world.evidence !== 'available') ||
      (id === 'override' && world.shutterBreached) ||
      (id === 'breach' && world.shutterOpen)
    )
  );
}
export function interactionPoint(world: World, agent: Operative, id: ObjectKind): Vec {
  if (id === 'gate' && !inside(agent, world.mission.restricted)) return world.mission.gateOutside;
  if (id === 'breach' && world.mission.archive && inside(agent, world.mission.secure))
    return world.mission.archive.inside;
  return landmark(world, id);
}
export function interactionDuration(world: World, agent: Operative, id: ObjectKind) {
  if (id === 'breach') return 8;
  if (id === 'gate' && !inside(agent, world.mission.restricted)) return 3;
  return id === 'relay' ? 1.5 : id === 'override' ? 0.8 : 0.65;
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
  if (a.carrying && (id === 'override' || id === 'breach')) {
    notify(world, 'Set the cargo down before working the archive controls.');
    return;
  }
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
      notify(world, `${world.mission.evidenceName} set down. Another operative can collect it.`);
    }
}
export function completeInteraction(world: World, a: Operative, id: ObjectKind) {
  if (id === 'override' && available(world, id) && !a.carrying) {
    const previous = world.agents.find((p) => p.id === world.overrideBy && p.id !== a.id);
    if (previous?.order.kind === 'interact' && previous.order.target === 'override') {
      previous.order = { kind: 'hold' };
      previous.interaction = 0;
    }
    if (world.overrideBy !== a.id)
      notify(
        world,
        `${a.name} is holding the archive shutter open. Move or Hold releases the shunt.`,
      );
    world.overrideBy = a.id;
    a.order = { kind: 'interact', target: id };
    a.path = [];
    updateShutter(world);
    return;
  }
  if (id === 'extract') {
    const van = landmark(world, 'extract');
    const carrier = world.agents.find((p) => living(p) && p.carrying);
    const waiting =
      world.mission.objective === 'ledger' &&
      (!carrier || distance(carrier, van) > EXTRACTION_RADIUS)
        ? 'Bring the original debt ledger to the van. It is required for this contract.'
        : world.engineer && !world.engineer.recruited
          ? 'Recruit Voss before requesting extraction.'
          : world.engineer && distance(world.engineer, van) > EXTRACTION_RADIUS
            ? 'Waiting for Voss at the van. Keep her escort nearby.'
            : world.agents.some((p) => living(p) && distance(p, van) > EXTRACTION_RADIUS)
              ? 'Waiting for the crew. Bring every survivor inside the extraction ring.'
              : null;
    if (waiting) {
      a.interaction = 0;
      a.path = [];
      a.order =
        world.engineer?.recruited || (world.mission.objective === 'ledger' && !!carrier)
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
        `${a.name}: maintenance cover acquired. The marked secure area is still restricted.`,
      );
      break;
    case 'gate':
      world.gateOpen = true;
      if (!inside(a, world.mission.restricted)) {
        raiseAlarm(world, [a.id]);
        notify(world, 'Loading gate breached. The squad can enter.', 'warning');
      } else notify(world, 'Loading gate opened. The crew has a second entrance.');
      break;
    case 'relay':
      world.relayOff = true;
      notify(world, 'Radio relay disabled. No further reinforcements can be called.');
      break;
    case 'engineer':
      if (!world.engineer) break;
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
        `${a.name} is carrying the ${world.mission.evidenceName.toLowerCase()}. Both hands occupied. X sets it down.${world.mission.objective === 'ledger' ? ' The ledger attracts suspicion even in uniform.' : ''}`,
      );
      break;
    case 'breach':
      world.shutterBreached = true;
      world.overrideBy = null;
      updateShutter(world);
      investigateNoise(world, a);
      raiseAlarm(world);
      notify(
        world,
        'Archive lock cut. The shutter stays open. Nearby guards are investigating.',
        'warning',
      );
      break;
    case 'extract': {
      world.status = 'won';
      if (world.evidence === 'carried') world.evidence = 'extracted';
      notify(
        world,
        world.mission.objective === 'escort'
          ? 'Contract fulfilled. Voss is out. The crew is clear.'
          : 'Contract fulfilled. The original ledger is secured. The crew is clear.',
      );
      break;
    }
  }
}
