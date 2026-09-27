# Amortization

A real-time squad tactics game for the browser. Control four operatives together or individually. One maintenance disguise admits a single person; the rest of the crew can prepare access or provide armed backup.

**Four operations** are playable from briefing through extraction or defeat. Use **Operations** to launch any contract, or **Next operation** after completing any of the first three. Restart and Shift+R restart the selected mission.

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
npm run test:e2e    # focused Chromium interaction checks
npm run preview    # serve the production build
```

`npm run build` writes `dist/`. Serve the whole directory over HTTP, including `assets/`. The default relative asset base supports hosting under `/amortization/` or another subdirectory. For an explicit base, use `BASE_PATH=/amortization/ npm run build`. Opening `index.html` directly with `file://` is not supported.

To play from another device on your local network, use `npm run dev -- --host 0.0.0.0`.

## Controls

| Input                          | Action                                                             |
| ------------------------------ | ------------------------------------------------------------------ |
| Click a portrait; 1–4          | Select individually                                                |
| Click an operative on the map  | Select an unselected operative; keep a selected group together     |
| Shift-click / Shift+number     | Add to selection; shift-click removes unless it is the last member |
| Left-drag                      | Select a group; an empty box preserves the current selection       |
| Q                              | Select every surviving operative without changing their orders     |
| Right-click ground             | Move selected operatives in a loose formation                      |
| Right-click a labelled diamond | Nearest selected operative approaches and interacts                |
| Right-click a guard            | Draw weapons and attack                                            |
| G                              | Regroup everyone at the lead selected operative                    |
| S                              | Hold position / release the archive shunt                          |
| F                              | Draw / conceal selected weapons                                    |
| E                              | Interact with a nearby landmark                                    |
| H                              | Use a field dressing: one per operative, up to 55 health           |
| X                              | Put down carried evidence                                          |
| Space                          | Pause / resume; orders work while paused                           |
| Hold Tab                       | Slow time to 20%                                                   |
| Wheel / + and − buttons        | Zoom                                                               |
| Arrows / middle-drag           | Pan                                                                |
| Home / Fit map                 | Reset camera                                                       |
| Shift+R / Restart              | Restart operation                                                  |
| V                              | Toggle guard sight cones                                           |

On touch screens, tap portraits to select, tap ground or a landmark to order, and drag to pan. The sidebar provides the main actions. Desktop mouse and keyboard offer the most precise control. Losing tab focus pauses play.

Map clicks on an already selected operative keep the group selected. Use a portrait or number key to isolate someone deliberately. If the last selected operative falls, selection transfers to the survivors without changing their orders.

## Mission guidance

Hover over a mission goal to highlight its relevant items and read the current requirements. Click or tap a goal to keep the guide open and frame those locations. On a phone, this also brings the map back into view. The named buttons in the guide focus individual items; **Escape** or **×** closes it. Locating an objective preserves squad selection and standing orders.

The instructions follow mission progress: CALL after a courier diversion, a second operative while SHUNT is held, forged release or CUT for the transport, and everyone at the same extraction ring. Optional evidence is identified explicitly. Locators follow witnesses, couriers, carried cargo and dropped evidence; edge arrows show targets outside the current view. Marker labels remain readable at low zoom, and pulse animation respects reduced-motion settings.

**?** opens objective help. While the guide is open, **Tab** moves between focused UI buttons and **Enter/Space** activates a goal or location. Click the map or close the guide to return focus to gameplay; holding **Tab** on the map still slows time.

## The release clause · Operation 01

- **KIT** contains one maintenance uniform. Taking it conceals the operative's weapon. Workshop access is permitted; the marked secure office remains restricted.
- Suspicion grows only while a guard can see something suspicious. Walls and trams block sight. Unconfirmed suspicion decays out of sight.
- An identifying guard engages locally and needs 2.5 seconds to radio the identification. Other guards learn it after the call.
- **RADIO** disables further calls and reinforcements. Guards retain their own observations and can still fight.
- **GATE** opens the loading gate from inside. Outside, cutting the lock takes three seconds and triggers the alarm if radios are online.
- **VOSS** follows the operative who recruits her. Interacting again transfers the escort. A survivor takes over if the escort falls.
- **UNIT** is optional evidence. It slows its carrier and occupies both hands. Drop and recollect to transfer it; recover it if its carrier falls.
- Bring Voss and **all surviving operatives** inside the extraction area, then interact with **VAN**.

An approachable quiet route is KIT → west entrance → RADIO → VOSS → west entrance → VAN. Move promptly in the office and use pause to plan. For an armed approach, keep the crew together, use the trams as cover, and prepare an exit.

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

