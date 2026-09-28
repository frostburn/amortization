# Player completion recordings

Selected successful `.replay.json` bundles go here after playtesting. Vitest runs
them under **current rules** and requires a win within the recorded duration.
This checks a route's continued viability; it does not claim that an older
simulation's state checksums still match. Never rewrite a player's commands,
checkpoints, note, or build metadata to make a recording pass.

All fifteen retained files are byte-for-byte copies of submissions provided in chat
on 2026-09-27, including their `unversioned` / local-changes metadata.

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
