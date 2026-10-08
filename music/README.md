# Night mission music

**Negative Carry** and **Negative Carry (combat variation)** — Lumi Pakkanen.

- `negative-carry.xenpaper.json` is the original demo project from
  [Xenpaper 3](https://github.com/frostburn/xenpaper3/blob/1d1d6850072114b12fd74765d7f9d1230630ff72/src/demo-projects/negative-carry.xenpaper.json).
- `negative-carry-combat.xenpaper.json` is the unchanged attachment supplied on
  October 8, 2026 (`Negative-Carry-combat-variation.xenpaper (1).json`).
- Renderer: Xenpaper `1d1d6850072114b12fd74765d7f9d1230630ff72` (3.0.0-beta.18),
  using `parseDawProject` and `renderProjectToWavBlob` in Chromium. Xenpaper is
  [MIT licensed](https://github.com/frostburn/xenpaper3/blob/1d1d6850072114b12fd74765d7f9d1230630ff72/LICENSE).

The game uses local stereo MP3s under `src/audio/tracks/`. The original plays at
180 BPM, the combat variation at 200 BPM. Both loop over 224 beats, returning
where the source's `# Loops from here` marker previews the opening. Their native
pitch, envelopes, lane gains, glissandi and ping-pong delay are preserved.

The authoring script repeats the form in the same audio graph and keeps the
second cycle, including tails from the preceding cycle. The MP3 includes 100 ms
of wrapped audio on either side of the loop, keeping encoder edge transients
outside the playable region. `loop.json` shares that padding, the beat count and
tempos with the player. It renders stereo at
48 kHz with Xenpaper's normal output gain, then encodes at 160 kbit/s with LAME.
There is no per-track normalization. The game adds its background-music gain and
brief ducking for important mission cues. Native drums contain noise, so fresh
renders can differ in bytes while using the same score and sound design.

## Rebuild the recordings

Prepare a separate Xenpaper checkout at the pinned revision above:

```sh
npm ci
npm run compile:sw-patch
npm run compile:xenpaper-lang
```

Then, from Amortization, with its normal development dependencies installed:

```sh
npx playwright install chromium
node scripts/render-music.mjs /path/to/xenpaper3
# Optional: render only one arrangement
node scripts/render-music.mjs /path/to/xenpaper3 combat
```

FFmpeg with `libmp3lame` must be on PATH. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` can
select an existing Chromium installation. Rendering may take several minutes;
it is an authoring step, never part of `npm run build` or CI. No Xenpaper runtime
code or dependency is copied into the game. Browser validation uses the encoded
files, including native decoder delay/padding handling and loop lengths.
