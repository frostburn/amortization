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

Half-metre grid connections reuse body-clearance checks across searches. Each
mission retains at most four gate/shutter combinations outside simulation state;
geometry edits invalidate them. Building the connections checks thin walls and
diagonal crossings near each obstacle, rather than scanning every solid for
every explored edge. Real start/end positions and smoothed segments still use
live collision checks. Neighbour order and heap ties stay unchanged, preserving
routes and replay timing. Searches remain synchronous: the reported mission-08
Rally fell from roughly 210–262 ms to 9–10 ms in browser measurements. This is not
a hard frame-time guarantee on slower devices or larger future maps; those may
still need incremental searches or a worker.

Interaction assignment filters prerequisites and checks that the route actually
reaches working range with clear sight. A selected current worker keeps the job
and progress; otherwise the nearest eligible, reachable operative takes it.
Refusal leaves existing orders intact, and prerequisites are rechecked when work
finishes. Cargo and disguise restrictions are shared by assignment and completion.

Reaching the engineer changes entry into escort. Physical evidence removes one gun from the fight and can change hands. A blown disguise creates a combat problem rather than immediate mission failure.

## Boundaries

The [sound palette](audio.md) gives weapons and equipment distinct identities.
Its audio director observes the simulation without changing it. Charge and
tracking sounds follow current progress, and panning follows the isometric camera.

- Serializable simulation data and plain TypeScript functions. No framework objects in gameplay state.
- Mission geometry and patrols belong to content. Substantial props are solids; lights and lettering are decoration.
- Guards own suspicion, remembered identities, last seen positions, and delayed radio reports. Site-wide identity knowledge follows a completed report.
- The world clock drives patrols, interactions, weapons, radio calls, and reinforcements. Pause stops all; slow time scales all.

In operations 01–04, guards have 90 health, survive the crew's combined 68-damage
opening volley, and share the crew's eight-unit weapon range. Their 16-damage shots have a 0.8-second
cooldown. Target choice uses distance to visible known threats, not squad-array
order. Nearby gunfire starts a 2.5-second report even through cover; hearing does
not reveal an identity or permit shooting through a wall. Killing callers or
disabling RADIO still interrupts escalation. Support arrives 6 and 30 seconds
after the alarm, with countdowns shown in the HUD.

Operations 05–08 use explicit, shared weapon definitions. Pistols are concealable
and mobile (range 6, damage 17, eight shots); carbines reach farther but need a
0.35-second stationary preparation (range 9, damage 26, six shots); shotguns
favour close encounters (range 3.8, damage 44, two shots). Automatic reloads take
1.2, 1.6, and 1.8 seconds respectively, with unlimited reserve ammunition. Both
sides use the same damage, preparation, firing recovery, and reload rules.
Orders and weapon stowing never reset reload progress. Every timer belongs to
the fixed-step simulation and is included in replay state.

Morrow and Vale have pistols; the other two carry carbines, with Rook switching to
a shotgun in operation 06. Stowed long guns remain visibly armed, including when
carrying cargo. KIT filters to eligible pistol carriers and names the assigned
operative. Briefings and the crew HUD show equipment, ammunition and readiness;
enemy inspection explains role and recovery. Silhouettes distinguish long guns,
and readiness bars sit below the feet.

Carbine sentries use authored firing posts and break sight when hit or reloading.
Breach officers prefer reachable screened posts nearer a last-seen threat, with
covering retreats under pressure. Nearby specialists can pass an observed
position through direct sight of one another; this does not reveal later unseen
movement. Position choices use collision and sight checks and a bounded path
search. Health stays at 90; specialist roles replace existing patrols.

Live extraction first requires the contract objective to be secured; optional cargo cannot unlock it. A locked vehicle click explains and locates the missing task without replacing orders.
The extraction panel shares its boarding readiness calculation with the simulation. It appears
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

Generated atlases supply the crew and witness portraits. Faceted character models, architecture, sight cones, bullets, and markers are drawn in code from game state. Artwork never defines collisions.

