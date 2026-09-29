import {
  controllable,
  disoriented,
  isAccess,
  isRescue,
  distance,
  inside,
  isCharge,
  isExtraction,
  isPower,
  isSettlement,
  living,
  EXTRACTION_RADIUS,
} from './types';
import type { Landmark, ObjectKind, Operative, Vec, World } from './types';
import { findPath, lineClear } from './navigation';
import { formationTargets } from './formation';
import { notify } from './world';
import { investigateNoise, raiseAlarm } from './awareness';
import { updateShutter } from './shutter';
import { courierGuard, routeCourier } from './courier';
import { BROADCAST_SETUP_TIME, published, workBroadcast } from './broadcast';
import { demolished, detonationStatus } from './demolition';
import { cancelCharge, longGun } from './weapons';
import { detentionAvailable, detentionRefusal, workDetention, rescueComplete } from './detention';
import { canAuthorise, inspectionRemaining } from './security';
import { extractionPath } from './extraction-routing';
import { SETTLEMENT_SETUP, settled, settlementRefusal, workSettlement } from './settlement';

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
    detentionAvailable(world, id) &&
    !(
      (id === 'disguise' && world.disguiseTaken) ||
      (id === 'gate' && world.gateOpen) ||
      (id === 'relay' && world.relayOff) ||
      (id === 'authorise' && (!world.security || world.security.inspectionUsed)) ||
      (isPower(id) && (!world.security || world.security.isolated.includes(id))) ||
      (id === 'escort' && (!world.escort || !living(world.escort) || world.escortLocked)) ||
      (id === 'release' && !world.escortLocked) ||
      (id === 'evidence' &&
        world.evidence !== 'available' &&
        !(world.evidence === 'courier' && world.courier?.phase === 'inspection')) ||
      (id === 'divert' && (world.courier?.diverted || world.evidence !== 'courier')) ||
      (id === 'dispatch' && (world.courier?.phase !== 'ready' || world.evidence !== 'courier')) ||
      (id === 'override' && world.shutterBreached) ||
      (isSettlement(id) &&
        (!world.settlement ||
          settled(world) ||
          (id === 'reconcile' && world.settlement.reconciled))) ||
      (id === 'upload' && published(world)) ||
      (id === 'mask' && (published(world) || world.broadcast?.traced)) ||
      (isCharge(id) && (!world.demolition || world.demolition.armed.includes(id))) ||
      (id === 'breach' && (world.mission.archive ? world.shutterOpen : !world.escortLocked))
    )
  );
}
export function interactionPoint(world: World, agent: Operative, id: ObjectKind): Vec {
  if (id === 'gate' && !world.mission.gateInsideOnly && !inside(agent, world.mission.restricted))
    return world.mission.gateOutside;
  if (id === 'breach' && world.mission.archive && inside(agent, world.mission.secure))
    return world.mission.archive.inside;
  return landmark(world, id);
}
export function interactionDuration(world: World, agent: Operative, id: ObjectKind) {
  if (id === 'reconcile') return world.mission.settlement!.reconcileTime;
  if (isSettlement(id)) return SETTLEMENT_SETUP;
  if (isRescue(id)) return 2;
  if (id === 'equipment' || id === 'escape-release') return 1.5;
  if (isPower(id)) return 4;
  if (id === 'authorise') return 2;
  if (id === 'breach') return 8;
  if (id === 'divert') return 3;
  if (id === 'release') return 3;
  if (id === 'gate' && !inside(agent, world.mission.restricted)) return 3;
  if (id === 'mask' || id === 'upload') return BROADCAST_SETUP_TIME;
  if (isCharge(id)) return world.mission.demolition!.armTime;
  return id === 'relay' ? (world.mission.relayTime ?? 1.5) : id === 'override' ? 0.8 : 0.65;
}
export function moveAgents(world: World, ids: string[], target: Vec) {
  const agents = world.agents.filter((a) => ids.includes(a.id) && controllable(a));
  const destinations = formationTargets(world, agents, target);
  agents.forEach((a, i) => {
    const destination = destinations[i];
    a.path = findPath(world, a, destination);
    a.order = { kind: 'move', target: destination };
    cancelCharge(a);
    a.interaction = 0;
    if (!a.path.length && distance(a, destination) > 0.5)
      notify(world, 'No clear route. Open the loading gate or use the west entrance.');
  });
}
function interactionRefusal(world: World, a: Operative, id: ObjectKind): string | null {
  const settlementReason = settlementRefusal(world, a, id);
  if (settlementReason) return settlementReason;
  const detentionReason = detentionRefusal(world, a, id);
  if (detentionReason) return detentionReason;
  if (id === 'disguise' && longGun(a))
    return 'KIT needs a concealable pistol. Select Morrow or Vale; long guns remain visible when stowed.';
  if (
    a.carrying &&
    [
      'override',
      'breach',
      'divert',
      'dispatch',
      'release',
      'mask',
      'upload',
      'charge-west',
      'charge-east',
      'authorise',
      'power-west',
      'power-east',
    ].includes(id)
  )
    return 'Set the cargo down before working these controls.';
  if (id === 'release' && (!a.disguised || a.weapon || a.exposed))
    return 'Release refused. WARRANT requires a maintenance identity that has not been exposed, with weapons concealed.';
  if (id === 'authorise' && !canAuthorise(world, a))
    return 'INSPECT requires an unexposed maintenance identity with a concealed pistol and free hands. Use KIT with Morrow or Vale, or isolate the feeds from cover.';
  if (id === 'evidence' && world.evidence === 'courier') {
    const courier = courierGuard(world);
    if (
      !courier ||
      !living(courier) ||
      courier.mode === 'combat' ||
      !a.disguised ||
      a.weapon ||
      courier.known.includes(a.id) ||
      world.known.includes(a.id)
    )
      return 'Handover refused. Use the maintenance disguise with weapons concealed and an unrecognized identity.';
  }
  return null;
}
export function interact(world: World, ids: string[], id: ObjectKind) {
  if (!available(world, id)) {
    if (id === 'authorise' && world.security?.inspectionUsed)
      notify(
        world,
        inspectionRemaining(world) > 0
          ? `Inspection active for ${Math.ceil(inspectionRemaining(world))}s. Isolate WEST and EAST while the guns are stopped.`
          : 'Inspection already used. WEST and EAST can still be isolated, or destroy the turrets.',
      );
    if (isPower(id) && world.security?.isolated.includes(id))
      notify(world, `${landmark(world, id).tag} is isolated. Its two sentries stay off.`);
    if (isCharge(id) && world.demolition)
      notify(
        world,
        demolished(world)
          ? 'Both backups are destroyed. Bring the crew to VAN.'
          : `${landmark(world, id).tag} is already armed. ${detonationStatus(world).reason ?? 'Crew clear. Use Detonate to destroy both backups.'}`,
      );
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
  const agents = world.agents.filter((a) => ids.includes(a.id) && controllable(a));
  const target = landmark(world, id);
  if (isExtraction(id)) {
    // Extraction is a crew order. Sending only the nearest operative strands
    // everyone else (and the witness following them) at their previous orders.
    for (const a of agents) {
      if (a.order.kind === 'interact' && a.order.target === id) continue;
      a.order = { kind: 'interact', target: id };
      cancelCharge(a);
      a.interaction = 0;
      a.path = extractionPath(world, a, target);
    }
    if (agents.length)
      notify(
        world,
        `Selected crew heading to ${target.tag}. Extraction will wait for every survivor and the objective.`,
      );
    return;
  }
  if (!agents.length) return;
  const assigned = (a: Operative) => a.order.kind === 'interact' && a.order.target === id;
  agents.sort(
    (a, b) =>
      Number(assigned(b)) - Number(assigned(a)) || distance(a, target) - distance(b, target),
  );
  const eligible = agents.filter((a) => !interactionRefusal(world, a, id));
  for (const a of eligible) {
    const point = interactionPoint(world, a, id);
    const path = findPath(world, a, point);
    const end = path.at(-1) ?? a;
    if (distance(end, point) >= 1.15 || !lineClear(world, end, point)) continue;
    if (assigned(a)) return; // Repeated squad clicks preserve the current worker's progress.
    a.order = { kind: 'interact', target: id };
    cancelCharge(a);
    a.interaction = 0;
    a.path = path;
    if (id === 'disguise' && a.armament)
      notify(world, `${a.name} is heading to KIT with a concealable pistol.`);
    return;
  }
  notify(
    world,
    eligible.length
      ? (id === 'evidence' || id === 'relay') && world.mission.archive && !world.shutterOpen
        ? `${world.mission.archive.name ? 'Control office' : 'Archive'} locked. Assign another operative to SHUNT, or use CUT at the shutter.`
        : `No selected operative can reach ${target.tag}.`
      : interactionRefusal(world, agents[0], id)!,
  );
}
export function hold(world: World, ids: string[]) {
  for (const a of world.agents)
    if (ids.includes(a.id) && !a.captive) {
      a.order = { kind: 'hold' };
      a.path = [];
      a.interaction = 0;
    }
}
export function toggleWeapons(world: World, ids: string[]) {
  const agents = world.agents.filter(
    (a) => ids.includes(a.id) && controllable(a) && !a.carrying && !a.disarmed,
  );
  const draw = agents.some((a) => !a.weapon);
  for (const a of agents) {
    a.weapon = draw;
    if (!draw) cancelCharge(a);
    if (!draw && a.order.kind === 'attack') {
      a.order = { kind: 'hold' };
      a.path = [];
    }
  }
}
export function attack(world: World, ids: string[], target: string) {
  for (const a of world.agents)
    if (ids.includes(a.id) && controllable(a) && !a.carrying && !a.disarmed) {
      a.weapon = true;
      if (a.armament?.charging?.target !== target) cancelCharge(a);
      a.order = { kind: 'attack', target };
      a.path = [];
    }
}
export function heal(world: World, ids: string[]) {
  for (const a of world.agents)
    if (ids.includes(a.id) && controllable(a) && a.medkit && a.hp < a.maxHp) {
      a.hp = Math.min(a.maxHp, a.hp + 55);
      a.medkit = false;
      notify(world, `${a.name} used a field dressing.`);
      world.sounds.push({ kind: 'interact', action: 'heal', x: a.x, y: a.y });
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
export function escortMedic(world: World, ids: string[]) {
  const escort = world.escort;
  if (!escort?.recruited || !living(escort) || escort.hp >= escort.maxHp) return;
  return world.agents
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
}
export function treatEscort(world: World, ids: string[]) {
  const escort = world.escort;
  if (!escort?.recruited || !living(escort) || escort.hp >= escort.maxHp) return;
  const medic = escortMedic(world, ids);
  if (!medic) {
    notify(
      world,
      `Bring a selected operative with a field dressing and free hands next to ${escort.name}.`,
    );
    return;
  }
  medic.medkit = false;
  escort.hp = Math.min(escort.maxHp, escort.hp + 55);
  world.sounds.push({ kind: 'interact', action: 'heal', x: medic.x, y: medic.y });
  notify(world, `${medic.name} used their field dressing to treat ${escort.name}.`);
}
export function dropEvidence(world: World, ids: string[]) {
  for (const a of world.agents)
    if (ids.includes(a.id) && a.carrying) {
      a.carrying = false;
      world.evidence = 'available';
      world.evidencePosition = { x: a.x, y: a.y };
      world.sounds.push({ kind: 'interact', action: 'drop', x: a.x, y: a.y });
      if (world.courier) world.courier.clearance = null;
      notify(world, `${world.mission.evidenceName} set down. Another operative can collect it.`);
    }
}
/** A whole-crew rally must not abandon a held shutter with people still inside. */
export function extractionRallyBlocker(world: World): string | null {
  if (world.detention && !world.detention.released)
    return 'Keep a partner at the remote console. Free both prisoners, then use EXIT inside detention before rallying.';
  if (!world.mission.archive || world.shutterBreached || !world.overrideBy) return null;
  const insideArchive = world.agents.filter((p) => living(p) && inside(p, world.mission.secure));
  return insideArchive.length
    ? `Move ${insideArchive.map((p) => p.name).join(', ')} outside the ${world.mission.archive.name ?? 'archive'} before rallying. Keep SHUNT held until they clear the shutter.`
    : null;
}

/** Shared by boarding and the HUD so the displayed readiness cannot disagree. */
export function extractionStatus(world: World, id: 'extract' | 'alternate') {
  const van = landmark(world, id),
    survivors = world.agents.filter(living),
    missing = survivors.filter((p) => distance(p, van) > EXTRACTION_RADIUS),
    carrier = survivors.find((p) => p.carrying),
    v = world.escort;
  const waiting =
    world.settlement && !settled(world)
      ? 'Reconcile REGISTER at CHECK, then staff SIGN and CLEAR together to release repayments.'
      : world.detention && (!rescueComplete(world) || world.agents.some((p) => !living(p)))
        ? 'Free Vale and Rook and bring all four operatives home alive.'
        : world.detention && !world.detention.released
          ? 'Use EXIT inside detention to release both gates before leaving.'
          : world.demolition && !demolished(world)
            ? 'Destroy both debt backups before requesting extraction.'
            : world.mission.broadcast && !published(world)
              ? world.mission.broadcast.subject
                ? `Finish uploading ${world.mission.broadcast.subject} at UPLINK before requesting extraction.`
                : "Publish Mara's audit at UPLINK before requesting extraction."
              : ['ledger', 'case', 'settlement'].includes(world.mission.objective) &&
                  (!carrier || distance(carrier, van) > EXTRACTION_RADIUS)
                ? `Bring the ${world.mission.evidenceName.toLowerCase()} to ${van.tag}. It is required for this contract.`
                : v && (!v.recruited || !living(v))
                  ? `Bring ${v.name} out alive before requesting extraction.`
                  : v && distance(v, van) > EXTRACTION_RADIUS
                    ? v.waiting
                      ? `Waiting for ${v.name}. Use the Escort controls to ask them to follow.`
                      : `Waiting for ${v.name} at ${van.tag}. Bring their escort to the van.`
                    : missing.length
                      ? `Waiting for ${missing.map((p) => p.name).join(', ')}. Bring every survivor inside the extraction ring.`
                      : null;
  return {
    ready: survivors.length > 0 && !waiting,
    waiting,
    present: survivors.length - missing.length,
    total: survivors.length,
  };
}
export function completeInteraction(world: World, a: Operative, id: ObjectKind) {
  if (!controllable(a) || disoriented(a)) return;
  const refusal = interactionRefusal(world, a, id);
  if (refusal) {
    a.order = { kind: 'hold' };
    a.path = [];
    a.interaction = 0;
    notify(world, refusal, 'warning');
    return;
  }
  if (
    world.detention &&
    (isAccess(id) || isRescue(id) || id === 'equipment' || id === 'escape-release')
  ) {
    if (available(world, id)) workDetention(world, a, id);
    return;
  }
  if (isSettlement(id) && available(world, id)) {
    workSettlement(world, a, id);
    return;
  }
  if ((id === 'mask' || id === 'upload') && available(world, id)) {
    workBroadcast(world, a, id);
    return;
  }
  if (id === 'override' && available(world, id) && !a.carrying) {
    const previous = world.agents.find((p) => p.id === world.overrideBy && p.id !== a.id);
    if (previous?.order.kind === 'interact' && previous.order.target === 'override') {
      previous.order = { kind: 'hold' };
      previous.interaction = 0;
    }
    if (world.overrideBy !== a.id) {
      world.sounds.push({ kind: 'interact', action: 'override', x: a.x, y: a.y });
      notify(
        world,
        `${a.name} is holding the ${world.mission.archive?.name ?? 'archive'} shutter open. Move or Hold releases the shunt.`,
      );
    }
    world.overrideBy = a.id;
    a.order = { kind: 'interact', target: id };
    a.path = [];
    updateShutter(world);
    return;
  }
  if (isExtraction(id)) {
    const { waiting } = extractionStatus(world, id);
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
  world.sounds.push({ kind: 'interact', action: id, x: a.x, y: a.y });
  switch (id) {
    case 'authorise':
      world.security!.inspectionUsed = true;
      world.security!.inspectionUntil = world.time + world.mission.security!.inspectionTime;
      notify(
        world,
        `Inspection authorised. All turrets are off for ${world.mission.security!.inspectionTime}s. Isolate WEST and EAST for a permanent shutdown; guards still patrol.`,
      );
      break;
    case 'power-west':
    case 'power-east':
      world.security!.isolated.push(id);
      if (inspectionRemaining(world) === 0) investigateNoise(world, a);
      notify(
        world,
        `${landmark(world, id).tag} isolated. Its two turrets are permanently offline.${inspectionRemaining(world) === 0 ? ' Nearby guards heard the breaker trip.' : ''}`,
      );
      break;
    case 'charge-west':
    case 'charge-east':
      world.demolition!.armed.push(id);
      notify(
        world,
        `${landmark(world, id).tag} armed (${world.demolition!.armed.length}/2). No timer: the charge stays planted. Clear both marked blast areas before using Detonate.`,
      );
      break;
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
      notify(
        world,
        `Radio relay disabled. No further reinforcements can be called.${world.security ? ' Wired turrets are still independent: use INSPECT, WEST or EAST.' : ''}`,
      );
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
      world.escortLocked = false;
      notify(
        world,
        'Release filed. The transport is unlocked. Collect MARA when the escape route is ready; the forged paperwork will not fool a guard who sees her.',
      );
      break;
    case 'evidence':
      if (world.evidence === 'courier') {
        const courier = courierGuard(world)!,
          c = world.courier!;
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
        `${world.mission.archive?.name ? 'Control-office' : 'Archive'} lock cut. The shutter stays open. Nearby guards are investigating.`,
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
        world.detention
          ? 'Vale and Rook recovered. All four are clear; the mandate stays with Mara.'
          : world.mission.objective === 'demolition'
            ? 'Contract fulfilled. The debt backups are destroyed. The crew is clear.'
            : world.mission.objective === 'broadcast'
              ? `Contract fulfilled. ${world.mission.broadcast?.completed ?? "Mara's audit is public"}. The crew is clear.`
              : world.mission.objective === 'escort'
                ? `Contract fulfilled. ${world.escort!.name} is out. The crew is clear.`
                : `Contract fulfilled. The ${world.mission.evidenceName.toLowerCase()} is secured. The crew is clear.`,
      );
      break;
    }
  }
}
