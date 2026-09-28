# Player completion recordings

Selected successful `.replay.json` bundles go here after playtesting. Vitest runs
them under **current rules** and requires a win within the recorded duration.
When mission and simulation fingerprints match, every original state checkpoint
is also verified. Otherwise this checks a route's continued viability, without
claiming that an older simulation's state checksums still match. Never rewrite a player's commands,
checkpoints, note, or build metadata to make a recording pass.

All twenty-one retained files are byte-for-byte copies of submissions provided in chat:
fifteen on 2026-09-27 and six on 2026-09-28, including their `unversioned` /
local-changes metadata.

## Adverse selection Rally stall

`mandate-full-crew-rally-ad0da662.replay.json` is the unchanged submission
`amortization-mandate-won-ad0da662.replay.json`: mission `b9b6cedf`, simulation
`b99754f6…`, tick 2735 / 91.2s, four survivors, 22 shots, no alarm. It jams RADIO,
isolates both feeds and leaves three human guards alive. GATE stays closed; the
last Rally order at tick 1345 / 44.8s sends all four operatives around the perimeter.
This is the first retained full-crew human completion of operation 08. It does
not use KIT or inspection, so the human quiet-route question remains open.

Feedback: “Clicking \"Rally\" caused lag frames. It would be nice if path-finding
worked across multiple frames instead.” Profiling reproduced four synchronous
A* searches repeatedly testing the same grid connections against every solid.
Connection caching removes that repeated work while preserving immediate orders
and deterministic simulation timing. Edges are checked for full body clearance,
including thin walls and diagonals; gates, shutters and geometry edits cannot
reuse stale connections. Returned waypoints do not expose mutable cached points.

Local headless Chromium measurements of those four routes, including smoothing:

| Case | Before median / peak | After median / peak |
| --- | --- | --- |
| Fresh mission geometry, 15 batches | 210 / 241 ms | 10.3 / 48.9 ms |
| Reused geometry, 30 batches | 262 / 290 ms | 8.6 / 20.7 ms |

These are development-browser measurements, not a hardware-independent frame-time
promise. The first-use batch includes grid construction and engine warm-up.
Searches have not been spread across frames; a worker or deterministic incremental
search remains an option if larger maps or slower devices need it. CI checks
geometry-access counts instead of flaky millisecond limits, without adding browser
smoke journeys.

All 20 original checkpoints in this new recording still match exactly after the
optimization, despite the changed source fingerprint. The two earlier mission-08
wins also retain every original checkpoint. A before/after diagnostic across all
21 human fixtures matched 1,178 sampled simulation states and all outcomes. No
recorded inputs, combat values or mission geometry were changed.

## Adverse selection and camera feedback

The four mission-08 submissions reproduce all original state checkpoints and
outcomes under the current simulation. Mission hash is `b9b6cedf`; `2f4e6eff`
has simulation fingerprint `b99754f6…`, while the other three use `5207de59…`
from before the replay parser fix. A diagnostic playback compared every original
checkpoint even across that parser-only fingerprint change. The camera/input
changes do not change the simulation fingerprint or any recorded command.

| Fixture | Original submission | Outcome |
| --- | --- | --- |
| `mandate-feed-assault-2f4e6eff.replay.json` | `amortization-mandate-won-2f4e6eff.replay.json` | Tick 2264 / 75.5s; 3 survivors; 51 shots |
| `mandate-feed-detour-63c8216c.replay.json` | `amortization-mandate-won-63c8216c.replay.json` | Tick 3089 / 103.0s; 3 survivors; 25 shots |

Both wins jam RADIO, isolate WEST and EAST, and lose Vale. Neither uses KIT,
inspection, or field dressings. The faster run clears the remaining human guards
and opens GATE. The slower run leaves three guards alive and GATE closed; its
final VAN order takes the long walk around the perimeter. Its note, “A little
cheesy, but at least the strat cost time. *shrug*”, describes a working alternate
route with a time cost, not an extraction failure.

The two losses remain diagnostic input rather than required defeats:

- `57cc1984`: “The new camera is nauseating. Misclicked a bunch and died.”
  Repeated movement orders cancel the radio interaction. The alarm starts at
  8.9s and the crew falls at 17.3s.
