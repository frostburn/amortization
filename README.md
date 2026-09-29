# Amortization

A real-time squad tactics game for the browser. Control four operatives together or individually. One maintenance disguise admits a single person; the rest of the crew can prepare access or provide armed backup.

**Ten operations** are playable from briefing through extraction or defeat. Use **Operations** to launch any contract, or **Next operation** after completing any of the first nine. Restart and Shift+R restart the selected mission, including unfinished attempts. Briefings and results also offer **Restart mission**.

## Development

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. Everything runs in the browser, with no account, backend, API key, or external asset service.

```sh
npm run check       # lint, simulation tests, typecheck, production build
npx playwright install chromium
npm run test:e2e:smoke # routine CI browser gate (10 checks)
npm run test:e2e       # full Chromium regressions (30 checks)
npm run preview    # serve the production build
```

`npm run build` writes `dist/`. Serve the whole directory over HTTP, including `assets/`. The default relative asset base supports hosting under `/amortization/` or another subdirectory. For an explicit base, use `BASE_PATH=/amortization/ npm run build`. Opening `index.html` directly with `file://` is not supported.

To play from another device on your local network, use `npm run dev -- --host 0.0.0.0`.

## Sound

Use **Sound off** in the top bar to enable audio; both that choice and the adjacent
**Vol** slider are remembered. After reloading, enabled sound resumes on the first
click, tap or key press. New players start muted. Each weapon has its
own report, coil charges and turret tracking give audible warnings, and movement,
reloads, impacts and mission equipment have distinct cues. Footsteps are quiet
and muffled; there is no site ambience yet. Stereo follows the camera's isometric view.

Planning pauses sustained sound. Normal-speed replays include audio; accelerated
playback stays quiet. See [sound design](docs/audio.md) for the palette and checks.

## Playtesting and replay bundles

Run `npm run dev`. The top bar, briefing, and result screens have two direct entry
buttons: **Export attempt** opens the recording export dialog, and **Import replay**
opens the replay viewer. These are independent dialogs with no tabs.
A red circle beside **REC** means the current attempt is recording, including
orders issued while paused. It disappears during playback, after the mission ends,
or when recording reaches its limit. Recording starts automatically for every
mission and restart. These tools,
recording, and replay playback are excluded from the production build.

1. Play normally. Paused orders and slow time are supported.
2. Choose **Export attempt**, add an optional note, and choose **Download attempt**. Attach
   the `.replay.json` file in the chat. Wins, defeats, and unfinished attempts are
   all useful; mention what felt trivial, unfair, or confusing.
3. After restarting or changing missions, select the previous attempt in the
   dropdown. Up to four recent attempts are autosaved locally when browser storage
   allows. Download important runs before clearing storage or changing browsers.
4. Choose **Import replay** to open the replay viewer, import a bundle, and choose
   **Watch replay**. You can also select the current attempt or a recent recording
   in **Replay source**. Imported bundles and their read-only notes stay in the
   viewer and do not replace the attempt selected in the export dialog.
   Use the replay bar to play/pause,
   select 1×/4×/16× speed, or **Return to attempt**. Playback preserves the live
   world's orders and progress and never awards medals, completions or best times.
   Restart and mission switching are disabled during playback; return to the live
   attempt first.

Bundles contain the source revision and simulation fingerprint, mission definition,
ordered commands at 30 Hz simulation ticks, periodic state checks, outcome, player
note, and approximate foreground active/planning/slow-time durations. Planning
includes briefings and this panel; time spent in another tab/window is excluded.
They contain no screen recording, mouse coordinates, account information, or network
upload. Selection and camera movement are not reproduced: orders name their actual
recipients and world targets. A snapshot taken mid-mission ends at that point.

**Watch replay** requires matching simulation and mission fingerprints and reports
the first mismatched state check. Revision changes limited to UI or documentation
do not invalidate a compatible recording. Source edits reload the dev game so an
attempt cannot silently span different simulation code; its latest autosave becomes
a recent attempt. A dirty revision is marked `+ local changes`; reproducing it may
require the original source changes as well as the recorded revision. The archived
mission definition is diagnostic data, never executable imported game content.

**Try current rules** explicitly runs the same orders against the current mission
without comparing the old state checks. It reports whether the recorded outcome
is reached, which helps distinguish deliberate balance changes from replay bugs.
Successful playback demonstrates one solution, not that a mission's difficulty is
appropriate. Both this mode and the verifier stop at the recorded duration; they do
not invent new orders or wait indefinitely for a changed route to succeed.

The browser accepts files up to 4 MiB. Recording is capped at one hour of simulation
or 20,000 commands; a capped bundle contains the recorded prefix and is marked
`limit`. Foreground planning time does not consume simulation ticks. Autosaving is
best effort, normally every five seconds and on restart/export/page exit; downloads
are the durable copy.

For fast verification without a browser:

```sh
npm run replay:verify -- attempt.replay.json
npm run replay:verify -- --current --expect-win attempt.replay.json
```

