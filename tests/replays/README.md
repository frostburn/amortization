# Player completion recordings

Selected successful `.replay.json` bundles go here after playtesting. The normal
Vitest suite replays them under **current rules** and requires a win. This is an
explicit gameplay regression check, not a claim that an older simulation's state
checksums still match. Deliberate balance changes can require new recordings.

Keep this corpus small: choose useful, distinct routes rather than every attempt.
Failed or unfinished bundles remain useful for diagnosis without becoming win
fixtures. `replay.test.ts` exercises recording and exact playback independently,
including a complete command-only extraction.

## Curated routes

`depot-squad-assault.replay.json` is the unchanged player submission
`amortization-depot-won-152e2421.replay.json`, recorded on 2026-09-27 and provided
in chat for PR #7. It sends the full squad through the depot, engages guards,
recruits the escort, and returns to extraction. The player reported a straightforward
guns-blazing approach with some shuffling needed to finish.

- Exactly verified against simulation fingerprint
  `81fe5b14268e99d2ba5f2c8855ef7cfab02123d791e97b87ed8f1f4210ebed1d`.
- Won at tick 1032 (34.4 simulation seconds), with 38 orders, 19 shots, all four
  agents surviving, no alarm, and optional evidence uncollected.
- The source was marked `unversioned` with local changes. That metadata and the
  original note/checkpoints are preserved; the matching fingerprint establishes
  compatibility without inventing a source revision.

`archive-split-team.replay.json` is the unchanged player submission
`amortization-archive-won-67fbe5a2.replay.json`, recorded on 2026-09-27 and provided
in chat for PR #7. Its orders start with one operative entering the archive, then
switch to the other three operatives to recover the evidence and extract.

- Exactly verified against the same simulation fingerprint above.
- Won at tick 2176 (72.53 simulation seconds), with 61 orders, 41 shots, three
  agents surviving, no alarm, and evidence extracted.
- The original note, “Fair enough.”, and the `unversioned`/local-changes build
  metadata are preserved along with the original checkpoints.

`transfer-stealth.replay.json` is the unchanged player submission
`amortization-transfer-won-e275548b.replay.json`, recorded on 2026-09-27 and provided
in chat for PR #7. Most orders direct one operative through dispatch, diversion,
radio relay, and evidence pickup interactions before squad extraction.

- Exactly verified against the same simulation fingerprint above.
- Won at tick 1503 (50.1 simulation seconds), with 35 orders, all four agents
  surviving, no shots, no alarm, and evidence extracted.
- The original note and the `unversioned`/local-changes build metadata are
  preserved along with the original checkpoints.
- Player feedback for the gameplay pass: the diversion felt unnecessary; give
  the diverted character a guarding cycle that the player must sneak around.
  Ending the mission also required extra clicks and positioning adjustments.

Each recording has its own named current-rules completion test. These routes
cover depot, archive, and transfer; custody still has no player recording.
They do not establish that the campaign's difficulty is appropriate. Balance
changes may intentionally invalidate a route and require a new recording.

To verify a submitted bundle against compatible code before curating it:

```sh
npm run replay:verify -- attempt.replay.json
npm run replay:verify -- --current --expect-win attempt.replay.json
```
