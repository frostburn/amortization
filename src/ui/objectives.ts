import { liftReady, liftRemaining } from '../sim/threshold';
import { captureReady, kestrelRemoved } from '../sim/floors';
import {
  distance,
  EXTRACTION_RADIUS,
  inside,
  isExtraction,
  living,
  requiresCargo,
} from '../sim/types';
import type { ObjectKind, Vec, World } from '../sim/types';
import { landmark } from '../sim/orders';
import { clearedCargo, courierGuard } from '../sim/courier';
import { published } from '../sim/broadcast';
import { settled, settlementStatus } from '../sim/settlement';
import { extractionRequirement } from './extraction';
import { demolished, detonationStatus } from '../sim/demolition';
import { activeTurrets, inspectionRemaining } from '../sim/security';

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
    ...(carrier
      ? { x: carrier.x, y: carrier.y, ...(world.mission.building ? { floor: carrier.floor } : {}) }
      : {}),
    z: carrier ? 0.5 : id === 'evidence' && world.evidence === 'courier' ? 2.1 : 1.45,
  };
}

/** Guidance describes available choices; it never issues orders or changes the simulation. */
export function missionGoals(w: World): Goal[] {
  const m = w.mission,
    v = w.escort,
    c = w.courier;
  const cargoTag = landmark(w, 'evidence').tag;
  const cover = w.agents.find((a) => living(a) && a.disguised && !a.exposed);
  const kit: GuideTarget[] = w.disguiseTaken ? [] : ['disguise'];
  const evidenceInArchive = !!m.archive && inside(w.evidencePosition, m.secure);
  let primary: Goal;
  if (w.threshold) {
    const ready = liftReady(w),
      remaining = liftRemaining(w);
    primary = {
      id: 'primary',
      complete: ready,
      label: ready
        ? '✓ Service lift ready'
        : remaining === null
          ? '○ Call the tower lift'
          : `○ Lift arriving · ${Math.ceil(remaining)}s`,
      detail: ready
        ? 'The lift will wait. Bring KEY and every survivor to LIFT, then order boarding. A dropped key remains recoverable; you do not need to call again.'
        : remaining === null
          ? 'Recover KEY from dispatch and have its carrier work LINK for five seconds. The car takes eighteen seconds to arrive. Its wired bell draws the existing lobby reserve to LINK; RADIO does not stop it. The northern staff walk and lobby screens provide cover.'
          : 'The car is on its way. The reserve investigates LINK, not your unseen location. Get the crew behind cover; the lift stays available once it arrives.',
      targets: ready
        ? ['extract', 'evidence']
        : remaining === null
          ? ['evidence', 'key-lift']
          : ['extract', 'key-lift'],
    };
  } else if (m.continuity) {
    const removed = kestrelRemoved(w),
      cuffed = !!v?.recruited;
    primary = {
      id: 'primary',
      complete: removed,
      label: removed
        ? cuffed
          ? '✓ Kestrel in handcuffs'
          : '✓ Kestrel eliminated'
        : '○ Remove Kestrel · upper floor',
      detail: removed
        ? cuffed
          ? 'Escort Kestrel down the stairs and to VAN. She follows the operative who cuffed her; use wait/follow or interact with CUFF to hand her to a partner.'
          : 'Kestrel’s controller is stopped. Use DOWN and bring every survivor to VAN.'
        : 'Reach the upper floor via UP. For an arrest, isolate WEST and EAST downstairs, then interact with CUFF for three seconds with free hands. To kill her, attack her body. Either outcome ends her command. RADIO does not stop the wired defenses.',
      targets: removed
        ? cuffed
          ? ['escort', 'stairs-down', 'extract']
          : ['stairs-down', 'extract']
        : captureReady(w)
          ? ['stairs-up', 'escort']
          : ['power-west', 'power-east', 'stairs-up', 'escort'],
    };
  } else if (w.recall) {
    const carrier = w.agents.find((a) => living(a) && a.carrying);
    const filing = carrier?.order.kind === 'interact' && carrier.order.target === 'file-recall';
    primary = {
      id: 'primary',
      complete: w.recall.filed,
      label: w.recall.filed
        ? '✓ Seizure dispatches cancelled'
        : !carrier
          ? '○ Collect RECALL'
          : filing
            ? `○ File RECALL · ${Math.floor((100 * carrier.interaction) / m.recall!.filingTime)}%`
            : '○ Bring RECALL to FILE',
      detail: w.recall.filed
        ? 'Filing complete. Bring the original RECALL and every survivor to VAN. Dropping or handing over the original does not undo the recall.'
        : 'Collect the signed RECALL in the north records office. Its carrier must work FILE in the south-east booth for nine uninterrupted seconds, then bring the original home. Movement, Hold or a flash cancels unfinished work. The carrier cannot shoot; prepare the route or protect them.',
      targets: w.recall.filed
        ? ['extract', ...(!carrier ? ['evidence' as const] : [])]
        : carrier
          ? ['file-recall', 'evidence']
          : ['evidence'],
    };
  } else if (w.settlement) {
    const done = settled(w),
      hasRegister = w.agents.some((a) => living(a) && a.carrying);
    primary = {
      id: 'primary',
      complete: done,
      label: done
        ? '✓ Repayments released'
        : !hasRegister
          ? '○ Collect REGISTER'
          : !w.settlement.reconciled
            ? '○ Reconcile REGISTER at CHECK'
            : `○ Release repayments · ${Math.floor((100 * w.settlement.progress) / m.settlement!.duration)}%`,
      detail:
        settlementStatus(w) +
        ' Daylight extends human sight by 50%; solid cover still blocks vision. At least two operatives must survive until the transfer is complete.',
      targets: done
        ? ['extract']
        : !hasRegister
          ? ['evidence', ...(!w.shutterOpen ? ['override' as const, 'breach' as const] : [])]
          : !w.settlement.reconciled
            ? ['reconcile', 'evidence']
            : ['countersign', 'settle'],
    };
  } else if (w.detention) {
    const remaining = m.detention!.cells.filter((c) => w.agents[c.agent].captive);
    const operator = w.agents.find((a) => a.id === w.detention!.operator);
    primary = {
      id: 'primary',
      complete: w.detention.released,
      label: remaining.length
        ? `○ Rescue the crew · ${2 - remaining.length} / 2 free`
        : w.detention.released
          ? '✓ Crew free · gates released'
          : '○ Use EXIT to release the gates',
      detail: w.detention.released
        ? 'Both gates stay open. Time each unarmed teammate’s exit behind the cell patrol, then bring all four to VAN. GEAR and the register are optional. All four must survive.'
        : remaining.length
          ? `${operator ? `${operator.name} holds ${w.detention.circuit === 'access-intake' ? 'INTAKE' : 'CELLS'}. The gate buttons switch that operator without changing selection. ` : 'Send Sable to Hold INTAKE at the west remote console. '}Give Morrow KIT and cross the amber gate, then switch the console to CELLS for the blue gate. Keep the console staffed while a different operative works each local prisoner lock. Door safety does not power a cell release; RADIO does not disable locks. Rescued teammates become controllable but unarmed. Use EXIT after freeing both.`
          : 'Vale and Rook are controllable. Use EXIT inside holding to latch both gates open; the console operator can then leave. Each prisoner can recover their own GEAR, or leave unarmed.',
      targets: remaining.length
        ? [...kit, 'access-intake', 'access-cells', ...remaining.map((c) => c.id)]
        : w.detention.released
          ? ['equipment', 'extract']
          : ['escape-release'],
    };
  } else if (w.security) {
    const remaining = (['power-west', 'power-east'] as const).filter(
      (id) =>
        w.guards.some((g) => g.turret?.circuit === id && living(g)) &&
        !w.security!.isolated.includes(id),
    );
    const inspection = inspectionRemaining(w);
    const identityLost = w.disguiseTaken && !cover;
    primary = {
      id: 'primary',
      optional: true,
      complete: remaining.length === 0,
      label:
        remaining.length === 0
          ? '✓ Sentry circuits neutralised'
          : inspection > 0
            ? `○ Inspection · ${Math.ceil(inspection)}s remaining`
            : `◇ Prepare the crossing · ${activeTurrets(w).length} turrets live`,
      detail:
        remaining.length === 0
          ? 'The turrets cannot restart. Human guards still patrol. Collect MANDATE from the north records room, open GATE from inside, and bring every survivor to VAN.'
          : `${inspection > 0 ? `Turrets are stopped for ${Math.ceil(inspection)} more seconds. Isolate the remaining feeds now. ` : ''}RADIO stops human reinforcements only. WEST powers the two amber guns; EAST powers the two blue guns. Each feed needs four seconds with free hands, permanently stops its guns, and leaves the worker unable to fire. Reach WEST behind reception and EAST north of the generator hall.${!w.security.inspectionUsed && !identityLost ? ' An unexposed maintenance identity can use INSPECT once for a 22-second shutdown. Stage the crew before authorising it.' : ' You can still isolate feeds from cover or destroy the stationary turrets.'} Cover breaks their tracking; Sable’s coil outranges them. This preparation is optional, but a direct rush meets overlapping fire.`,
      targets:
        remaining.length === 0
          ? ['evidence', 'gate', 'extract']
          : [
              ...remaining,
              ...(!w.security.inspectionUsed && !identityLost
                ? [...kit, 'authorise' as const]
                : []),
            ],
    };
  } else if (w.demolition) {
    const done = demolished(w),
      status = detonationStatus(w);
    const remaining = (['charge-west', 'charge-east'] as const).filter(
      (id) => !w.demolition!.armed.includes(id),
    );
    primary = {
      id: 'primary',
      complete: done,
      label: done
        ? '✓ Debt backups destroyed'
        : remaining.length
          ? `○ Plant charges · ${w.demolition.armed.length} / 2`
          : status.unsafe.length
            ? '○ Clear both blast areas'
            : '○ Charges ready · crew clear',
      detail: done
        ? 'Both backups are gone. Bring every surviving operative to the north-east VAN. The recovery REGISTER is optional.'
        : remaining.length
          ? 'Plant WEST and EAST: five seconds each with free hands. A planter cannot fire; moving or Hold cancels unfinished placement. Completed charges stay armed without a timer. The maintenance disguise helps you reach the halls, but planting is conspicuous. Watch patrols and hide behind the racks. Then move everyone outside the marked blast circles and use Detonate in the mission panel.'
          : `${status.reason || 'Everyone is clear. Use Detonate in the mission panel to destroy both cores.'} The control checks every survivor, including unselected operatives. Blast areas ignore walls. RADIO prevents reinforcement calls, but nearby guards hear the explosion.`,
      targets: done
        ? ['extract']
        : remaining.length
          ? [...remaining, ...kit]
          : ['charge-west', 'charge-east', ...(!w.gateOpen ? ['gate' as const] : [])],
    };
  } else if (w.broadcast) {
    const b = w.broadcast;
    const operator = w.agents.find((a) => a.id === b.maskBy);
    const radioTargets: GuideTarget[] = w.relayOff
      ? []
      : [
          'relay',
          ...(m.broadcast?.dispatchOnTrace && m.archive && !w.shutterOpen
            ? (['override', 'breach'] as const)
            : []),
        ];
    primary = {
      id: 'primary',
      label: published(w)
        ? `✓ ${m.broadcast?.completed ?? 'Audit published'}`
        : m.broadcast?.subject
          ? `○ Upload ${m.broadcast.subject}`
          : '○ Publish Mara’s audit',
      complete: published(w),
      detail: published(w)
        ? `${m.broadcast?.completed ?? 'The audit is public'}. Both workstations are released. Bring everyone to VAN, including the LOOP operator. LOG is optional.`
        : b.traced
          ? `The terminal has been traced; LOOP can no longer hide it. ${m.broadcast?.dispatchOnTrace ? 'Site guards and incoming teams can receive the UPLINK location over RADIO. ' : ''}Defend an operative working UPLINK to finish the upload. Progress is saved when interrupted. RADIO stops new reinforcements; guards already dispatched keep investigating.`
          : (m.broadcast?.guidance ??
            `${operator ? `${operator.name} holds LOOP. Select another operative for UPLINK.` : 'Assign one operative to Hold LOOP on the west street, then select a second to Work UPLINK.'} UPLINK needs 24 seconds with free hands; the operator cannot fire while working. Moving or Hold pauses work and saves progress. Without LOOP, five seconds of uploading draws guards. KIT helps outside the server room. Its patrol challenges uniforms: withdraw behind the racks when challenged, then resume.`),
      targets: published(w)
        ? ['extract']
        : b.traced
          ? ['upload', ...radioTargets]
          : ['mask', 'upload', ...kit, ...(m.broadcast?.guidance ? radioTargets : [])],
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
        ? `${w.evidence === 'available' ? `${cargoTag} was left outside the archive. Collect it where it lies.` : `${m.evidenceName} recovered. Keep SHUNT held until the carrier is outside the vault.`}${operator ? ' Bring the shunt operator along when you withdraw;' : ' The carrier and'} every survivor must reach VAN.`
        : w.shutterBreached
          ? `The cut lock stays open. Send an operative to ${cargoTag}; carrying it needs both hands.`
          : operator
            ? `${operator.name} is holding SHUNT. Select a different operative and send them to ${cargoTag}. Moving ${operator.name} or using Hold releases the shutter.`
            : w.shutterOpen
              ? `The doorway is occupied. Assign someone to SHUNT to keep it open while another operative collects ${cargoTag}, or use CUT once the shutter closes.`
              : `Leave one operative at SHUNT while a second enters for ${cargoTag}. Changing selection keeps the shunt held. Alternatively, CUT forces the lock in eight noisy seconds.`,
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
  const optionalEvidence = !requiresCargo(m);
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
            ? `${tag} is inside the locked ${m.archive?.name ?? 'archive'}. Keep one operative at SHUNT while another collects it, or force the lock with CUT. ${optionalEvidence ? 'This evidence is optional; you can complete the operation without it.' : 'The cargo is required for extraction.'}`
            : `Interact with ${tag} to collect it. It slows its carrier and needs both hands.${optionalEvidence ? ' This evidence is optional; you can complete the operation without it.' : m.threshold ? ' Bring its carrier to LINK, then LIFT; the original key is required to board.' : ' Bring its carrier to VAN; extraction requires the evidence.'}${m.broadcast ? ' The log attracts suspicion, even in uniform. Set it down before working LOOP or UPLINK.' : ''}`,
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
  const requirement = extractionRequirement(w);
  const extraction: Goal = {
    id: 'extract',
    complete: w.status === 'won',
    label:
      w.status === 'won'
        ? `✓ Extracted${w.extractedAt ? ` at ${landmark(w, w.extractedAt).tag}` : ''}`
        : requirement
          ? `○ ${requirement.label} before extraction`
          : exits.length > 1
            ? '○ Extract at STREET or SERVICE'
            : m.threshold
              ? '○ Board LIFT with KEY and crew'
              : '○ Extract at the van',
    detail: m.threshold
      ? (requirement?.detail ??
        `Order boarding at LIFT with KEY and every survivor in its ring. ${counts}.`)
      : requirement
        ? `${requirement.detail} Complete the highlighted objective to unlock the exit. Clicking a locked van leaves current orders in place.`
        : `Use the controls beside the extraction goal to rally every survivor and leave. Or select the crew and right-click or tap the van or its diamond. The order waits for ${v ? `${v.name} and ` : optionalEvidence ? '' : `the ${tag} carrier and `}every surviving operative inside the same extraction ring.${v?.waiting ? ` ${v.name} is waiting: ask them to follow.` : ''}${exits.length > 1 ? ' STREET is short and exposed; SERVICE is longer, via the screened corridor.' : ''}${eastGate ? ' Open GATE from inside for the east exit.' : ''}${m.broadcast ? ' Bring the LOOP operator too; LOG is optional.' : ''} ${counts}.`,
    targets: requirement
      ? (requirement.goal === 'primary' ? primary : evidence).targets
      : [...exits.map((o) => o.id), ...(eastGate ? ['gate' as const] : [])],
  };
  return [primary, evidence, extraction];
}
