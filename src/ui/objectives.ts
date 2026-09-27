import { distance, EXTRACTION_RADIUS, inside, isExtraction, living } from '../sim/types';
import type { ObjectKind, Vec, World } from '../sim/types';
import { landmark } from '../sim/orders';
import { clearedCargo, courierGuard } from '../sim/courier';
import { published } from '../sim/broadcast';

export type GoalId = 'primary' | 'evidence' | 'extract';
export type GuideTarget = ObjectKind | 'inspection';
export interface Goal {
  id: GoalId;
  label: string;
  complete: boolean;
  optional?: boolean;
  detail: string;
  targets: GuideTarget[];
}

/** Dispatch and route choice are independent; alarms do not cancel either. */
export function transferFeedback(w: World) {
  const c = w.courier;
  if (!c) return null;
  const guard = courierGuard(w),
    active = w.evidence === 'courier',
    interrupted =
      active &&
      !!guard &&
      (guard.mode === 'combat' || (guard.mode === 'challenge' && c.phase !== 'inspection')),
    needsCall = active && c.diverted && c.phase === 'ready';
  const route = c.diverted ? 'INSPECTION' : 'the east checkpoint';
  const diversion = c.diverted ? 'DIVERT set to INSPECTION.' : 'The east route is selected.';
  const state = {
    ready: c.diverted ? 'DIVERT set · CALL still needed' : 'Courier: awaiting CALL · east route',
    transit: `Courier: moving to ${c.diverted ? 'inspection' : 'east checkpoint'}`,
    checkpoint: `Courier: checkpoint · returns in ${Math.ceil(c.wait)}s`,
    returning: 'Courier: returning · CALL available on arrival',
    inspection: 'Courier: awaiting signature at INSPECTION',
    secured: w.evidence === 'available' ? 'Courier: CASE on the ground' : 'Courier: CASE recovered',
  };
  const reason = guard?.mode === 'combat' ? 'in combat' : 'checking an intruder';
  return {
    interrupted,
    needsCall,
    status: interrupted
      ? `Courier ${reason} · ${c.phase === 'ready' ? 'CALL not requested' : 'transfer paused'}`
      : state[c.phase],
    detail: interrupted
      ? `The courier is ${reason}${guard?.mode === 'combat' ? ' and will not accept a signature' : ''}. ${diversion} ${c.phase === 'ready' ? 'CALL has not been requested yet.' : `The transfer is paused; the courier resumes ${c.phase === 'returning' ? 'returning to the depot' : `the route to ${route}`} after contact clears.`} Break contact, or defeat the courier and recover CASE.`
      : c.phase === 'ready'
        ? `${diversion} CALL has not been requested: diversion sets the route, it does not dispatch the courier. Send an operative to CALL to start the transfer.${w.alarm ? ' The site alarm has not cancelled the route.' : ''}`
        : state[c.phase],
  };
}

/** Resolve people and cargo when drawing, so a pinned locator follows its subject. */
export function guideLocation(
  world: World,
  id: GuideTarget,
): (Vec & { tag: string; z: number }) | null {
  if (id === 'inspection')
    return world.mission.transfer
      ? { ...world.mission.transfer.inspection, tag: 'INSPECTION', z: 0 }
      : null;
  if (!world.mission.landmarks.some((o) => o.id === id)) return null;
  const location = landmark(world, id);
  const carrier =
    id === 'evidence' && world.evidence === 'carried'
      ? world.agents.find((a) => living(a) && a.carrying)
      : null;
  return {
    ...location,
    ...(carrier ? { x: carrier.x, y: carrier.y } : {}),
    z: carrier ? 0.5 : id === 'evidence' && world.evidence === 'courier' ? 2.1 : 1.45,
  };
}

