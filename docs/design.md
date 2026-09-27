# Design notes

The crew normally operates together. Splitting is useful when one maintenance identity can enter a guarded workplace while others prepare access and extraction. Selecting someone never changes another operative's order. Selecting everyone and regrouping are separate commands.

Selection should survive imprecise combat inputs. Clicking a selected operative on the map keeps their group; portraits and number keys deliberately isolate individuals. Empty drag boxes and attempts to remove the final selected member keep the existing selection. Losing that final operative selects the survivors. Touch map taps issue orders; portraits handle touch selection.

Intentional drag selection intersects the visible bodies, not just their foot
points. A minimum 12-pixel rectangle is both drawn and used for selection. This
makes small body drags useful for isolating a person while preserving missed-box
protection.

Formation slots share a walkable anchor. Every slot needs a body-clear connection
to that anchor; blocked offsets are fitted nearby with body spacing. If the click
lands on a wall, the closest free ring is biased toward the approaching crew.
This prevents a small offset from causing a long detour around the far side.
Deliberate destinations across a wall still use ordinary pathfinding.

Interaction assignment filters prerequisites and checks that the route actually
reaches working range with clear sight. A selected current worker keeps the job
and progress; otherwise the nearest eligible, reachable operative takes it.
Refusal leaves existing orders intact, and prerequisites are rechecked when work
finishes. Cargo and disguise restrictions are shared by assignment and completion.

Reaching the engineer changes entry into escort. Physical evidence removes one gun from the fight and can change hands. A blown disguise creates a combat problem rather than immediate mission failure.

## Boundaries

- Serializable simulation data and plain TypeScript functions. No framework objects in gameplay state.
- Mission geometry and patrols belong to content. Substantial props are solids; lights and lettering are decoration.
- Guards own suspicion, remembered identities, last seen positions, and delayed radio reports. Site-wide identity knowledge follows a completed report.
- The world clock drives patrols, interactions, weapons, radio calls, and reinforcements. Pause stops all; slow time scales all.

Guards have 90 health, survive the crew's combined 68-damage opening volley, and
share the crew's eight-unit weapon range. Their 16-damage shots have a 0.8-second
cooldown. Target choice uses distance to visible known threats, not squad-array
order. Nearby gunfire starts a 2.5-second report even through cover; hearing does
not reveal an identity or permit shooting through a wall. Killing callers or
disabling RADIO still interrupts escalation. Support arrives 6 and 30 seconds
after the alarm, with countdowns shown in the HUD.

The extraction panel shares its readiness calculation with boarding. It appears
after objective recovery or an early extraction order and lists crew counts,
missing people or cargo, and an explicit rally/extract action for each exit.
Panel orders include every survivor and enter the ordinary replay command path.
Map extraction orders still affect only the selection. Waiting witnesses keep
their wait order and can resume from the adjacent Witness panel; arriving in a ring alone never
silently ends the mission.
Whole-crew rally is blocked while someone remains inside an archive that depends
on a held SHUNT. The panel names who must cross first; a breached shutter needs
no such restriction. Individual map orders remain under player control.

- Cover is physical occlusion. This release has no numerical cover bonus or cover snapping.
- Moving people are not permanent navigation obstacles. Destination slots spread the crew; future local avoidance can improve crowd flow.
- Local records have a version and validation. Version 3 separates full-crew and
  any-crew times, preserves completion counts, and treats v1/v2 survivor counts as
  unknown. Browser storage failure must not prevent play.

## Visual system

Near-black green chrome, slate industrial surfaces, mint selection and health, amber objectives and suspicion, coral combat alerts. Arial/Helvetica with spaced uppercase labels; monospace for clocks and shortcuts. A left crew/command panel and right mission/status panel frame the map. Orders
remain anchored at the bottom of the left panel; roster and selected-operative
information sit above them. A disabled drop button reserves its place even
without cargo. Secondary field notes and records open within the right panel,
without pushing controls or changing the map rectangle. Long COMMS text can
scroll independently; it cannot displace mission actions or orders.

The generated concept established composition and palette. Intentional differences: code-drawn architecture keeps displayed geometry exact; initial scenery is simpler; functional field dressing, evidence drop, and camera controls supplement the concept. Decorative stealth and mobility statistics were omitted because they have no gameplay counterpart. At widths up to 900 px, panels stack below the map, with orders first. There is
no nested panel scrolling in that layout. Objective locators bring the map into
view at the same breakpoint.

Generated portrait and person atlases supply character art. Architecture, sight cones, bullets, and markers come from game state. Generated map artwork never defines collisions.

The person atlas is animated through a small mesh: opposite strides and foot lifts, knee flexion and restrained arm swing. Gait phase advances once per 1.1 world units of interpolated walking distance, keeping it aligned with movement, pause and slow time. Each atlas quadrant has its own sole anchors. Contact shadows follow the ground projection of each foot while the swinging boot lifts above them; selection rings and depth ordering retain the world ground position. Vehicle face details use world-plane projection rather than screen-space offsets.

The extraction van uses a shaped cab and cargo body with a sloped windscreen, short bonnet, door seams and handles. Tyres touch the road and show through wheel openings in the side panel. Its visual height matches a standing person; its navigation footprint and extraction radius are unchanged.

## Material breach

