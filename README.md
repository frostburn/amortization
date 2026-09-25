# Amortization

A real-time squad tactics game for the browser. Control four operatives together or individually. One maintenance disguise admits a single person; the rest of the crew can prepare access or provide armed backup.

**Two operations** are playable from briefing through extraction or defeat. Use **Operations** to launch either contract, or **Next operation** after completing the first. Restart and Shift+R restart the selected mission.

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

| Input                              | Action                                                         |
| ---------------------------------- | -------------------------------------------------------------- |
| Click an operative / portrait; 1–4 | Select individually                                            |
| Shift-click / Shift+number         | Add to selection; shift-click also removes                     |
| Left-drag                          | Select a group                                                 |
| Q                                  | Select every surviving operative without changing their orders |
| Right-click ground                 | Move selected operatives in a loose formation                  |
| Right-click a labelled diamond     | Nearest selected operative approaches and interacts            |
| Right-click a guard                | Draw weapons and attack                                        |
| G                                  | Regroup everyone at the lead selected operative                |
| S                                  | Hold position / release the archive shunt                      |
| F                                  | Draw / conceal selected weapons                                |
| E                                  | Interact with a nearby landmark                                |
| H                                  | Use a field dressing: one per operative, up to 55 health       |
| X                                  | Put down carried evidence                                      |
| Space                              | Pause / resume; orders work while paused                       |
| Hold Tab                           | Slow time to 20%                                               |
| Wheel / + and − buttons            | Zoom                                                           |
| Arrows / middle-drag               | Pan                                                            |
| Home / Fit map                     | Reset camera                                                   |
| Shift+R / Restart                  | Restart operation                                              |
| V                                  | Toggle guard sight cones                                       |

On touch screens, tap portraits to select, tap ground or a landmark to order, and drag to pan. The sidebar provides the main actions. Desktop mouse and keyboard offer the most precise control. Losing tab focus pauses play.

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

CI uses one Ubuntu job, Node 24, and Chromium. The simulation suite includes complete quiet and armed extractions for both missions and checks for navigation clearance, local identification, disguise permissions, radio disruption, evidence custody, and extraction requirements.

## Current scope

Two ground-level missions and fixed camera orientation. Campaign economy, vehicle driving, multiplayer, directional character animation, and mid-mission saves remain future work. In-world operatives share a sprite and use numbered selection markers; their portraits are distinct.

See [design notes](docs/design.md) and [art provenance](docs/art.md). Distributed under the repository's [MIT license](LICENSE).