/** Guidance describes available choices; it never issues orders or changes the simulation. */
export function missionGoals(w: World): Goal[] {
  const m = w.mission,
    v = w.escort,
    c = w.courier;
  const cover = w.agents.find((a) => living(a) && a.disguised && !a.exposed);
  const kit: GuideTarget[] = w.disguiseTaken ? [] : ['disguise'];
  const evidenceInArchive = !!m.archive && inside(w.evidencePosition, m.secure);
  let primary: Goal;
  if (w.broadcast) {
    const b = w.broadcast;
    const operator = w.agents.find((a) => a.id === b.maskBy);
    primary = {
      id: 'primary',
      label: published(w) ? '✓ Audit published' : '○ Publish Mara’s audit',
      complete: published(w),
      detail: published(w)
        ? 'The audit is public. Both workstations are released. Bring everyone to VAN, including the operative on the west street. LOG is optional.'
        : b.traced
          ? 'The terminal has been traced; LOOP can no longer hide it. Defend an operative working UPLINK to finish the upload. Progress is saved when interrupted. RADIO stops reinforcements, but nearby guards still investigate.'
          : `${operator ? `${operator.name} holds LOOP. Select another operative for UPLINK.` : 'Assign one operative to Hold LOOP on the west street, then select a second to Work UPLINK.'} UPLINK needs 24 seconds with free hands; the operator cannot fire while working. Moving or Hold pauses work and saves progress. Without LOOP, five seconds of uploading draws guards. KIT helps outside the server room. Its patrol challenges uniforms: withdraw behind the racks when challenged, then resume.`,
      targets: published(w)
        ? ['extract']
        : b.traced
          ? ['upload', ...(!w.relayOff ? ['relay' as const] : [])]
          : ['mask', 'upload', ...kit],
    };
  } else if (c && w.evidence === 'courier') {
    const feedback = transferFeedback(w)!;
    const inContact = feedback.interrupted;
    primary = {
      id: 'primary',
      complete: false,
      label: inContact
        ? '○ Courier interrupted · break contact or ambush'
        : c.phase === 'inspection'
          ? '○ Collect CASE at inspection'
          : c.diverted && c.phase === 'ready'
            ? '○ Use CALL to start the transfer'
            : c.diverted
              ? '○ Meet the courier at inspection'
              : '○ Divert or ambush the courier',
      detail: inContact
        ? feedback.detail
        : c.phase === 'inspection'
          ? 'The courier is waiting. Order a disguised, unrecognized operative with weapons concealed to interact with CASE. An armed ambush is also possible.'
          : c.diverted && c.phase === 'ready'
            ? feedback.detail
            : c.diverted
              ? 'The courier is heading to INSPECTION. Wait there with a disguised operative and concealed weapons, then interact with CASE when the courier stops.'
              : 'Watch the west patrol: changing DIVERT takes three seconds and raises suspicion if seen, even in disguise. Wait for their back to turn, set the inspection route, then use CALL. You can also ambush the patrolling courier and recover CASE. A returning courier must reach the depot before CALL works again.',
      targets: inContact
        ? ['evidence']
        : c.phase === 'inspection'
          ? ['evidence', ...kit]
          : c.diverted && c.phase === 'ready'
            ? ['dispatch', 'inspection']
            : c.diverted
              ? ['evidence', 'inspection']
              : c.phase === 'ready'
                ? ['divert', 'dispatch', 'evidence']
                : ['divert', 'evidence'],
    };
  } else if (c) {
    primary = {
      id: 'primary',
      label: '✓ Courier intercepted',
      complete: true,
      detail:
        w.evidence === 'available'
          ? 'CASE is on the ground. Order an operative to collect it before withdrawing.'
          : 'The account keys are recovered. Bring their carrier and every survivor to VAN.',
      targets: ['evidence', 'extract'],
    };
  } else if (m.archive) {
    const operator = w.agents.find((a) => a.id === w.overrideBy);
    const ledgerOutside = w.evidence !== 'available' || !evidenceInArchive;
    primary = {
      id: 'primary',
      complete: ledgerOutside || w.shutterOpen,
      label: ledgerOutside
        ? '✓ Archive accessed'
        : w.shutterBreached
          ? '✓ Archive shutter forced'
          : w.shutterOpen
            ? '✓ Archive shutter open'
            : '○ Open archive shutter',
      detail: ledgerOutside
        ? `${w.evidence === 'available' ? 'LEDGER was left outside the archive. Collect it where it lies.' : 'The ledger is recovered.'}${operator ? ' Bring the shunt operator along when you withdraw;' : ' The carrier and'} every survivor must reach VAN.`
        : w.shutterBreached
          ? 'The cut lock stays open. Send an operative to LEDGER; carrying it needs both hands.'
          : operator
            ? `${operator.name} is holding SHUNT. Select a different operative and send them to LEDGER. Moving ${operator.name} or using Hold releases the shutter.`
            : w.shutterOpen
              ? 'The doorway is occupied. Assign someone to SHUNT to keep it open while another operative collects LEDGER, or use CUT once the shutter closes.'
              : 'Leave one operative at SHUNT while a second enters for LEDGER. Changing selection keeps the shunt held. Alternatively, CUT forces the lock in eight noisy seconds.',
      targets: ledgerOutside
        ? [
            ...(operator ? ['override' as const] : []),
            ...(w.evidence === 'available' ? ['evidence' as const] : []),
            'extract',
          ]
        : w.shutterBreached
          ? ['evidence']
          : w.shutterOpen
            ? ['override', 'evidence']
            : ['override', 'breach'],
    };
  } else if (w.escortLocked) {
    primary = {
      id: 'primary',
      label: '○ Unlock the transport',
      complete: false,
      detail:
        w.disguiseTaken && !cover
          ? 'The maintenance identity is lost or exposed. Use CUT at the transport: it takes eight seconds and attracts nearby guards. Collect MARA after preparing the escape.'
          : `Quiet: ${cover ? `use ${cover.name} with free hands and weapons concealed at WARRANT` : 'take KIT, then use WARRANT with that operative’s weapon concealed'}. Loud: CUT the lock for eight seconds. Unlocking leaves Mara protected until you collect her.`,
      targets: w.disguiseTaken && !cover ? ['breach'] : [...kit, 'release', 'breach'],
    };
  } else {
    const name = v?.name || 'the witness';
    primary = {
      id: 'primary',
      complete: !!v?.recruited,
      label: v?.recruited
        ? `✓ ${name} ${v.waiting ? 'waiting for escort' : 'following escort'}`
        : `○ Locate ${name}`,
      detail: v?.recruited
        ? `${name} ${v.waiting ? 'is waiting. Use the Escort controls to resume following' : 'follows the operative who recruited them'}. Interact with their marker to hand off the escort.${m.escort?.vulnerable ? ' Guards recognize Mara; use cover, wait/follow, and nearby first aid.' : ' Bring the whole crew to VAN.'}`
        : m.escort?.locked
          ? 'The transport is unlocked. Interact with MARA when the escape route is ready. She moves slowly and guards can shoot her once collected.'
          : 'Interact with VOSS to recruit her. KIT provides one maintenance disguise; the secure office still attracts suspicion. An armed squad can also reach her.',
      targets: v?.recruited || m.escort?.locked ? ['escort'] : ['escort', ...kit],
    };
  }

  const carrier = w.agents.find((a) => living(a) && a.carrying);
  const tag = landmark(w, 'evidence').tag;
  const optionalEvidence = m.objective === 'escort' || m.objective === 'broadcast';
  const evidence: Goal = {
    id: 'evidence',
    optional: optionalEvidence,
    complete: w.evidence === 'carried' || w.evidence === 'extracted',
    label:
      w.evidence === 'courier'
        ? '○ Access case · with courier'
        : w.evidence === 'available'
          ? `${optionalEvidence ? '◇' : '○'} ${m.evidenceName} · ${optionalEvidence ? 'optional' : 'required'}`
          : w.evidence === 'carried'
            ? `✓ ${m.evidenceName} carried`
            : '✓ Evidence secured',
    detail: carrier
      ? `${carrier.name} carries ${tag}; the locator follows them. Both hands are occupied. X sets it down so another operative can collect it.${clearedCargo(w, carrier) ? ' Dropping CASE voids its signed clearance.' : ''}`
      : w.evidence === 'extracted'
        ? 'The evidence has been extracted.'
        : w.evidence === 'courier'
          ? 'CASE travels with the courier. Use DIVERT and CALL for an inspection handover in disguise, or defeat the courier and collect the dropped case.'
          : evidenceInArchive && !w.shutterOpen
            ? 'LEDGER is inside the locked archive. Keep one operative at SHUNT while another collects it, or force the lock with CUT. The ledger is required for extraction.'
            : `Interact with ${tag} to collect it. It slows its carrier and needs both hands.${optionalEvidence ? ' This evidence is optional; you can complete the operation without it.' : ' Bring its carrier to VAN; extraction requires the evidence.'}${m.broadcast ? ' The log attracts suspicion, even in uniform. Set it down before working LOOP or UPLINK.' : ''}`,
    targets:
      w.evidence === 'extracted'
        ? ['extract']
        : evidenceInArchive && !w.shutterOpen && w.evidence === 'available'
          ? ['evidence', 'override', 'breach']
          : ['evidence'],
  };
  const exits = m.landmarks.filter((o) => isExtraction(o.id));
  const eastGate = !w.gateOpen && exits.some((exit) => exit.x > m.gate.x);
  const counts = exits
    .map((exit) => {
      const crew = w.agents.filter(
        (a) => living(a) && distance(a, exit) <= EXTRACTION_RADIUS,
      ).length;
      return `${exit.tag}: ${crew}/${w.agents.filter(living).length} crew${v?.recruited && distance(v, exit) <= EXTRACTION_RADIUS ? ` + ${v.name}` : ''}`;
    })
    .join(' · ');
  const extraction: Goal = {
    id: 'extract',
    complete: w.status === 'won',
    label:
      w.status === 'won'
        ? `✓ Extracted${w.extractedAt ? ` at ${landmark(w, w.extractedAt).tag}` : ''}`
        : exits.length > 1
          ? '○ Extract at STREET or SERVICE'
          : '○ Extract at the van',
    detail: `Use the controls beside the extraction goal to rally every survivor and leave. Or select the crew and right-click or tap the van or its diamond. The order waits for ${v ? `${v.name} and ` : m.broadcast ? 'the audit to be published and ' : `the ${tag} carrier and `}every surviving operative inside the same extraction ring.${v?.waiting ? ` ${v.name} is waiting: ask them to follow.` : ''}${exits.length > 1 ? ' STREET is short and exposed; SERVICE is longer, via the screened corridor.' : ''}${eastGate ? ' Open GATE from inside for the east exit.' : ''}${m.broadcast ? ' Bring the LOOP operator along the public south street; LOG is optional.' : ''} ${counts}.`,
    targets: [...exits.map((o) => o.id), ...(eastGate ? ['gate' as const] : [])],
  };
  return [primary, evidence, extraction];
}