Morrow, Vale, Rook, Sable, guards, Voss, and Mara have distinct models. Each turns through 32 world-space facings, including its face, hair, coat, and weapon. The disguise changes clothing and adds a hardhat while preserving the operative's face and build. Gait phase advances once per 1.1 world units of interpolated walking distance; the stance foot moves backward at the body's ground speed while the other swings forward. Thigh and shin lengths stay fixed as the knee bends forward, with visible kneecaps. Raised hips and low foot clearance keep the walk upright and limit coat stretch; the supporting knee bends less than 35 degrees and the swinging knee less than 55 degrees. Contact shadows stay on the ground beneath each boot. Paused simulation freezes the pose.

Character triangles use GPU depth testing so intersecting sleeves, shoulders, hair, and equipment resolve per pixel. Each character gets a separate depth interval following the existing scenery painter order; internal body depth never pulls a background character in front of a foreground person or wall. The bounded pose cache shares vertex buffers and releases them on mission reset.

Guard shoulder caps pivot at the shoulder and follow 40% of the upper arm's rotation, keeping their uniform shape during walking, aiming, and carrying. Each thigh and raised kneecap pushes its own side of the coat out; rounded sections blend between the legs so the trailing hem can hang back. The chest and belt stay fixed to the torso. Clothing follows the cached pose directly, so pausing and replaying cannot introduce cloth drift.

Actual shot cooldowns raise the arms into a two-handed firing pose; active shot traces supply the muzzle flash. Carriers hold their cargo in both hands. Fallen characters have bent limbs and a face-down head on a low body, with their original colors and no transparency fade. Selection and scenery occlusion still use the world ground position. These are presentation rules and do not add simulation state or change replay fingerprints.

Enemy roles use full uniform palettes: khaki for site guards, blue for carbine
sentries, and red for breach officers. Coats, sleeves, caps and shoulder pads
carry the color around the body; the officer's dark chest plate and visor provide
another cue. Corpses retain their role colors. Alert state still uses the existing
ground indicators and sight cones.

Each weapon has one rigid model shared by lowered, aimed, slung and dropped poses.
Pistols have a short slide and grip; carbines have a box magazine, short stock and
upper sight; shotguns have a longer barrel, tubular magazine, wooden stock and
ribbed pump. Long guns use both hands at low ready and remain visible on the back
when stowed or carrying cargo. The lowered pistol follows the hand through the
walk cycle; a concealed pistol stays hidden. Attachments use the same depth-tested
character geometry as sleeves and shoulder pads.

Map text is rasterized for the current camera scale and display pixel density. Character objective markers and guide rings share a screen-space anchor above the head, leaving at least 32 pixels for the ring and leader line; their hit targets use that same anchor. Voss and Mara's wait/follow controls include their own portrait without growing the compact action row. Vehicle details and wall-lamp spill use their actual world planes, including the vertical wall face beneath each lamp.

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

Wait/follow orders make it possible to clear a route without pulling the witness into the fight. A nearby operative with free hands can spend their one field dressing on Mara instead of themselves. The short east extraction crosses a patrolled road; the longer west route uses physical screen walls and the service entrance. Both exit locations are visible throughout; boarding controls unlock after recruitment, and all survivors and Mara must gather at the same one. The result shows which exit was used.

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

## Public offering

The fifth contract changes the objective from carrying something out to publishing
information before withdrawing. Two separated workstations reward splitting the
crew: LOOP is on the public west street, UPLINK is in a restricted server room.
One maintenance identity helps the uploader reach the room; its moving patrol
still challenges that identity. Racks break sight, creating a reason to withdraw
and resume work instead of leaving the operative unattended.

The upload requires 24 seconds of active work with free hands. Progress belongs
to the mission, so moving, issuing Hold, dying or handing off never resets it.
There is only one upload owner and one loop owner; repeated orders preserve work,
and handoffs release the previous operator. Working agents cannot fire. Owner
validation runs after awareness so a worker killed this tick cannot contribute.
Completion frees both stations and enables an all-survivor extraction without
physical cargo. The optional suppression log remains suspicious and occupies
both hands.