- **CALL**, on the public street, starts the transfer when you choose. The courier carries the case along the amber route to the east checkpoint, waits twelve seconds, and returns. A missed transfer can be requested again.
- **DIVERT**, inside the yard, redirects the courier to the screened **INSPECTION** bay. It also redirects a transfer already in progress. The courier waits at inspection without a deadline; contact with the crew interrupts their route.
- Take **KIT** and use a disguised operative with a concealed weapon and an identity unknown to the courier or radio network to sign for **CASE** at inspection. Click the case diamond to interact; click the courier's body to attack.
- A signed handover gives that disguised carrier cargo clearance. The case still needs both hands and slows movement. Dropping it, transferring it, or losing the carrier voids clearance; recovered cargo attracts suspicion even in uniform.
- An armed interception drops **CASE** where the courier falls, including before a transfer has started. The squad can recover it and continue the mission. **RADIO** prevents further reinforcement calls; local combat remains active.
- Only possession of the case and every surviving operative at **VAN** completes the contract. Quiet signatures and armed recovery both count.

A quiet route is KIT → RADIO → DIVERT, with another operative at CALL while the runner waits at inspection. Sign for CASE, then bring everyone back through the west entrance. For an ambush, call and divert the courier, hold the west side of the yard as a squad, then recover the case and withdraw. Pause and slow time also stop or slow courier movement and the checkpoint countdown.

## Protective custody · Operation 04

The access keys lead to auditor **Mara Quill**, held in a security transport at a remand station. Free her and bring every survivor to either extraction van. Once collected, Mara is vulnerable to guard fire and moves more slowly than the operatives. Her death fails the contract.

- **KIT** provides the identity needed for **WARRANT**, a three-second forged release in the records office. Conceal the weapon and keep that operative unexposed. Unlocking the transport does not start the escape: right-click **MARA** when the route is ready.
- **CUT** at the transport is the armed alternative. It takes eight seconds and attracts nearby guards, even after **RADIO** is disabled. Mara stays protected inside until collected.
- **STREET**, beyond the east **GATE**, offers a short but exposed exit. **SERVICE** on the west street is farther away; the walled service corridor provides cover. Bring Mara and every surviving operative to the **same** extraction ring, then interact with its marker.
- The **Escort** controls let Mara wait in place or resume following. Right-click her marker to transfer her escort; a surviving operative takes over if her leader falls. She has no disguise, so the runner's uniform does not protect her.
- **Treat Mara** spends one selected operative's field dressing to restore up to 55 health. That operative needs free hands and must stand within two metres with clear sight. The same dressing can otherwise be used for their own wounds.
- The **REGISTER** is optional evidence. Carrying it occupies both hands and slows the operative.

For a quiet escape, take KIT, disable RADIO, file WARRANT, and collect Mara. Lead her north of the lower cargo containers, west through the service corridor, and out the west entrance to SERVICE. Send the rest of the crew up the public street. For an armed extraction, clear the transport bay before cutting the lock, leave Mara waiting behind cover while the crew secures the gate, then bring her to STREET.

Results track time, crew survival, evidence, and alarm status. Best times and completion counts are stored separately for each operation. Existing first-mission records migrate automatically. Play remains available when browser storage is disabled.

## Structure

| Directory      | Responsibility                                                                         |
| -------------- | -------------------------------------------------------------------------------------- |
| `src/sim/`     | World state, navigation, awareness, combat, orders, fixed step; no DOM or Pixi imports |
| `src/content/` | Mission geometry, objectives, patrols, spawns                                          |
| `src/render/`  | Pixi scene, camera, sprites, indicators                                                |
| `src/input/`   | Selection and input-to-command translation                                             |
| `src/ui/`      | HTML interface, briefings, results, versioned local records                            |
| `src/audio/`   | Gesture-activated synthesized effects                                                  |
| `tests/`       | Simulation scenarios and browser checks                                                |

Simulation runs at 30 Hz with interpolated rendering. All gameplay uses world coordinates; isometric projection only affects presentation. Map geometry drives collision, pathfinding, and sight, including the extraction van. A half-metre A* grid uses a binary heap; its connections, smoothing, destinations, and movement share one body-clearance rule. Isometric draw order respects entire scenery footprints and the characters' interpolated foot positions. Wall-mounted details inherit their wall's order.

Characters use a small deformable mesh over the existing atlas for alternating steps, knee lift and arm motion. The walking cycle follows interpolated distance travelled, so idle characters stand still and pause/slow time also affect animation. Each character image is anchored between its soles, with contact shadows following the feet along the ground. Tram windscreens, lamps and trim are projected on their actual vertical face. The extraction van has a cab, sloped windscreen, cargo doors and tyres visible through open wheel arches; its original collision footprint is preserved.

CI uses one Ubuntu job, Node 24, and Chromium. The simulation suite includes complete quiet and armed extractions for all four missions and checks for navigation clearance, local identification, disguise permissions, radio disruption, evidence custody, and extraction requirements.

## Current scope

Four ground-level missions and fixed camera orientation. Campaign economy, vehicle driving, multiplayer, full directional character art, and mid-mission saves remain future work. In-world operatives share animated art and use numbered selection markers; their portraits are distinct.

See [design notes](docs/design.md) and [art provenance](docs/art.md). Distributed under the repository's [MIT license](LICENSE).
