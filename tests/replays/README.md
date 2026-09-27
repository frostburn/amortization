# Player completion recordings

Selected successful `.replay.json` bundles go here after playtesting. Vitest runs
them under **current rules** and requires a win. This checks a route's continued
viability; it does not claim that an older simulation's state checksums still match.
Never rewrite a player's commands, checkpoints, note, or build metadata to make a
recording pass. Deliberate gameplay changes can require new recordings.

## Earlier routes

These three submissions remain byte-for-byte unchanged. All were provided in chat
on 2026-09-27 with `unversioned` / local-changes build metadata. Their original
checkpoints verified exactly against the fingerprints below before curation.

| Fixture                              | Original submission                              | Original win                               | Current rules                           |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------ | --------------------------------------- |
| `depot-squad-assault.replay.json`    | `amortization-depot-won-152e2421.replay.json`    | Tick 1032; 4 survivors; 19 shots; no alarm | Tick 1032; 4 survivors; 36 shots; alarm |
| `depot-cargo-assault.replay.json`    | `amortization-depot-won-60d3af24.replay.json`    | Tick 884; 4 survivors; 19 shots; no alarm  | Tick 858; 3 survivors; 63 shots; alarm  |
| `transfer-squad-assault.replay.json` | `amortization-transfer-won-52265a74.replay.json` | Tick 784; 4 survivors; 24 shots; no alarm  | Tick 784; 4 survivors; 43 shots; alarm  |

The first depot run rescues Voss without the optional diagnostic unit. The second
collects both. Transfer attacks the courier directly without CALL or DIVERT.

- First depot recording's original simulation fingerprint:
  `81fe5b14268e99d2ba5f2c8855ef7cfab02123d791e97b87ed8f1f4210ebed1d`.
- The other two recordings' original simulation fingerprint:
  `78411c1ee1585649e668ca4df7dd7e6f021effdc29e35a13a925b8a24337b01b`.

The depot recording also reproduces the extraction regression: a separate test
stops issuing commands after its first VAN order and requires the crew and Voss
to finish without later corrective clicks.

## New balance recordings

Four more submissions from 2026-09-27 are also retained byte-for-byte, including
their `unversioned` / local-changes metadata. Every original checkpoint and win
verifies exactly with simulation fingerprint
`a7adbb3fa75940755122fd673f7ea454e547105731180b24c62823ecd4c87deb`.
The camera and Mara visibility fixes do not change simulation state.

| Fixture | Original submission | Original and current win |
| --- | --- | --- |
| `depot-running-assault.replay.json` | `amortization-depot-won-3da29c8c.replay.json` | Tick 897; 4 survivors; 37 shots; alarm |
| `archive-breach-assault.replay.json` | `amortization-archive-won-860040c5.replay.json` | Tick 1522; 3 survivors; 70 shots; alarm |
| `transfer-contested-recovery.replay.json` | `amortization-transfer-won-7f79741d.replay.json` | Tick 1199; 3 survivors; 49 shots; alarm |
| `custody-radio-breach.replay.json` | `amortization-custody-won-37456874.replay.json` | Tick 2318; 4 survivors; 46 shots; no alarm |

- Depot: “Bam bam, but like I needed to run.” The crew rescues Voss and leaves the
  optional unit behind.
- Archive: “Fair.” The crew breaches the shutter and extracts the ledger.
- Transfer: “I think there was a one-frame glitch when picking up the thing. Had
  to interact to use van.” Picking up CASE shows the extraction controls and
  resizes the map. Resizing now happens just before drawing, without changing
  camera scale or position. Boarding still requires an extraction order.
- Custody: “Random zooms as the mission progressed. Don't know why Mara wouldn't
  appear initially.” Extraction controls, Follow, and wrapped COMMS text used to
  refit the camera whenever they changed the map's size. Mara also stayed hidden
  after CUT finished at tick 1534, until recruitment at tick 2150. She now appears
  as soon as either unlock method succeeds.

## Retired recordings and feedback

The following recordings no longer complete with their original commands under
the revised rules and were removed from the completion corpus. The original
submissions remain in git history; they were not converted to passing fixtures.

- `archive-split-team.replay.json` (`67fbe5a2`, PR #7): the original split-team run
  ended with three survivors. The stronger defense leaves two survivors and the
  mission unfinished at its recorded end tick. Original note: “Fair enough.”
- `archive-squad-assault.replay.json` (`fb6e037b`, PR #8): the direct assault loses
  the crew at tick 1009. The original feedback about box selection and ending the
  mission led to body-aware drag selection and explicit extraction controls.
- `custody-street-assault.replay.json` (`8baeb481`, PR #8): the crew falls at tick
  1608, before the transport breach finishes. Original note: “Bam, bam, read
  objective, click, done.”
- `transfer-stealth.replay.json` (`e275548b`, PR #7) was already retired when DIVERT
  gained a watched three-second interaction and the courier gained a patrol.

The retained PR #8 notes (“Click stuff. Go home.” and “Shoot and click.”) also
motivated guard survivability, equal weapon range, audible gunfire reports, and
earlier response teams. Transfer now receives seven enemy shots instead of zero.

All four missions still have command-driven quiet and armed completion tests.
The revised archive and custody assault tests prioritize RADIO and first aid;
the transfer ambush focuses nearby guards before working DIVERT. These are
synthetic verification routes, not replacement human recordings. The new human
recordings above restore completion coverage across all four missions.

```sh
npm run replay:verify -- attempt.replay.json
npm run replay:verify -- --current --expect-win attempt.replay.json
```