- `59d45619`: “Brain off = dead. Good.” RADIO is off by 12.9s, but both feeds
  remain live. The crew destroys one turret and falls at 20.6s without an alarm.

The faster win also says “Fair enough. Camera sucks.” Local selection and
casualty changes previously recentered instantly, while short path turns and
automatic aim continuously moved the view. Follow now uses a shorter, filtered
lead, a central quiet area, and bounded pan speed. Pointer holds freeze automatic
tracking, and release keeps the original pressed target even if it moves.
Desktop and touch regressions cover those behaviors along with remote selection,
manual panning, and stable zoom. The recordings do not contain camera or
selection-only events, so they cannot reconstruct the exact nauseating view.
No combat values or mission geometry changed in response to these runs.

## Margin call human assaults

All four submissions on 2026-09-28 verify every original checkpoint against the
current mission hash `b47ff7f7` and simulation fingerprint
`98ab5c929c5b796f9598a154f3ee3906fc645e2602791bf5b10b3feda357e4bd`.
The camera look-ahead change does not alter either fingerprint. The three wins
join the completion corpus unchanged:

| Fixture                                 | Original submission                              | Exact outcome                            |
| --------------------------------------- | ------------------------------------------------ | ---------------------------------------- |
| `clearing-assault-ab8d6570.replay.json` | `amortization-clearing-won-ab8d6570.replay.json` | Tick 1642 / 54.7s; 3 survivors; 55 shots |
| `clearing-assault-8de9cdd6.replay.json` | `amortization-clearing-won-8de9cdd6.replay.json` | Tick 1871 / 62.4s; 3 survivors; 47 shots |
| `clearing-assault-97226b41.replay.json` | `amortization-clearing-won-97226b41.replay.json` | Tick 2525 / 84.2s; 3 survivors; 48 shots |

These are armed advances through the yard followed by CUT and KEYS recovery.
Every win disables RADIO before forcing the shutter and finishes without a site
alarm. Vale dies in the first two listed runs; Sable dies in the third after an
individual attack on the central patrol while already injured. None uses KIT,
SHUNT, or first aid. Rook fires 19–21 automatic rounds in each win; Sable fires
1–4 coil shots. The two marksmen collectively land 1–2 charged shots per win.

The loss, `amortization-clearing-lost-c1b932e6.replay.json`, is diagnostic input,
not a required defeat in the completion corpus. Its note is “Oops. Forgot to jam
radio.” CUT completes and triggers the alarm at 33.4s, KEYS are collected at
37.2s, and the first response wave arrives at 39.5s. Its pistol volley kills
Morrow at 41.9s and Sable at 43.4s near the east gate. Rook is carrying KEYS and
cannot fire; the road patrol kills him at 47.2s. Vale had already fallen at 17.9s.
This is the intended cost of forcing access with the radio still active, not a
mission-ending or replay divergence bug.

The assaults show useful costs and a meaningful radio decision, but do not show
that marksmen demand flanking: focused squad attacks still work while accepting
a casualty. The quiet route, full-crew human completion, and field-dressing use
remain untested by these submissions. No combat values or mission geometry were
changed in response to this small sample.

Replay commands identify order recipients, not selection-only clicks, zoom, or
manual camera movement. They cannot reconstruct the exact view the player saw.
Separate desktop and touch checks exercise movement lead, stationary facing,
smooth turns, split-team selection, manual panning, and stable zoom.

## Earlier routes

Their original checkpoints verified exactly against the fingerprints below
before curation. Formation and interaction assignment now change some outcomes,
without changes to combat values.

| Fixture                              | Original submission                              | Original win           | Current win            |
| ------------------------------------ | ------------------------------------------------ | ---------------------- | ---------------------- |
| `depot-squad-assault.replay.json`    | `amortization-depot-won-152e2421.replay.json`    | Tick 1032; 4 survivors | Tick 1032; 4 survivors |
| `depot-cargo-assault.replay.json`    | `amortization-depot-won-60d3af24.replay.json`    | Tick 884; 4 survivors  | Tick 798; 2 survivors  |
| `transfer-squad-assault.replay.json` | `amortization-transfer-won-52265a74.replay.json` | Tick 784; 4 survivors  | Tick 782; 4 survivors  |