The first command verifies compatible code and every state checkpoint. The second
tests completion under current rules. Both exit nonzero on failure. Selected player
victories can be placed in `tests/replays/` to join `npm test`; keep a small set of
distinct routes. Fifteen retained recordings cover operations 01–04. The two
recordings for operations 05–06 no longer win with their new equipment and were
retired without altering the submitted inputs. All ten missions have synthetic
quiet and armed completion tests; new human runs for 05–06 are welcome. See
`tests/replays/README.md` for provenance, current outcomes, and retired routes.

## Controls

| Input                          | Action                                                              |
| ------------------------------ | ------------------------------------------------------------------- |
| Click a portrait; 1–4          | Select individually                                                 |
| Click an operative on the map  | Select an unselected operative; keep a selected group together      |
| Shift-click / Shift+number     | Add to selection; shift-click removes unless it is the last member  |
| Left-drag                      | Select visible bodies; an empty box preserves the current selection |
| Q                              | Select every surviving operative without changing their orders      |
| Right-click ground             | Move selected operatives in a loose formation                       |
| Right-click a labelled diamond | Nearest selected operative approaches and interacts                 |
| Right-click a guard            | Draw weapons and attack                                             |
| G                              | Regroup everyone at the lead selected operative                     |
| S                              | Hold position / release the archive shunt                           |
| F                              | Draw / stow selected weapons                                        |
| E                              | Interact with a nearby landmark                                     |
| H                              | Use a field dressing: one per operative, up to 55 health            |
| B                              | Aim a flash in operation 10; choose a point, then confirm one throw |
| X                              | Put down carried evidence                                           |
| Space                          | Pause / resume; orders work while paused                            |
| Hold Tab                       | Slow time to 20%                                                    |
| Wheel / + and − buttons        | Zoom                                                                |
| Arrows / middle-drag           | Pan                                                                 |
| Home / Follow                  | Follow the selected crew or operative                               |
| Shift+R / Restart              | Restart operation                                                   |
| V                              | Toggle guard sight cones                                            |

On touch screens, tap portraits to select, tap ground or a landmark to order, and drag to pan. The Orders panel provides the main actions. Desktop mouse and keyboard offer the most precise control. Losing tab focus pauses play.

Drawn weapons give the map a crosshair cursor. Hovering an enemy brackets the
target: red means at least one selected operative is in range with clear sight;
amber means range or cover blocks the shot. The map caption explains which.
Attack orders draw weapons and pursue the target when range or cover prevents a
shot. Crew may also close in near the limit of their weapon range. Use **Hold / S**
to stop pursuit. Unarmed prisoners and cargo carriers show a blocked cursor. Reloads and
weapon preparation still apply. Touch attacks briefly show the same brackets.
Usable mission items use a hand cursor; locked items use a help cursor.

On desktop, crew portraits and orders occupy the left panel; mission goals,
witness/extraction actions and status occupy the right. Orders stay in fixed
positions, including the disabled cargo-drop action when nobody is carrying.
**Field notes & records** opens secondary information without moving the map or
orders. Sight cones can be toggled beside **Fit map**. On narrow screens, orders
appear directly below the map, followed by the crew and mission details.

Recruitment, extraction readiness, injuries and messages never shrink the map.
Viewport resizing preserves the camera’s scale. **Fit map** frames the mission in the available
space; operations 01–06 start with this overview. Operations 07–10 start at a readable scale near the crew.

**Follow** / **Home** returns to the selected crew at the last working zoom. When
zoomed in, the camera uses a modest, smoothed look ahead along their route and
a shorter facing lead at rest. A central quiet area absorbs small formation and
aim changes. Explicitly switching to one operative snaps to their position and
facing lead at the current zoom, even if they were already visible. Group changes
and casualties retain smooth tracking. The camera stays still while you
press or drag on the map, and orders use the target you pressed. Select
a portrait or press **1–4** to follow an individual operative, including across a
split team. A map selection snaps after the pointer is released, keeping its
pressed target stable. Selection and movement never change zoom. A widely split group
selection follows its largest nearby group (ties prefer the first selected
operative). Manual panning and objective location focus pause following; selecting
an operative resumes it. Wheel zoom is anchored at the centre of the view.

Map clicks on an already selected operative keep the group selected. Use a portrait or number key to isolate someone deliberately. If the last selected operative falls, selection transfers to the survivors without changing their orders.

Dragging across a character's body deliberately replaces the selection, even if
their feet fall outside the box. Thin or short drags get a minimum 12-pixel box,
shown while dragging. Shift-drag adds the hit operatives.

Group destinations stay on one connected patch around the clicked point. Near a
wall or doorway the formation tightens instead of sending half the crew around
the building. An explicit click beyond the wall still orders a route there.

Squad interactions choose an operative who can reach the item and meets its
requirements: a free pair of hands for CUT, or an unexposed disguise for WARRANT
and a courier signature. Repeating an interaction keeps the current worker and
their progress. If nobody can do it, the reason appears without replacing orders.

Injured portraits show numerical health, with a red warning at low health. A
**+health** button on each injured portrait spends that operative’s dressing
without changing selection or orders. **H** still treats the selected crew.