An unmasked upload accumulates five seconds of trace. Pausing preserves this
counter, preventing stop/start orders from evading discovery. Holding LOOP clears
an incomplete trace. Once traced, the terminal attracts nearby security through
the existing investigation behavior; the normal radio rule controls reinforcement
calls. LOOP never hides a person from sight and cannot undo a completed trace.
There is no failure timer, and a lone survivor can still finish through combat.

The HUD keeps progress, the uploader or paused state, loop ownership, and trace
status beside the objective. Its two work buttons use recorded interaction
commands with the current selection. The progress display stays visible across
selection changes. Locators, results, the operation picker and independent records
include the new mission. Masts and server racks are code-drawn scenery using the
same world projection, collision footprints and occlusion order as other props.
A carbine sentry watches the server-room approach, with the racks providing a
screened crossing and a retreat. The quiet route keeps the long-gun carriers out
of patrol sight until withdrawal; the armed route uses stationary covering fire.
Both full-route checks include every live guard, finish with all four alive, and
verify replay checkpoints. Older worlds do not gain a broadcast-state property.

## Severance

The sixth contract is a demolition job following publication of the audit. Two
separate backup halls provide two preparation tasks and a shared withdrawal.
Each charge needs five uninterrupted seconds with free hands. Planting blocks
firing and is suspicious even in uniform; the room patrols and occluding racks
create timing windows. A completed charge belongs to the mission, persists across
orders and deaths, and has no automatic timer. A lone surviving operative can
still finish both placements.

The remote trigger is an ordinary replay command. The simulation rejects it
until both charges are armed and every living operative is outside both marked
circles, regardless of selection or intervening walls. Refusal never cancels
orders. The HUD uses the same status helper to disable the button and name anyone
still inside. Primary guidance moves from planting to withdrawal to detonation;
extraction unlocks only once both cores are destroyed. The optional register never
unlocks the exit.

Detonation kills guards inside the marked circles, attracts nearby survivors and
requests the usual radio response. Disabling RADIO still prevents reinforcements.
Core graphics switch to broken racks with a brief flash and low filtered noise;
the wreckage keeps the original collision footprint. Damage, planting and the
blast flash use simulation time. Only this mission gains demolition state, so
older replay worlds retain their original shape. Completion reports destruction
and optional register recovery, with separate records and the standard crew rally.

A courtyard carbine sentry and breach officer coordinate using observed positions.
The second radio response can reuse that pair. The core halls keep their patrol
windows for a concealed pistol carrier. Full-route checks retain all guards and
complete both a quiet demolition and an armed assault with four survivors. The
quiet route verifies exact replay checkpoints, including remote detonation.

## Objective guidance

Mission goals expose the current requirements and point to their map locations. Hover previews without moving the camera; clicking or tapping frames the relevant items and keeps a short guide open. Each named location can be focused separately. Inspection never issues an operative order or changes selection.

A read-only goal model supplies both the HUD labels and context-sensitive help. It distinguishes a diverted courier from a called transfer, explains why a shunt operator must stay put, removes the forged-release suggestion after the maintenance identity is lost, and states the extraction requirements. The locator resolves people and cargo from current simulation positions, including handoffs and drops. It uses a screen overlay for legible labels and off-screen arrows, leaving world occlusion and map hit-testing intact.

## Margin call and the tracking camera

Operation 07 moves the crew into a 60 × 42 freight clearinghouse (operation 06 is
40 × 32). The settlement keys can release the escrow frozen after the destroyed
backups. Physical cargo requires a carrier and every survivor at the north road
van. A remote SHUNT on the west street supports quiet split-team access to the
vault; CUT is the permanent noisy alternative. Separate freight lanes, cargo
stacks and a screened maintenance walk offer direct and indirect approaches. The
east road patrol creates a final crossing window for the conspicuous carrier.