The first depot run rescues Voss without the optional diagnostic unit. The second
collects both. Transfer attacks the courier directly without CALL or DIVERT.

- First depot recording's original simulation fingerprint:
  `81fe5b14268e99d2ba5f2c8855ef7cfab02123d791e97b87ed8f1f4210ebed1d`.
- The other two recordings' original simulation fingerprint:
  `78411c1ee1585649e668ca4df7dd7e6f021effdc29e35a13a925b8a24337b01b`.

The depot recording also reproduces the extraction regression: a separate test
stops issuing commands after its first VAN order and requires the crew and Voss
to finish without later corrective clicks.

## Balance and camera recordings

These original checkpoints verified exactly with simulation fingerprint
`a7adbb3fa75940755122fd673f7ea454e547105731180b24c62823ecd4c87deb`.
The camera and Mara visibility fixes did not change simulation state; the current
formation and interaction changes do.

| Fixture                                   | Original submission                              | Original and current win |
| ----------------------------------------- | ------------------------------------------------ | ------------------------ |
| `depot-running-assault.replay.json`       | `amortization-depot-won-3da29c8c.replay.json`    | Tick 897; 4 survivors    |
| `transfer-contested-recovery.replay.json` | `amortization-transfer-won-7f79741d.replay.json` | Tick 1199; 3 survivors   |
| `custody-radio-breach.replay.json`        | `amortization-custody-won-37456874.replay.json`  | Tick 2318; 4 survivors   |

- Depot: “Bam bam, but like I needed to run.” The crew rescues Voss and leaves the
  optional unit behind.
- Transfer: “I think there was a one-frame glitch when picking up the thing. Had
  to interact to use van.” Picking up CASE shows extraction controls and resizes
  the map. Resizing now happens just before drawing, preserving camera scale and
  position. Boarding still requires an extraction order.
- Custody: “Random zooms as the mission progressed. Don't know why Mara wouldn't
  appear initially.” Extraction controls, Follow, and wrapped COMMS text used to
  refit the camera whenever they changed the map's size. Mara also stayed hidden
  after CUT finished at tick 1534, until recruitment at tick 2150. She now appears
  as soon as either unlock method succeeds.

## Formation, interaction, and aid feedback

All eight latest submissions verified exactly against the same `a7adbb3f…` source
fingerprint before making changes. Three new wins still complete with their
unchanged commands and duration:

| Fixture                                 | Original submission                              | Original win           | Current win            |
| --------------------------------------- | ------------------------------------------------ | ---------------------- | ---------------------- |
| `archive-radio-breach.replay.json`      | `amortization-archive-won-b9d0e13f.replay.json`  | Tick 2122; 4 survivors | Tick 2122; 4 survivors |
| `transfer-yard-assault.replay.json`     | `amortization-transfer-won-93e90df6.replay.json` | Tick 1130; 3 survivors | Tick 1126; 3 survivors |
| `custody-supported-service.replay.json` | `amortization-custody-won-89c4805d.replay.json`  | Tick 1247; 4 survivors | Tick 1247; 4 survivors |

Archive's note is “Fair.” It disables RADIO, breaches, and gets everyone out with
Morrow at 4 HP. Transfer clears the yard with three survivors. Custody disables
RADIO, uses a disguised runner, and sends three armed supporters to clear Mara's
escape to SERVICE; she survives at 27 HP. None of these runs uses first aid.

The other five submissions were diagnostic input, not added as completion tests:

- Depot `0ba95f1c`: “I don't think the group should be allowed to group across a
  big wall.” At tick 212, formation offsets send two operatives across the east
  wall on a 39-unit detour. `tests/orders.test.ts` reproduces the exact clicked
  coordinate and verifies same-side destinations, legal paths, and intentional
  moves outside. With the fix, the original commands finish at tick 660, four
  ticks beyond the recorded duration of 656, so the unchanged bundle is not a
  passing completion fixture.
- Archive `a4fd6906` and `166a4681`: “Oh, I actually lost for a change!” and “Dead
  again.” Both are squad defeats. Under current assignment/formation rules they
  remain unfinished at their recorded end; tests do not require them to lose.
