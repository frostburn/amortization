# Player completion recordings

Selected successful `.replay.json` bundles go here after playtesting. The normal
Vitest suite replays them under **current rules** and requires a win. This is an
explicit gameplay regression check, not a claim that an older simulation's state
checksums still match. Deliberate balance changes can require new recordings.

Keep this corpus small: choose useful, distinct routes rather than every attempt.
Failed or unfinished bundles remain useful for diagnosis without becoming win
fixtures. There are no player recordings yet; the fixture check is skipped until
the first bundle is integrated. `replay.test.ts` exercises recording and exact
playback independently, including a complete command-only extraction.

To verify a submitted bundle against compatible code before curating it:

```sh
npm run replay:verify -- attempt.replay.json
npm run replay:verify -- --current --expect-win attempt.replay.json
```