## Mission guidance

Hover over a mission goal to highlight its relevant items and read the current requirements. Click or tap a goal to keep the guide open and frame those locations. On a phone, this also brings the map back into view. The named buttons in the guide focus individual items; **Escape** or **×** closes it. Locating an objective preserves squad selection and standing orders.

The instructions follow mission progress: CALL after a courier diversion, a second operative while SHUNT is held, forged release or CUT for the transport, the split LOOP/UPLINK upload, planting and clearing the blast areas, and everyone at the same extraction ring. Optional evidence is identified explicitly. Locators follow witnesses, couriers, carried cargo and dropped evidence; edge arrows show targets outside the current view. Marker labels remain readable at low zoom, and pulse animation respects reduced-motion settings.

Extraction stays locked until the required objective is secured: recruit the witness,
carry LEDGER/CASE, finish the audit upload, or destroy both backups. Optional cargo never unlocks the exit.
Locked vans are marked on the map; clicking one explains and highlights the missing
objective without replacing any orders. The same rule covers the sidebar and Interact.
After recovering the objective, extraction controls appear beside its mission
goal in the sidebar. **Rally crew to VAN** (or STREET / SERVICE) orders every survivor to that
exit without changing selection. Counts and names explain who is missing;
**Extract at VAN** appears when the crew and objective are ready. Boarding still
requires an order, so gathering near a van does not silently end optional work.
A waiting witness stays in cover until **Ask … to follow** is pressed. Move or
Hold can cancel individual extraction orders. If a cargo pickup exposes the controls
before the required objective is ready, the exit button stays disabled with its reason.
When SHUNT is held, move everyone out of the archive before using the whole-crew
rally. The panel names anyone still inside and keeps rally disabled until they
clear the shutter, protecting them from being locked in when the operator leaves.

**?** opens objective help. While the guide is open, **Tab** moves between focused UI buttons and **Enter/Space** activates a goal or location. Click the map or close the guide to return focus to gameplay; holding **Tab** on the map still slows time.

## The release clause · Operation 01

- **KIT** contains one maintenance uniform. Taking it conceals the operative's weapon. Workshop access is permitted; the marked secure office remains restricted.
- Suspicion grows only while a guard can see something suspicious. Walls and trams block sight. Unconfirmed suspicion decays out of sight.
- An identifying guard engages locally and needs 2.5 seconds to radio the identification. Other guards learn it after the call.
- Nearby guards can also report audible gunfire through cover without learning the shooter's identity. Stop the caller or disable RADIO before the report completes. The HUD shows call and response countdowns.
- **RADIO** disables further calls and reinforcements. Guards retain their own observations and can still fight.
- **GATE** opens the loading gate from inside. Outside, cutting the lock takes three seconds and triggers the alarm if radios are online.
- **VOSS** follows the operative who recruits her. Interacting again transfers the escort. A survivor takes over if the escort falls.
- **UNIT** is optional evidence. It slows its carrier and occupies both hands. Drop and recollect to transfer it; recover it if its carrier falls.
- Select the crew and right-click or tap **VAN** (the vehicle or its diamond). Everyone selected approaches the van; the order completes when Voss and **all surviving operatives** reach its ring. Unselected operatives keep their orders. Move or Hold cancels extraction for the selected operatives.

An approachable quiet route is KIT → west entrance → RADIO → VOSS → west entrance → VAN. Move promptly in the office and use pause to plan. For an armed approach, keep the crew together, use the trams as cover, and prepare an exit.

Guards can survive a four-person opening volley and return fire at the crew's
weapon range. Use focus fire, cover and field dressings; do not send a lone
operative to work controls under fire. A live alarm brings response teams after
6 and 30 seconds. RADIO stops further arrivals, including after an alarm.

## Material breach · Operation 02

Voss has traced fraudulent contracts to their paper original in a guarded records annex. Bring the **LEDGER** and all surviving operatives to the van on the east road.

- **KIT** grants maintenance access to the yard, not the archive. The ledger is conspicuous even in uniform.
- Assign an operative to **SHUNT** outside the west wall. Their standing order keeps the archive shutter open while another enters. Changing selection preserves the order; moving, Hold, or death releases it. A safety sensor prevents the shutter closing on a person in the doorway.
- **CUT** is the alternative: eight seconds to force the shutter permanently. Local guards investigate even if **RADIO** has been disabled. A trapped operative can also cut the lock from inside.
- Open **GATE** from inside before collecting the ledger. This gives the carrier a short exit on the east road. Watch the patrol and use the archive screen wall as cover.
- The ledger is required, slows its carrier, and occupies both hands. Drop it to fight or transfer it; recover it if its carrier falls. Extraction waits for the carrier and every survivor.
- Bring the shunt operator back along the public street if preserving cover. An automatic route to the east van may go through the restricted yard.

A quiet approach uses a disguised runner and a second operative at SHUNT. Prepare RADIO and GATE before lifting the ledger, time the exit past the road patrol, then release the operator. An armed approach can advance through the west entrance as a group, cut the shutter, and escort the carrier out.