- Custody `4d0c6d9f`: a selected register carrier blocks CUT while a free-handed
  teammate is available. The assignment regression now selects that teammate,
  preserves an existing worker's progress, and explains missing prerequisites
  without cancelling orders. The changed run is unfinished at its recorded end.
- Custody `24c932cf`: Mara takes five shots and dies while the crew is unharmed;
  this still loses at tick 1271. The warning, nearby Wait/Follow and named treatment
  controls make the danger and available responses visible without reducing it.

## Objective layout and dispatch feedback

Five follow-up submissions verify every original checkpoint against fingerprint
`5d872cfaeb8278d03194bc3b70afaf9faefc9d923b5e67f05142d9e88e29c349`.
These fixes only change UI and input; the simulation fingerprint and all five
recorded outcomes remain exact. The four wins are retained unchanged:

| Fixture                                       | Original submission                              | Exact outcome          |
| --------------------------------------------- | ------------------------------------------------ | ---------------------- |
| `depot-east-rescue.replay.json`               | `amortization-depot-won-a906dd5e.replay.json`    | Tick 965; 4 survivors  |
| `archive-radio-assault.replay.json`           | `amortization-archive-won-ea26e016.replay.json`  | Tick 1456; 3 survivors |
| `transfer-diversion-without-call.replay.json` | `amortization-transfer-won-76590a8c.replay.json` | Tick 1615; 3 survivors |
| `custody-street-rescue.replay.json`           | `amortization-custody-won-dd8fd0f4.replay.json`  | Tick 2103; 4 survivors |

Depot, archive and custody criticize intrusive full-width panels; custody says
they made map clicks impossible. At 1280×720, replaying custody to tick 2000
reduced the map from 475 to 206 pixels high. Witness and extraction actions now
sit beside the corresponding objectives, COMMS is in the sidebar, and dressing
buttons fit inside the portrait strip. That layout kept the map 530 pixels high throughout
the same replay; the later split-panel layout below raises it to 626 pixels. Browser regressions check stable geometry and actual map input
with recovery, injuries, long messages and touch/keyboard actions.

Transfer's note asks whether the alarm prevented diversion. It did not: the alarm
starts at tick 250, RADIO is disabled at 336, and DIVERT succeeds at 515. No CALL
command is issued. The courier remains ready until combat starts at 1040, then
falls at 1120. Persistent feedback now states “DIVERT set · CALL still needed,”
provides a direct order to the CALL post, and separately explains interrupted
movement. The shortcut still requires travel and uses the normal command recorder.

Archive loss `a1c5da30` says “Tried to recover using stealth but got caught...”
Rook takes KIT at tick 874 with 4 HP, after being identified and reported; the
uniform does not erase that knowledge. The selected-operative summary now
explicitly labels a compromised uniform. The loss still verifies at tick 2149;
it is diagnostic feedback, not a required losing route in the completion corpus.

## Separate crew and mission panels

Two more submissions verify every checkpoint against the same `5d872cfa…`
fingerprint and join the completion corpus unchanged:

| Fixture                               | Original submission                             | Exact outcome          |
| ------------------------------------- | ----------------------------------------------- | ---------------------- |
| `archive-interact-access.replay.json` | `amortization-archive-won-57019494.replay.json` | Tick 1517; 3 survivors |
| `depot-loaded-extraction.replay.json` | `amortization-depot-won-f9cf0217.replay.json`   | Tick 1097; 4 survivors |

Archive reports having to scroll to access Interact. Depot's note is “Bang
bang.” At archive tick 1400 on a 1280×720 laptop, Interact began at y=1015 in a
1288-pixel-tall sidebar. Moving crew and orders to the left, with mission actions
and status on the right, puts Interact at y=572 without scrolling. The map is
776×626 and does not change during either replay. The custody replay also fits
both panels, including its two exits, on the same laptop viewport.

Browser regressions use a physical click on Interact, check both panels before
any automatic scrolling, and cover witness injuries, unavailable aid, records
opened by keyboard, and phone controls. Notes and records no longer compete
with active orders for space; cargo-drop availability does not move the buttons.
These are layout and input changes only, with no changes to simulation rules.

## Public offering extraction feedback (retired run)

