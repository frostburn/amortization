# Player completion recordings

Selected successful `.replay.json` bundles go here after playtesting. Vitest runs
them under **current rules** and requires a win within the recorded duration.
This checks a route's continued viability; it does not claim that an older
simulation's state checksums still match. Never rewrite a player's commands,
checkpoints, note, or build metadata to make a recording pass.

All thirteen retained files are byte-for-byte copies of submissions provided in chat
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
buttons fit inside the portrait strip. The map stays 530 pixels high throughout
the same replay. Browser regressions check stable geometry and actual map input
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

## Retired recordings

These recordings no longer win within their recorded duration under revised
rules and were removed from the completion corpus. Original submissions remain
in git history; they were not converted to passing fixtures.

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
teams. This pass changes formation, assignment, feedback and record categories;
it does not change combat values. All four missions also retain command-driven
quiet and armed completion tests. Those are synthetic routes, not human runs.

```sh
npm run replay:verify -- attempt.replay.json
npm run replay:verify -- --current --expect-win attempt.replay.json
```