## Adverse possession · Operation 03

The ledger exposes an escrow account. Its physical access keys are in a security courier's **CASE** at the bonded transfer yard. Bring the case and every survivor to the west-street van.

- The courier patrols the secure holding yard. **CALL**, on the public street, starts the transfer when you choose. The courier carries the case along the amber route to the east checkpoint, waits twelve seconds, and returns. A missed transfer can be requested again.
- **DIVERT**, inside the yard, redirects the courier to the screened **INSPECTION** bay. Changing it takes three seconds and attracts suspicion if a guard sees it, even in uniform. Watch the west patrol and wait for their back to turn. It also redirects a transfer already in progress. The courier waits at inspection without a deadline; contact with the crew interrupts their route.
- Take **KIT** and use a disguised operative with a concealed weapon and an identity unknown to the courier or radio network to sign for **CASE** at inspection. Click the case diamond to interact; click the courier's body to attack.
- A signed handover gives that disguised carrier cargo clearance. The case still needs both hands and slows movement. Dropping it, transferring it, or losing the carrier voids clearance; recovered cargo attracts suspicion even in uniform.
- An armed interception drops **CASE** where the courier falls, including before a transfer has started. The squad can recover it and continue the mission. **RADIO** prevents further reinforcement calls; local combat remains active.
- Only possession of the case and every surviving operative at **VAN** completes the contract. Quiet signatures and armed recovery both count.

A quiet route is KIT → RADIO → DIVERT, with another operative at CALL while the runner waits at inspection. Sign for CASE, then bring everyone back through the west entrance. For an ambush, call and divert the courier, hold the west side of the yard as a squad, then recover the case and withdraw. Pause and slow time also stop or slow courier movement and the checkpoint countdown.

DIVERT chooses the route; CALL dispatches the courier. A persistent status beside
the courier objective distinguishes **CALL still needed** from combat or scrutiny
that pauses movement. **Send selected to CALL** orders an available selected
operative to the dispatch post. A site alarm does not cancel the chosen route.

## Protective custody · Operation 04

The access keys lead to auditor **Mara Quill**, held in a security transport at a remand station. Free her and bring every survivor to either extraction van. Once collected, Mara is vulnerable to guard fire and moves more slowly than the operatives. Her death fails the contract.

- **KIT** provides the identity needed for **WARRANT**, a three-second forged release in the records office. Conceal the weapon and keep that operative unexposed. Unlocking the transport does not start the escape: right-click **MARA** when the route is ready.
- **CUT** at the transport is the armed alternative. It takes eight seconds and attracts nearby guards, even after **RADIO** is disabled. Mara stays protected inside until collected.
- **STREET**, beyond the east **GATE**, offers a short but exposed exit. **SERVICE** on the west street is farther away; the walled service corridor provides cover. Order the selected crew to either van or its marker. Extraction waits for Mara and every survivor in the **same** ring. If Mara was told to wait, ask her to follow before leaving.
- The **Witness** controls beside the rescue objective let Mara wait in place or resume following. Right-click her marker to transfer her escort; a surviving operative takes over if her leader falls. She has no disguise, so the runner's uniform does not protect her.
- **Treat Mara** names the nearest eligible operative and spends their field dressing to restore up to 55 health, without changing selection. They need free hands and must stand within two metres with clear sight. The same dressing can otherwise be used for their own wounds.
- A red **Mara under fire** warning appears while a guard can shoot her and for three simulation seconds after a hit, independently of COMMS. Click or tap it to locate her without issuing an order. Low health stays red after contact breaks.
- The **REGISTER** is optional evidence. Carrying it occupies both hands and slows the operative.

For a quiet escape, take KIT, disable RADIO, file WARRANT, and collect Mara. Lead her north of the lower cargo containers, west through the service corridor, and out the west entrance to SERVICE. Send the rest of the crew up the public street. For an armed extraction, clear the transport bay before cutting the lock, leave Mara waiting behind cover while the crew secures the gate, then bring her to STREET.

## Equipment in operations 05–10

| Weapon            | Range | Damage | Shots / magazine | Shot recovery | Automatic reload |
| ----------------- | ----: | -----: | ---------------: | ------------: | ---------------: |
| Pistol            |     6 |     17 |                8 |         0.52s |             1.2s |
| Carbine           |     9 |     26 |                6 |         0.72s |             1.6s |
| Shotgun           |   3.8 |     44 |                2 |         1.05s |             1.8s |
| Compact automatic |   6.4 |     12 |                9 |         0.16s |            1.65s |
| Coil rifle        |    13 |     52 |                3 |         0.75s |             2.2s |

Both sides use these rules. A carbine needs 0.35 seconds stationary after moving
before it can fire. Pistols, shotguns and automatics can fire while moving. Each coil shot requires
1.25 seconds charging while stationary with continuous sight of the same target;
breaking sight, moving, working or stowing cancels the charge. A line and shrinking
ring show the target, even with sight cones off. There is no damage through cover. Empty magazines
reload automatically with unlimited reserve ammunition; movement, stowing, and
new orders preserve the reload. Pause freezes readiness and slow time scales it.