`broadcast-premature-extraction.replay.json` was the unchanged submission
`amortization-broadcast-won-52011baa.replay.json`, recorded against simulation
fingerprint `1a2e5da7f430f443455bd2dfc1e0801d4690ecb2c4cbe86a1a4548cade35cbbf`.
Before the weapon rollout, it verified every checkpoint and won at tick **5851**,
with **4 survivors**, no site alarm, the audit published, and optional LOG extracted.

The note reads: “Being able to rally for the exit without being allowed to leave
is annoying.” LOG pickup exposed an enabled rally button with less than one
second of the 24-second upload complete. The first VAN order is at tick 1012;
another at tick 3723 interrupts an active uploader at 2.2 seconds of progress.
The audit finishes before the final VAN order at tick 4918.

Live input now rejects premature extraction before recording or dispatching an
order, explains the missing objective and opens its locator. Sidebar actions and
map markers use the same readiness rule. This changes the input affordance, not
the replay command format or simulation: previously recorded orders still play
back exactly under that simulation. The weapon rollout later invalidated this
route; separate browser regressions still verify that new early exit clicks
preserve standing orders and that completing the audit enables a rally which actually ends the mission.

## Severance squad assault (retired run)

`severance-squad-assault.replay.json` was the unchanged submission
`amortization-severance-won-546bc6e8.replay.json`, with an empty feedback note.
Every original checkpoint verified against simulation fingerprint
`6d4441a171e3a3d4bd4dfe8a7088840278bfeda3667cbd19fa2a8f4df0473b1e`.
It won at tick **1684** (56.1 seconds), with **4 survivors**, **50 shots**, no
site alarm, both backups destroyed, and the optional REGISTER extracted.

The crew advances together, disables RADIO early, collects REGISTER, and plants
WEST followed by EAST. A repeated EAST order preserves the placement progress.
They leave through GATE, detonate outside the compound, and board VAN. No
disguise or field dressing was used. The weapon rollout invalidates this route;
a replacement human completion is still needed.

## Retired recordings

These recordings no longer win within their recorded duration under revised
rules and were removed from the completion corpus. Original submissions remain
in git history; they were not converted to passing fixtures.

- `broadcast-premature-extraction.replay.json` (`52011baa`, PR #14): the new weapon
  ranges, stationary carbine preparation and sentry encounter defeat the old
  assault at tick 615, before its next recorded order. Its original win was tick
  5851. The premature extraction regression remains covered in browser tests.
- `severance-squad-assault.replay.json` (`546bc6e8`, PR #14): the new loadout and
  specialist pair defeat the old moving assault at tick 930, before its next
  recorded order. Its original win was tick 1684. The synthetic quiet and armed
  routes now use the new weapon commitments; new human runs are needed.
- `archive-breach-assault.replay.json` (`860040c5`, PR #9): note “Fair.” Formation
  changes alter combat positions and choose a different ledger carrier. The crew
  is ready at tick 1522 but needs another 16 ticks to finish boarding. The new
  archive recording above supplies human completion coverage.
- `archive-split-team.replay.json` (`67fbe5a2`, PR #7): the stronger defense leaves
  two survivors and the mission unfinished at its recorded end. Note: “Fair enough.”
- `archive-squad-assault.replay.json` (`fb6e037b`, PR #8): the direct assault loses
  the crew at tick 1009. Feedback about box selection and ending the mission led
  to body-aware drag selection and explicit extraction controls.
- `custody-street-assault.replay.json` (`8baeb481`, PR #8): the crew falls at tick
  1608, before the transport breach finishes. Note: “Bam, bam, read objective,
  click, done.”
- `transfer-stealth.replay.json` (`e275548b`, PR #7) was retired when DIVERT gained
  a watched three-second interaction and the courier gained a patrol.

Earlier notes (“Click stuff. Go home.” and “Shoot and click.”) motivated guard
survivability, equal weapon range, audible gunfire reports, and earlier response
teams. Those earlier passes changed formation, assignment, feedback and records.
PR #14 introduces new weapon rules and specialist enemies only in operations
05–06; the fifteen retained routes for 01–04 continue to win. All six missions
also retain command-driven quiet and armed completion tests. Those are synthetic
routes, not human runs.

```sh
npm run replay:verify -- attempt.replay.json
npm run replay:verify -- --current --expect-win attempt.replay.json
```
