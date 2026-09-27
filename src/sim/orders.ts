import { distance, inside, isExtraction, living, EXTRACTION_RADIUS } from './types';
import type { Landmark, ObjectKind, Operative, Vec, World } from './types';
import { findPath, lineClear, nearestFree } from './navigation';
import { notify } from './world';
import { investigateNoise, raiseAlarm } from './awareness';
import { updateShutter } from './shutter';
import { courierGuard, routeCourier } from './courier';

export function landmark(world: World, id: ObjectKind): Landmark {
  const source = world.mission.landmarks.find((o) => o.id === id)!;
  if (id === 'escort' && world.escort) return { ...source, x: world.escort.x, y: world.escort.y };
  if (id === 'evidence') {
    const courier = world.evidence === 'courier' ? courierGuard(world) : null;
    return {
      ...source,
      x: courier?.x ?? world.evidencePosition.x,
      y: courier?.y ?? world.evidencePosition.y,
    };
  }
  return source;
}
export function available(world: World, id: ObjectKind) {
  return (
    world.mission.landmarks.some((o) => o.id === id) &&
    !(
      (id === 'disguise' && world.disguiseTaken) ||
      (id === 'gate' && world.gateOpen) ||
      (id === 'relay' && world.relayOff) ||
      (id === 'escort' && (!world.escort || !living(world.escort) || world.escortLocked)) ||
      (id === 'release' && !world.escortLocked) ||
      (id === 'evidence' &&
        world.evidence !== 'available' &&
        !(world.evidence === 'courier' && world.courier?.phase === 'inspection')) ||
      (id === 'divert' && (world.courier?.diverted || world.evidence !== 'courier')) ||
      (id === 'dispatch' && (world.courier?.phase !== 'ready' || world.evidence !== 'courier')) ||
      (id === 'override' && world.shutterBreached) ||
      (id === 'breach' && (world.mission.archive ? world.shutterOpen : !world.escortLocked))
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
  if (id === 'divert') return 3;
  if (id === 'release') return 3;
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
  if (!available(world, id)) {
    if (id === 'escort' && world.escortLocked)
      notify(
        world,
        'Transport locked. File a release at WARRANT in disguise, or use CUT at the transport.',
      );
    if (id === 'evidence' && world.evidence === 'courier')
      notify(
        world,
        'The courier holds CASE. Use DIVERT and CALL to arrange an inspection, or engage the courier directly.',
      );
    return;
  }
  const agents = world.agents.filter((a) => ids.includes(a.id) && living(a));
  const target = landmark(world, id);
  if (isExtraction(id)) {
    // Extraction is a crew order. Sending only the nearest operative strands
    // everyone else (and the witness following them) at their previous orders.
    for (const a of agents) {
      if (a.order.kind === 'interact' && a.order.target === id) continue;
      a.order = { kind: 'interact', target: id };
      a.interaction = 0;
      a.path = findPath(world, a, target);
    }
    if (agents.length)
      notify(
        world,
        `Selected crew heading to ${target.tag}. Extraction will wait for every survivor and the objective.`,
      );
    return;
  }
  const a = agents.sort((a, b) => distance(a, target) - distance(b, target))[0];
  if (!a) return;
  if (a.order.kind === 'interact' && a.order.target === id) return;
  if (
    a.carrying &&
    (id === 'override' ||
      id === 'breach' ||
      id === 'divert' ||
      id === 'dispatch' ||
      id === 'release')
  ) {
    notify(world, 'Set the cargo down before working these controls.');
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
export function waitEscort(world: World) {
  const escort = world.escort;
  if (!escort?.recruited || !living(escort)) return;
  escort.waiting = !escort.waiting;
  escort.path = [];
  escort.repath = 0;
  notify(
    world,
    escort.waiting
      ? `${escort.name} will wait here. Clear the route before asking them to follow.`
      : `${escort.name} is following their escort again.`,
  );
}
export function treatEscort(world: World, ids: string[]) {
  const escort = world.escort;
  if (!escort?.recruited || !living(escort) || escort.hp >= escort.maxHp) return;
  const medic = world.agents
    .filter(
      (a) =>
        ids.includes(a.id) &&
        living(a) &&
        a.medkit &&
        !a.carrying &&
        distance(a, escort) < 2 &&
        lineClear(world, a, escort),
    )
    .sort((a, b) => distance(a, escort) - distance(b, escort))[0];
  if (!medic) {
    notify(
      world,
      `Bring a selected operative with a field dressing and free hands next to ${escort.name}.`,
    );
    return;
  }
  medic.medkit = false;
  escort.hp = Math.min(escort.maxHp, escort.hp + 55);
  world.sounds.push({ kind: 'interact', x: medic.x });
  notify(world, `${medic.name} used their field dressing to treat ${escort.name}.`);
}
export function dropEvidence(world: World, ids: string[]) {
  for (const a of world.agents)
    if (ids.includes(a.id) && a.carrying) {
      a.carrying = false;
      world.evidence = 'available';
      world.evidencePosition = { x: a.x, y: a.y };
      if (world.courier) world.courier.clearance = null;
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
  if (isExtraction(id)) {
    const van = landmark(world, id);
    const carrier = world.agents.find((p) => living(p) && p.carrying);
    const waiting =
      world.mission.objective !== 'escort' &&
      (!carrier || distance(carrier, van) > EXTRACTION_RADIUS)
        ? `Bring the ${world.mission.evidenceName.toLowerCase()} to the van. It is required for this contract.`
        : world.escort && (!world.escort.recruited || !living(world.escort))
          ? `Bring ${world.escort.name} out alive before requesting extraction.`
          : world.escort && distance(world.escort, van) > EXTRACTION_RADIUS
            ? world.escort.waiting
              ? `Waiting for ${world.escort.name}. Use the Escort controls to ask them to follow.`
              : `Waiting for ${world.escort.name} at ${van.tag}. Bring their escort to the van.`
            : world.agents.some((p) => living(p) && distance(p, van) > EXTRACTION_RADIUS)
              ? 'Waiting for the crew. Bring every survivor inside the extraction ring.'
              : null;
    if (waiting) {
      a.interaction = 0;
      a.path = [];
      a.order = { kind: 'interact', target: id };
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
    case 'escort':
      if (!world.escort) break;
      world.escort.recruited = true;
      world.escort.waiting = false;
      world.escort.leader = a.id;
      world.escort.path = [];
      notify(
        world,
        `${world.escort.name} is following ${a.name}.${world.mission.escort?.vulnerable ? ' Guards will attack if they spot the escape. Use cover, or clear a route first.' : ' The diagnostic unit is optional. Bring everyone to the van.'}`,
      );
      break;
    case 'release':
      if (!a.disguised || a.weapon || a.exposed) {
        notify(
          world,
          'Release refused. WARRANT requires a maintenance identity that has not been exposed, with weapons concealed.',
          'warning',
        );
        break;
      }
      world.escortLocked = false;
      notify(
        world,
        'Release filed. The transport is unlocked. Collect MARA when the escape route is ready; the forged paperwork will not fool a guard who sees her.',
      );
      break;
    case 'evidence':
      if (world.evidence === 'courier') {
        const courier = courierGuard(world),
          c = world.courier;
        if (
          !c ||
          !courier ||
          !living(courier) ||
          courier.mode === 'combat' ||
          !a.disguised ||
          a.weapon ||
          courier.known.includes(a.id) ||
          world.known.includes(a.id)
        ) {
          notify(
            world,
            'Handover refused. Use the maintenance disguise with weapons concealed and an unrecognized identity.',
            'warning',
          );
          break;
        }
        c.clearance = a.id;
        c.phase = 'secured';
        courier.path = [];
      }
      world.evidence = 'carried';
      a.carrying = true;
      a.weapon = false;
      notify(
        world,
        `${a.name} is carrying the ${world.mission.evidenceName.toLowerCase()}. Both hands occupied. X sets it down.${world.courier?.clearance === a.id ? ' Signed cargo clearance preserves your cover; dropping it voids the clearance.' : world.mission.objective !== 'escort' ? ' The cargo attracts suspicion even in uniform.' : ''}`,
      );
      break;
    case 'divert':
      if (world.courier) {
        world.courier.diverted = true;
        if (world.courier.phase !== 'ready') {
          world.courier.phase = 'transit';
          routeCourier(world);
        }
        notify(
          world,
          world.courier.phase === 'ready'
            ? 'Route set to INSPECTION. CALL starts the transfer when the crew is ready.'
            : 'Transfer redirected. The courier will head to INSPECTION when clear of contact.',
        );
      }
      break;
    case 'dispatch':
      if (world.courier) {
        world.courier.phase = 'transit';
        routeCourier(world);
        notify(
          world,
          `Transfer requested. Courier heading to ${world.courier.diverted ? 'INSPECTION' : 'the east checkpoint'}.`,
        );
      }
      break;
    case 'breach':
      if (world.mission.escort?.locked) {
        world.escortLocked = false;
        investigateNoise(world, a);
        raiseAlarm(world);
        notify(
          world,
          'Transport lock cut. Collect MARA; nearby guards heard the breach.',
          'warning',
        );
        break;
      }
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
    case 'extract':
    case 'alternate': {
      world.status = 'won';
      world.extractedAt = id;
      if (world.evidence === 'carried') world.evidence = 'extracted';
      notify(
        world,
        world.mission.objective === 'escort'
          ? `Contract fulfilled. ${world.escort!.name} is out. The crew is clear.`
          : `Contract fulfilled. The ${world.mission.evidenceName.toLowerCase()} is secured. The crew is clear.`,
      );
      break;
    }
  }
}