The second contract turns access into a standing squad order. An exposed fire-control shunt on the public street must be held continuously; it does not consume the disguise. The disguised runner uses that access, prepares the delivery gate, and steals a required physical ledger. Moving the operator, assigning another job, or losing them releases the shutter. A doorway safety sensor prevents invalid collision states, and cutting from either side prevents an abandoned infiltrator being permanently trapped.

The loud alternative takes eight seconds and leaves permanent access. Nearby guards hear it even without radio service. A carrier cannot use a gun, cut the lock, or work the shunt until setting down the ledger. The conspicuous ledger removes the uniform's protection; the screen wall and road patrol make the withdrawal a distinct navigation problem. No failure timer forces a particular approach.

Mission metadata owns briefs, objectives, map dimensions, gates, landmarks, response entry points, and patrols. The shared simulation supports an optional escort and a held shutter. The renderer fits each map and uses code-drawn filing cabinets and ground markings for the annex. All operations can be launched directly; a completion also offers the next operation. Records remain independent and migrate the first operation's earlier score.

## Adverse possession

The third contract turns an objective into a moving actor. The player controls dispatch timing from the public street and the destination from inside the yard. The courier travels through a marked junction, visits the checkpoint, and returns if missed; diversion redirects an active transfer to a screened inspection bay with no deadline. This makes preparation and splitting useful without making a failed timing window a softlock.

The courier is an armed guard with the same sight, identity memory, combat, and navigation as the yard patrols. The transfer controller owns peaceful movement; combat temporarily takes over. The case marker follows the courier, then remains at their actual position if they fall. A dead courier does not fail the contract, and a dead or interrupted carrier leaves recoverable cargo. There is only one case in circulation.

A disguised operative can obtain a signed handover at inspection if their weapon is concealed and the courier and radio network do not know their identity. Clearance protects only that disguised carrier's possession of the case; it does not grant secure-area access or erase guard memories. Dropping or transferring the case voids it. The armed route uses the same required-cargo extraction rules as the ledger.

The map exposes the active route and both handover bays. Persistent feedback by
the courier objective separates route choice, an unissued CALL, active movement,
and interruption by combat or scrutiny. The CALL shortcut issues the ordinary
selected-crew interaction command and shows who is heading to the post; the
operative must still travel and finish the interaction. Alarm alone never cancels
a diversion or dispatch. The checkpoint countdown remains visible. CASE interaction and courier targeting are distinct even when their hit areas overlap at low zoom. Existing missions retain their own independent records; mission three fits the current record format without a migration or new dependency.

## Protective custody

The fourth contract separates unlocking a captive's transport from starting the escort. Forged release papers require an unexposed maintenance identity and a concealed weapon; cutting the lock takes time and causes local noise. Mara remains protected until collected, so the player can finish preparations without a failure timer.

The new escort metadata replaces Voss-specific simulation fields. Voss keeps her existing health, movement speed, and non-targetable behavior. Mara is slower and is recognized by guards after a short visual identification, independently of the operative escort's disguise. Local recognition and the delayed radio report follow the same rules as operative identification. Losing Mara ends the mission, while losing her assigned operative transfers leadership to a survivor.

Wait/follow orders make it possible to clear a route without pulling the witness into the fight. A nearby operative with free hands can spend their one field dressing on Mara instead of themselves. The short east extraction crosses a patrolled road; the longer west route uses physical screen walls and the service entrance. Both exits are available throughout, but all survivors and Mara must gather at the same one. The result shows which exit was used.

The transport reuses the van geometry with a grey body, security stripe, and barred side window. Its collision footprint remains explicit mission content. The HUD exposes escort health and orders only after recruitment; both extraction rings and the service corridor are visible on the map.

Witness and extraction actions sit beside their corresponding goals in the
right panel; COMMS lives there too. Crew dressing buttons occupy reserved space
in each portrait in the left panel. None of these updates changes the map rectangle or covers
its input surface, including on short laptop screens. Danger feedback is
independent of the single COMMS message: visible, in-range targeting or a recent
health drop keeps the warning active. The hit grace period uses simulation time,
so pause and slow time behave consistently. Locating uses the existing guide and
does not select or order anyone. Wait/Follow and treatment are adjacent; treatment
names the nearest available medic and uses the ordinary recorded escort-aid
command across the living crew. If nobody is eligible, a disabled button explains
the requirement. Crew portraits show health and offer individual dressing actions,
also through ordinary replay commands. Combat and healing values are unchanged.

## Objective guidance

Mission goals expose the current requirements and point to their map locations. Hover previews without moving the camera; clicking or tapping frames the relevant items and keeps a short guide open. Each named location can be focused separately. Inspection never issues an operative order or changes selection.

A read-only goal model supplies both the HUD labels and context-sensitive help. It distinguishes a diverted courier from a called transfer, explains why a shunt operator must stay put, removes the forged-release suggestion after the maintenance identity is lost, and states the extraction requirements. The locator resolves people and cargo from current simulation positions, including handoffs and drops. It uses a screen overlay for legible labels and off-screen arrows, leaving world occlusion and map hit-testing intact.

## Next useful work

Tune whether splitting the crew earns its cognitive cost. Then extend civilian responses and challenges, spatial equipment choices, full directional character art, route variety, and missions built from these systems.