Morrow and Vale carry concealable pistols. Rook and Sable carry carbines in 05;
Rook switches to a shotgun in 06. In 07–10, Rook carries the compact automatic and
Sable carries the coil rifle. Long guns remain visible when stowed, including
while carrying cargo. **KIT** assigns an eligible selected pistol carrier and
names them before they start moving. Briefings show all assignments; portraits
show ammunition and reloads, and the selected operative panel shows weapon,
range and readiness. Hover an enemy to inspect its role and readiness; touch taps
show that information while issuing the usual attack order. Small bars beneath
characters show preparation and reload progress without obscuring faces.

Enemy uniforms identify the role from any direction: **khaki site guards**,
**blue carbine sentries**, **red breach officers**, **violet security marksmen**, and
**ivory credential inspectors with orange shoulder caps**. Officers also wear a
dark chest plate and visor. Regular guards use the same pistol model in every
operation. At close zoom, pistols have a compact slide and grip,
carbines have a box magazine and short stock, and shotguns have a long barrel,
wooden stock and ribbed pump. Those shapes remain visible at low ready or slung
on the back; concealed pistols stay hidden. The automatic has a short brass receiver,
wire stock and deep magazine. The coil rifle has a long pale barrel housing, three
cyan coils and a raised scope; marksmen also wear a single optical lens.

Carbine sentries defend lanes and seek nearby physical cover when hit or reloading.
Breach officers use short-range shotguns and approach last-seen threats through
screened positions. Marksmen hold authored long-range posts, move into cover
under pressure, and do not chase an unseen operative through the site. Nearby specialists can share a directly observed contact;
hearing a shot supplies a location, not knowledge of an unseen person's movements.
Operations 01–04 retain their existing combat rules. Further equipment ideas
remain in [the future design notes](docs/combat-expansion.md).

## Public offering · Operation 05

Mara's audit connects the recovered ledger and account keys. Publish it from the
**Municipal exchange**, then extract every survivor at the east-street **VAN**.

- **UPLINK** takes 24 seconds with free hands. Its operator cannot fire while
  working. Moving or **Hold** pauses the upload; progress survives interruption,
  a handoff, or the operator's death.
- **LOOP** on the west street masks the signal while a second operative holds it.
  Changing selection preserves the loop; moving or **Hold** releases it.
- Without LOOP, five seconds of uploading traces the terminal. Pausing preserves
  the partial trace; holding LOOP clears it until the terminal has been located.
  A completed trace cannot be undone, but the upload can still finish.
- The trace attracts nearby guards. **RADIO** prevents reinforcements, including
  after a trace, but does not stop local investigation or visual recognition.
- **KIT** gives Morrow or Vale maintenance access. The server room is restricted
  even in uniform, and a patrol walks through it. Use the racks to break sight,
  wait for the patrol to leave, and resume the upload.
- **Hold LOOP** and **Work UPLINK** beside the primary goal issue ordinary orders
  to a selected operative with free hands. Upload progress, paused work, loop
  ownership and the trace countdown stay visible when selection changes.
- Prepare **GATE** for the east escape. Once published, both workstations release
  their operators. Bring the west-street operative around the public south road;
  the extraction rally replaces everyone's orders and waits for every survivor.
- **LOG** is optional evidence of suppressed broadcasts. Carrying it is suspicious
  even in uniform and prevents work at either station. Drop it to free the hands.

A carbine sentry watches the server-room approach. Break its lane at the racks;
let covering carbines settle while a teammate moves. The quiet verification route
times patrol windows with a disguised uploader and a LOOP operator, keeping the
long guns screened until withdrawal. The armed route disables RADIO, pauses for
covering fire, treats wounds, and completes a traced upload. Both keep all four
alive and verify replay checkpoints. These are synthetic completion checks;
the old human run `52011baa` was retired because it loses under the new rules.
Its early-extraction feedback remains covered by browser regressions.

## Severance · Operation 06

The audit is public, but the company can rebuild its fraudulent accounts from two
isolated debt backups. Destroy both cores, then get everyone to the north-east van.

- Plant charges at **WEST** and **EAST**. Each takes five uninterrupted seconds
  with free hands; the planter cannot fire. Moving or **Hold** cancels unfinished
  placement. Completed charges persist, including after their planter dies.
- **KIT** gives Morrow or Vale maintenance access. The two core halls remain
  restricted, and planting is conspicuous even in uniform. Watch the room patrols
  and use the racks to break sight. A single infiltrator can plant both charges,
  or split the crew to work in parallel while teammates provide cover.
- There is no fuse timer. Move every survivor outside **both amber blast circles**,
  including anyone who is not selected. Walls do not protect someone inside the
  marked area. **Detonate both cores** stays disabled and names anyone still inside.
- Detonation destroys guards in the circles and draws nearby survivors toward
  the blast. **RADIO** stops reinforcement calls, including after detonation.
  The damaged racks remain obstacles. **GATE** opens the route to the north-east van.