Rook carries a compact automatic: range 6.4, damage 12, nine shots, 0.16-second
firing recovery and 1.65-second reload. Sable and violet security marksmen carry
coil rifles: range 13, damage 52, three shots, 0.75-second firing recovery and
2.2-second reload. Every coil shot needs a continuous 1.25-second charge on the
same visible target while stationary. Movement, lost sight, stowing, working or
death cancels charging; switching targets starts a new charge. A floor line,
shrinking target ring and readiness bar telegraph it independently of sight cones.
Charges, rounds and reloads belong to simulation time and replay state. Marksmen
use authored firing/cover posts and do not pursue unseen targets through buildings.

Marksmen have violet coats and a single optical lens. The coil rifle’s long pale
rail housing, three cyan coils and scope contrast with the automatic’s short brass
receiver, wire stock and deep magazine. Both use the shared rigid attachment in
aimed, lowered, slung and dropped poses.

Operation 07 starts at 0.95 screen scale near the crew, independent of map area or
viewport size. Fit map remains a deliberate overview. Follow / Home restores the
last working scale and tracks the selection; fully visible maps need no movement.
Tracking uses interpolated positions and looks ahead along the next path segment;
it never aims straight at a distant destination through intervening walls. Movement
takes priority over shooting backwards. At rest, the local group's average facing
sets a shorter lead. Opposing directions cancel. Screen-space limits keep the lead
comfortable on a phone and reserve space for the local group. Lead direction is
filtered over time; a central quiet area absorbs formation settling and small aim
changes. Ordinary pans ease at a capped speed. One moving teammate contributes
only their share of the group's lead, rather than pulling the camera at full strength.
An off-screen selection returns immediately to the visible area. Zoom never changes.
Selecting a nearby operative or losing a teammate never snaps the camera. Only
mission launch, an explicit Follow / Home command, or an off-screen focus cuts
directly to the new framing. Holding a mouse button or touch on the map suspends
automatic tracking through release and a short settling interval; clicks retain
the target identified at press time. Manual panning still works during the hold.
Widely split multi-selections
follow the largest local group, with stable selection-order ties. Manual pan and
objective focus suspend tracking; selecting an operative resumes it. Wheel zoom
keeps the centre world point fixed. Mission resets restore the authored start.

Quiet and armed full-crew completions run with live patrols and are recorded then
replayed exactly. Unit checks cover reachable posts and map edges, coil charge
interruption, automatic reloads and split selection. Browser checks exercise
launch, default framing, tracking, manual pan, overview and touch selection.

## Adverse selection and wired security

Operation 08 is a 52 × 38 authorisation works. The settlement keys recovered in
operation 07 still need a physical restitution mandate before the bank releases
the frozen funds. Recover MANDATE from the north records room, open the east
loading gate, and extract every survivor. Security preparation is optional; the
mandate remains the extraction requirement.

Four stationary sentry turrets introduce two ideas from the combat proposal:
physical security circuits and borrowed corporate authority. Amber guns belong
to WEST; blue guns belong to EAST. Visible cables connect each mount to its feed.
RADIO stops human reinforcement calls but never disables wired guns, transfers
identities to them, or causes them to chase noise. Each turret has 180 health and
uses the existing shared carbine rules. It scans a 90-degree cone, oscillates
around its authored facing, and needs 0.8 seconds of uninterrupted optical
tracking before shooting. A red tracking line and under-mount bar show that delay.
Walls, range loss, target changes and power loss reset tracking. Guns use their
ordinary magazine and reload cycle and leave dedicated mechanical wrecks.

An unexposed, disguised pistol carrier with free hands can authorise INSPECT at
the reception terminal. It stops all turrets for 22 seconds, once. The visible
countdown uses simulation time; pause also pauses the window. Assignment and
completion both validate the identity. During inspection, maintenance work does
not itself arouse suspicion. Guards continue to patrol and still recognise
visible weapons, cargo and intruders in the records room.

