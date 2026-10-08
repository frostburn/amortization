# Night mission music

**Negative Carry**, composed by Lumi Pakkanen.

- `negative-carry.xenpaper.json`: original from [Xenpaper 3](https://github.com/frostburn/xenpaper3/blob/1d1d6850072114b12fd74765d7f9d1230630ff72/src/demo-projects/negative-carry.xenpaper.json).
- `negative-carry-combat.xenpaper.json`: the supplied combat variation, unchanged.
- Compiler and patches: Xenpaper `1d1d6850072114b12fd74765d7f9d1230630ff72` (3.0.0-beta.18), MIT, copyright 2026 Lumi Pakkanen. See [license](XENPAPER-LICENSE).

The browser **synthesizes the score live** on the game's existing AudioContext.
There are no recordings, decoded songs, external sample services, or music
worklets. The only PCM allocation is a small generated noise buffer shared by
the filtered drum voices. Oscillators, periodic waves, envelopes, filters and
ping-pong delay use native Web Audio nodes.

## Compile the score, not the audio

Prepare a separate Xenpaper checkout at the revision above:

```sh
git checkout 1d1d6850072114b12fd74765d7f9d1230630ff72
npm ci
npm run compile:sw-patch
npm run compile:xenpaper-lang
```

From Amortization, with its normal development dependencies installed:

```sh
node scripts/compile-music.mjs /path/to/xenpaper3
# Confirm checked-in data can be reproduced byte for byte:
node scripts/compile-music.mjs /path/to/xenpaper3 --check
```

No FFmpeg or browser is needed. This authoring step is outside build/CI; normal
contributors do not need a Xenpaper checkout. Vite's server-side loader runs
Xenpaper's actual `parseDawProject`, `createPlaybackPlan` and `createPatch`.
Neither parser is copied or reimplemented.

The score is compiled in beat coordinates, preserving CPS tuning, velocities,
lane gains, articulation and upstream glissando curves. SW Patch executes against
a recording AudioContext, producing compact native-node recipes with separate
onset and release automation. Its own timbre generator supplies the Golden Bell
and FM triangle coefficients. The default synth and drumkit recipes retain their
authored envelopes and filters; static delay settings are resolved during
compilation. Unsupported node types fail compilation.

`src/audio/score/negative-carry.json` is the generated result: one set of shared
notes, variation masks, deduplicated voice recipes and two periodic waves. It
includes hashes of the unchanged source projects. The parsers, editor, patch
interpreter and authoring dependencies do not ship to players.

## Adaptive playback

Both arrangements cover the same **224 beats**. The final 16 beats in the source
projects preview the opening again and are excluded from that form.

One look-ahead scheduler and one beat clock drive both arrangements. A variation
change commits on the next available four-beat bar, switching between the authored
180 and 200 BPM. Common held notes keep their oscillators; their remaining glides
and note ends follow the new tempo without pitch shifting. Only variation-specific
parts enter or release. The delay bus survives both transitions and loop boundaries.
There are no overlapping recordings to drift out of time or phase.

Sound on/off, volume, pause, focus loss, mission outcomes and accelerated replays
use the game's existing audio lifecycle. Pause retains the beat; resume re-enters
held melody notes. Restart begins a new score. Daytime and sunset missions are
silent. The small music module loads only during audible night play.

Unit checks cover transport continuity, missed-tick recovery, source hashes and
lifecycle races. Optional native browser checks exercise synthesis, transitions,
loop boundaries, headroom, mix balance and node cleanup. Human listening remains
the final check on musical balance.