- Planting status and the trigger remain beside the primary objective. VAN stays
  locked until detonation, then the usual rally gathers every survivor and extracts.
  The recovery **REGISTER** is optional and occupies both hands.

The courtyard pairs a carbine sentry with a breach officer, replacing two existing
patrols. If RADIO stays online, the second response wave brings another pair.
Keep distance from the officer's shotgun and move during its recovery; break the
sentry's lane before crossing. The core-room patrol windows remain available.

The quiet verification route uses one disguised planter and a screened northern
withdrawal for the long guns; all four finish without damage or shots. The armed
route uses covering fire, closes shotgun attacks around corners, treats wounds,
and secures the gate. It also extracts all four. The synthetic quiet route checks
replay determinism including detonation. The older human assault `546bc6e8` now
loses and was retired. All fifteen retained human bundles remain unchanged and
win under current rules; older builds require **Try current rules** because the
simulation fingerprint has changed.

## Margin call · Operation 07

A 60 × 42 freight clearinghouse, nearly twice operation 06’s area. Recover the
physical **KEYS** from the north vault and bring every survivor to **VAN**. The
keys occupy both hands and attract suspicion, even in uniform. Extraction remains
locked until a living operative carries them.

**SHUNT** sits on the west street, far from the vault: leave one operative working
there while another enters. Keep it held until the carrier clears the shutter.
Alternatively, **CUT** forces the lock in eight noisy seconds. **RADIO** stops
reinforcements; **GATE** opens the north-east exit quietly from inside.

Violet marksmen cover two freight lanes. Use the warehouses and cargo stacks to
break their charging lines, flank their posts, or cover a crossing with Sable’s
coil rifle. Rook’s automatic rewards close fighting but empties its magazine
quickly. The screened maintenance walk reaches the vault without crossing both
lanes. A carrier still needs a window past the east road patrol. Do not leave the
SHUNT operator behind when rallying at the van.

Verification completes a quiet split-team route with all patrols active and an
armed route through the screened approach, both with all four operatives alive.
Both routes are recorded and replayed against exact simulation checkpoints.

## Adverse selection · Operation 08

Recover the **MANDATE** from a 52 × 38 authorisation works, then bring the carrier
and every survivor to the north-east **VAN**. The camera follows the selected crew
at the same readable scale as operation 07.

Four stationary turrets guard the crossing and records approach. Their amber
and blue cables lead to **WEST** and **EAST**; each feed powers two guns.
**RADIO only stops human reinforcement calls.** Turrets keep working without it,
scan instead of chasing, and show a tracking line for 0.8 seconds before firing.
Solid cover breaks tracking. Each mount has 180 health, a nine-unit carbine range,
and a visible reload. Sable's coil outranges it.

A concealed, unexposed KIT wearer can use **INSPECT** once for a **22-second**
shutdown. Stage the crew first. Each feed takes **four seconds** with free hands
to isolate permanently; the worker cannot fire. Outside inspection, guards
recognise visible sabotage and investigate a tripped breaker. You can still cut
the feeds or destroy the guns after the inspection expires or the disguise is
blown. Disabling security alone does not unlock extraction: MANDATE is required.

Use the west service walk behind reception and the passage north of the generator
hall to reach the feeds. Prepare GATE before lifting the mandate. The screened
records exit has a crossing window behind the east patrol; stage the rest of the
crew before sending the carrier to the van.

Verification covers a quiet, undamaged full-crew extraction and an armed full-crew
extraction without using INSPECT, with exact replay checks for both. A focused
radio-jam assault that ignores the feeds loses three operatives despite using
field dressings. Human playtesting will determine whether the pressure and
available counterplay feel right.

## Key personnel · Operation 09

The mandate is safe with Mara. A subsequent safehouse raid took Vale and Rook;
Morrow and Sable must recover them from personnel retention. This rescue requires
**all four operatives alive**. The 48 × 36 site starts at the same comfortable
follow scale as operations 07–08.

- **KIT** gives Morrow a maintenance identity. Start a partner on **Hold INTAKE**
  at the west remote console, then move the infiltrator through the amber gate.
- Switch the operator to **CELLS** for the blue gate and local cell releases.
  Once the console is staffed, the gate buttons address that operator without
  changing the selected infiltrator. Moving or Hold releases remote power.
- **VALE** and **ROOK** each need two continuously powered seconds of local work
  while a different operative holds CELLS. Losing power restarts the release.
  Guards, RADIO and the road barrier cannot bypass these
  locks. Door safety prevents crushing a crossing operative, but supplies no
  release power. Killing every guard cannot turn this into a solo operation.
- Each rescued teammate becomes controllable immediately, initially unarmed.
  They can individually recover their weapon and dressing at **GEAR**, or leave
  without equipment. Their portraits distinguish captivity from being down.
- After freeing both, use **EXIT** inside detention to latch both gates open.
  Bring the console operator too; the extraction controls then rally everyone
  to **VAN**. The **REGISTER** is optional.