WEST and EAST each take four uninterrupted seconds with free hands and disable
their two guns permanently. Moving, Hold or losing the worker abandons unfinished
work; workers cannot fire. Outside inspection, visible work is suspicious and a
completed breaker trip draws nearby guards to investigate. Neither an expired
inspection nor a lost disguise prevents physical isolation or destroying guns.
A one-person disguised approach can use the service walks, but a revealed worker
needs covering teammates. Sable can outrange a mount; a frontal squad rush instead
meets overlapping guns that survive its opening volley.

The quiet verification run stages the other three operatives on the public north
road, isolates both feeds during inspection, prepares the exit, and times the
carrier's crossing behind the east patrol. It extracts four uninjured operatives
without a shot or alarm. The armed run clears and covers the service approach,
isolates both feeds without authorisation, and extracts all four. Both are
recorded and replayed against exact checkpoints. A separate nearest-enemy assault
jams RADIO, focuses fire, and uses dressings at half health but ignores the feeds:
it clears the site with only Sable surviving. This is a balance regression check,
not a claim that every improvised assault must fail; human playtesting remains
necessary.

Desktop and touch browser checks cover mission launch, goal locators, authority
requirements, issuing inspection and breaker orders, expiry and permanent isolation.
They stay outside the routine smoke gate. The full simulation checks continue on
all PRs; no CI workers, retries, or matrix entries were added.

## Key personnel and two-person detention access

Operation 09 follows the successful mandate extraction. During later handover
preparations, a safehouse raid captures Vale and Rook. Voss supplies the detention
layout; Mara retains the mandate. Morrow and Sable start outside. Captivity is a
mission state, not a retroactive penalty for the player's operation-08 result.

A single remote console supplies either INTAKE (amber) or CELLS (blue). A living,
free-handed operative must remain working it; movement, Hold, death or another
order cuts power immediately, including while paused. The worker cannot shoot.
The other operative crosses INTAKE, waits inside while the partner switches,
then enters holding through CELLS. The two-second local prisoner releases also
recheck a distinct operator holding CELLS at completion. A safety edge can keep
an occupied doorway physically open, but it never substitutes for remote power.
There is no CUT alternative or hidden radio bypass. The ordinary response road
barrier is outside the detention perimeter.

Freed prisoners become selectable operatives, with their original names, indices
and portraits. They start disarmed and without dressings; GEAR restores each
operative's own loadout and dressing. Commands, automatic fire, selection and
camera tracking exclude captives; guards leave locked prisoners alone. Once free,
they move, take damage and obey orders normally. The all-four-alive requirement
is explicit in the briefing and defeat message. EXIT becomes useful after both
are free: it permanently releases both gates and ends remote work, so the final
rally cannot strand the console operator. Equipment and the register are optional.

The gate buttons switch the current operator without changing selection or
pulling the follow camera away from the infiltrator. Map controls and goal
locators show INTAKE, CELLS, both local cell releases, GEAR and EXIT. Captive
portraits remain visible with an explicit status, then unlock immediately.

Navigation includes the two controlled gates and both cell doors. A bounded
sixteen-state cache handles the extra combinations; old sites still use at most
four. Detention and captivity fields exist only on missions that use them, so
previous mission states and human replay inputs remain intact.

Verification includes a full quiet rescue with live patrols, zero shots and no
recovered weapons, plus a prepared armed withdrawal and equipment recovery. Both
record and replay exact checkpoints. Focused checks cover outside bypasses,
captive commands, interrupted releases, operator handoff, doorway occupancy,
exposed identities, all-guards-dead cooperation, extraction prerequisites and
failure. Desktop and touch checks use the real mission picker and gate controls,
then real map hits, prisoner selection, equipment and final extraction in a
stepped fixture. Those browser checks remain outside the routine smoke suite.

## Next useful work

The first four human runs of operation 07 are analyzed in the [replay notes](../tests/replays/README.md#margin-call-human-assaults). They establish that direct assaults can win with casualties and that leaving RADIO active makes the forced shutter risky. They do not yet validate the human experience of the quiet route or establish that marksmen require deliberate flanking. Keep those questions open for further playtesting. The [future combat ideas](combat-expansion.md) retain flash grenades, loadout choice, and further equipment and security suggestions for later missions.