Unavailable mission actions show a grey padlock and **LOCKED** label instead of
the usual diamond. Hover or tap to see the missing prerequisite in the map caption.
Markers update as you free prisoners, switch power or select an eligible teammate;
distance alone does not lock an action, since operatives walk to their targets.

The cell-corridor patrol makes the unarmed escape a timed crossing: wait inside
each cell, then slip out behind it. The office screens the return through intake. The holding patrol and
breach officer make the equipment lockers risky: reunite the armed pair or time
an approach. Exposed identities can still use the powered locks. Verification
includes a quiet, undamaged escape with both prisoners unarmed and a prepared
armed withdrawal with recovered equipment, each recorded and replayed exactly.

## Stay of execution · Operation 10

With the crew reunited, serve Mara's restitution mandate at the enforcement
registry to halt collection orders. The 56 × 42 site keeps the readable follow
zoom. Upload for **20 seconds at UPLINK**, then bring every survivor to **VAN**.
A partner holding **LOOP** masks the five-second terminal trace. With RADIO live,
a trace dispatches mobile site guards and incoming teams to UPLINK. They receive
the terminal location, not the identity or position of an unseen operative.
Bring armed partners to defend the upload, or break off; progress survives
interruptions. The physical **LOG** is optional.

**RADIO is inside the north-east control office**, beyond the inner checkpoint.
A partner must hold the north-street **SHUNT** until the infiltrator leaves,
or someone must force **CUT** with eight seconds of noisy work. Disabling RADIO
then takes four seconds beside the guarded racks. The exit **GATE** opens only
from inside. The upload can succeed with RADIO active; disabling it is a separate
preparation task, not a quick entrance action.

**Credential inspectors** visibly check disguised operatives within four units.
Their orange line and progress bar give **2.5 seconds** to leave range or break
sight. Walking behind their patrol avoids a check. Their ivory uniforms, orange
shoulders and glasses distinguish them from pistol guards.

Rook and Sable each carry **one flash grenade**. Select either or both, press
**Flash / B**, choose a landing point, then confirm the named thrower. Aiming
preserves orders; confirmation stops only that operative and spends one grenade.
Escape or Cancel leaves the supply untouched. Touch uses the same preview and
confirmation. The preview shows exposed teammates and explains blocked throws.

Throws reach seven units; the three-unit blast respects solid cover. A visible
0.45-second throw and 0.6-second fuse precede **1.5 seconds of disorientation**.
Affected people keep moving but cannot acquire targets, shoot or work. Repeated
flashes refresh recovery; they do not add durations. An ongoing backup call
continues. Witnessing a throw identifies its author; hearing the blast supplies
only an investigation location. Wired turrets are unaffected. The local pulse,
shielding pose and recovery bar keep the map readable.

Live-patrol verification completes a quiet, undamaged route, a prepared
radio-disabled assault, and a defended upload with RADIO active. All three
extract the full crew after spending both flashes. A separate direct
radio rush raises the alarm and calls reinforcements while the shutter still
blocks access. All four runs record and replay exactly. Human playtesting is
still needed to judge the difficulty and the usefulness of those short crossings.

The first human run exposed an ineffective trace response and a bad extraction
shortcut. Its unchanged inputs now stall halfway through UPLINK when the
unsupported uploader is caught. It is retained as a diagnostic regression, not
a required victory. Extraction orders for operatives already outside now take
a public perimeter route when available, even after the response team opens
GATE. Ordinary move orders can still enter the site. Substantial detours appear
in the existing map caption, with a clearer route line and initial direction arrow.

## Records

Results track time, crew survival, evidence, and alarm status. Operation five also reports publication; operation six reports backup destruction; operation ten reports the mandate being served. Each operation keeps
separate **Full crew** (all four survive) and **Any crew** best times, plus its
completion count. A faster run with casualties cannot replace the full-crew
record. Version 1/2 records migrate into Any crew because their survivor count
was never stored; version 3 full-crew times are preserved. Play remains available
when browser storage is disabled.

### Operation medals

**Operations** shows **73 medals across ten missions**, with earned medals in
amber and unearned medals faded. Hover, focus with the keyboard, or tap a medal
to read its exact conditions. Escape dismisses the tooltip first. Medal controls
are separate from the button that starts an operation. Results show medals from
the current run and highlight new awards in mint. Briefings repeat the mission's
medals as small icons beside the title, with the same tooltips and earned states.

Click or tap outside any dialog to dismiss it. The game remains paused; with
stacked dialogs, only the top one closes. Escape also remains available. After
a result, dismissing the dialog reveals a **MISSION COMPLETE** or **MISSION
FAILED** splash with results/restart/next controls. Winners and the witness board
the extraction van and drive off; guards keep patrolling. This presentation
does not change the recorded outcome, time, medals or replay. Shift+R works in
mission dialogs, including an unfinished mission’s briefing.

Medals accumulate across successful attempts. Apart from **Settled**, every
challenge requires **all four operatives to extract alive** in the same run.

| Medal | Additional condition | Available on |
| --- | --- | --- |
| Settled | Complete the mission with at least one survivor | Every operation |
| Full crew | Extract all four | Every operation |
| Low profile | Never trigger the site alarm; local suspicion is allowed | Every operation |
| Nonlethal | Kill no guards or courier; unmanned turrets do not count | Every operation |
| No disguise | Leave the maintenance KIT unused | Every operation |
| Open channel | Trigger the alarm and finish without disabling RADIO | Every operation |
| Due diligence | Extract the optional evidence | Operations 01, 04, 05, 06, 09, 10 |
| Light touch | Use SHUNT to recover the evidence without forcing CUT | Operations 02, 07 |
| By the book | Divert the courier with CALL and recover CASE while keeping them alive | Operation 03 |
| Off the record | Complete UPLINK without its trace completing | Operations 05, 10 |
| Power down | Isolate both feeds without destroying a turret; INSPECT is allowed | Operation 08 |
| Travel light | Rescue both prisoners without either recovering GEAR | Operation 09 |

Version 4 records preserve previous times and completions. Existing records
backfill Settled and, where a full-crew time exists, Full crew. The other
conditions were not saved historically and require a new completion. Later
attempts cannot remove medals, and replay playback cannot earn them. Records
and medals are saved in the current browser.

Sound on/off and master volume are both remembered. Restored sound starts on
the first click, tap or key press after loading the page.

## Structure

| Directory      | Responsibility                                                                         |
| -------------- | -------------------------------------------------------------------------------------- |
| `src/sim/`     | World state, navigation, awareness, combat, orders, fixed step; no DOM or Pixi imports |
| `src/content/` | Mission geometry, objectives, patrols, spawns                                          |
| `src/render/`  | Pixi scene, camera, sprites, indicators                                                |
| `src/input/`   | Selection and input-to-command translation                                             |
| `src/ui/`      | HTML interface, briefings, results, versioned local records                            |
| `src/audio/`   | Procedural sound palette, spatial mixer, and presentation-only cue tracking              |
| `src/replay/`  | Browser-independent command recording, validation, checksums, and playback             |
| `src/dev/`     | Development-only playtest panel, recent attempts, import/export                        |
| `scripts/`     | Build identity and headless replay verification                                        |
| `tests/`       | Simulation scenarios and browser checks                                                |

Simulation runs at 30 Hz with interpolated rendering. All gameplay uses world coordinates; isometric projection only affects presentation. Map geometry drives collision, pathfinding, and sight, including the extraction van. A half-metre A* grid uses a binary heap; its connections, smoothing, destinations, and movement share one body-clearance rule. Grid connections are cached per mission and gate/shutter state, so squad orders reuse collision work. Start/end connections and smoothing still check current geometry. Isometric draw order respects entire scenery footprints and the characters' interpolated foot positions. Wall-mounted details inherit their wall's order.

Characters use a small deformable mesh over the existing atlas for alternating steps, knee lift and arm motion. The walking cycle follows interpolated distance travelled, so idle characters stand still and pause/slow time also affect animation. Each character image is anchored between its soles, with contact shadows following the feet along the ground. Tram windscreens, lamps and trim are projected on their actual vertical face. The extraction van has a cab, sloped windscreen, cargo doors and tyres visible through open wheel arches; its original collision footprint is preserved.

CI uses one Ubuntu job, Node 24, and Chromium. Every pull request and main-branch
push runs the full lint, typecheck, build and simulation suite, followed by the
10 browser checks tagged `@smoke`. These cover desktop startup and restart,
squad/individual selection, touch orders, objective guides, locked extraction,
stable layout, camera follow and replay export/playback/restore.

The full browser suite remains available with `npm run test:e2e`, or in
GitHub Actions via **Check → Run workflow → Run the full browser regression suite**.
That option replaces the smoke run rather than running both. Use it for mission
UI, renderer, or broader input changes; extended mission journeys and detailed
graphics checks are not part of the routine gate. Keep `@smoke` for shared player
flows so each new mission does not add another real-time browser journey to CI.

The full simulation suite still runs on every change, including all 29 retained
human completions, complete mission runs for all ten operations (including quiet rescue and armed withdrawal in 09, and both routes in 10 with the flashes already spent),
navigation clearance, local identification, disguise permissions, radio disruption,
evidence custody, demolition safety, and extraction requirements.
Playwright launches Vite with `VITE_BROWSER_TEST=true`, capping its renderer at
15 FPS, and runs one browser at a time so software rendering leaves CPU time for input and assertions.
The fixed-step simulation still follows elapsed time; ordinary dev and production
rendering are uncapped. Local and CI browser tests use the same SwiftShader backend.

## Current scope

Ten ground-level missions and fixed camera orientation. Campaign economy, vehicle driving, multiplayer, and mid-mission saves remain future work. Each operative has a distinct on-map model with 32 facings, a distance-driven walk, an armed stance, and a grounded fallen pose. Hair, skin, clothing, and build correspond to their portraits; disguises preserve their identity. Voss and Mara have their own models and portraits beside the wait/follow control.

See [design notes](docs/design.md) and [art provenance](docs/art.md). Distributed under the repository's [MIT license](LICENSE).
