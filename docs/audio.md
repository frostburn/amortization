# Sound design

The palette is dry, mechanical and industrial. Weapon reports should tell the
player what is firing; electrical warning sounds should leave time to react.
Quiet work and movement need texture without making every click an announcement.

## Audible vocabulary

| Source | Character and information |
| --- | --- |
| Pistol | Short crack, compact body, slide and a tiny dry casing contact, without a pitched ring |
| Carbine | Brighter attack, heavier low report and bolt action |
| Shotgun | Broad low blast followed by a distinct pump cycle |
| Compact automatic | Tight, short clacks that remain separate at its actual fire rate |
| Coil rifle | Rising electrical charge, abrupt discharge and metallic tail; breaking the lock stops the charge |
| Wired turret | Accelerating acquisition chatter before its carbine report; losing the target stops it |
| Hits and casualties | Fabric/body impacts and falls differ from metal strikes and a sentry wreck |
| Reload | Magazine handling when reload begins, action closing when the gun is ready |
| Radio | A local squelch when a guard starts a working backup call; a separate short site alarm |
| Footsteps | Very quiet, muffled boot and sole scuff, driven by the same travelled distance as the walking cycle |
| Relay / feeds | Radio power-down versus a heavy breaker trip and electrical decay |
| Access / cargo | Latch and sliding mechanism versus handling a case; cloth and dressing sounds for KIT and treatment |
| Escort recruited | A clear, centred two-note indicator when Voss or another escort joins, with combat briefly lowered underneath |
| Demolition / outcomes | Pressure and debris for blasts; restrained completion or defeat cues |
| Flash grenade | Short filtered, clocked-noise crack and low pressure body; no sustained ringing |

The same weapon has the same identity on either side. Legacy operations use
the pistol report. Three deterministic variations avoid identical repetitions.
Short early reflections add body to shots without a long reverberant wash.
Footsteps favor the nearest two arrivals in a rendered frame; distant boots are
omitted. Their cue gain is one fifth of the first pass, with a softer source and
an additional two-pole 850 Hz low-pass baked into the whole clip. A moving squad
should leave room for threats and equipment sounds.

Site ambience is deferred. Night missions now have the music described below;
daytime and sunset missions have no continuous background sound.
Charges and sentry acquisition stop on pause, cancellation, mute, loss of focus and world
replacement; resuming follows their current simulation progress. Short effect
tails can finish after pausing, and orders issued while paused still give feedback.

## Mixing and controls

Sound starts off for a new player. The on/off choice and the adjacent master
volume slider are both remembered locally. When sound was enabled, reloading
restores that choice and the first click, tap or key press resumes audio; no
audio context is created on page load. Muting persists independently of volume.
Keyboard volume adjustments do not pan the map or change squad orders.

Each cue's recipe, duration, stable noise seed, fader, voice priority and bus live
together in `src/audio/palette.ts`; character keyboard recipes and cadence live
in `src/audio/typing.ts`, included by the palette. Shared DSP primitives live in `synthesis.ts`.
Looping, reflections, baked filtering and combat ducking are defined beside the
cue that uses them. Adding or reordering cues cannot retune existing noise seeds.
Faders apply before spatial/context gain and the group compressors, both
when a voice starts and when a warning loop moves or changes intensity. They are
fixed authored gains, with no per-clip loudness normalization.

| Role | Balance |
| --- | --- |
| Weapons | Compare sustained firing at each weapon's actual cadence, and four guns firing together. A dedicated combat compressor controls their combined level. |
| Footsteps | Keep the very quiet, low-passed source and cue gain from the preceding pass. |
| Hits | Ordinary impacts sit below gunfire; damage to an operative retains its louder context gain. Falls and sentry wrecks receive a small trim. |
| Reload and equipment | Bring reload/ready clicks up and doors, breakers and relay shutdown down, keeping pickups, clothing, healing and terminals in the same general range. |
| Threats | Reduce the coil's sustained charge and raise turret acquisition so both warnings carry similar weight. Preserve the coil's increasing intensity as it charges. |
| Radio and alarm | Radio onset remains above ordinary handling; the global alarm carries similar weight to a squad volley. |
| Objectives | Recruiting an escort uses a stronger, centred indicator rather than a local terminal effect. The combined squad volley and indicator have comparable short-window levels. |
| Outcomes and blast | Bring success and failure cues together. Explosions stay heavier than gunfire with a smaller volume jump. |

The balance pass compares all variations through the actual browser mixer at a
common position and volume: peak level, a 100 ms RMS window after a 100 Hz
high-pass, and energy over real firing sequences. These measurements expose
outliers, but are not a perceptual loudness standard or a substitute for listening.
The preview keeps these relative levels, including the pickup cue exactly
coinciding with four guns firing.

Stereo follows horizontal screen position after isometric projection, including
camera panning and split-team follow. Distance attenuation and high-frequency
loss use the camera's ground position, independently of zoom. Site alarms,
escort recruitment and outcome cues stay centred. This is a readable tactical
mix, not a wall-occlusion or room-acoustics simulation, and adds no new AI hearing rules.

The mixer limits active voices to 24 and favors threat/objective/outcome cues over
footsteps and impact tails. Gunfire, hits and explosions share a compressor and
group gain; feedback has its own compressor so loud combat cannot pull down an
objective cue. Recruitment, success and failure briefly lower combat by about
9 dB, holding through the recruitment indicator and then smoothly recovering.
Master volume follows both compressors, keeping their relative levels consistent
across the slider. A final soft ceiling protects the combined output.

Finished sources disconnect their entire voice graph. Sustained
sources have short releases and their parameter automation is replaced as they
move; stationary parameters do not accumulate per-frame automation.
Engines without `cancelAndHoldAtTime` retain the current parameter value before
replacing automation through the older Web Audio methods.

Noise starts from deterministic random control points clocked in Hz. Constant
interpolation gives the short report and contact layers a grainy edge; linear
interpolation softens bodies, scuffs, cloth and sliding mechanisms. A separate
low-rate interpolated noise source modulates the clock of selected layers, and
falling clocks let blast debris and weapon tails lose brightness. Each layer
then passes through a two-pole low-pass and a high-pass before its envelope.
The pistol casing is a brief filtered contact rather than a long pitch sweep.
The flash uses interpolated clocked noise and filters, with a −6 dB effect fader
on the combat bus. Its small local pulse has no full-screen or ringing effect.

PCM is synthesized in code and cached in the browser. Initial preparation is
spread across event-loop turns; a first-use cache miss can still create its clip
on demand. Effects need no downloads or external sample services. The separate
night-music recordings are served with the game and decoded once on first use.

## Replays and checks

Shot and interaction events carry positions and semantic details. A separate
audio director observes feet, reloads, charges and guard calls; it does not write
to gameplay state. The presentation queue remains excluded from replay checksums.
Normal-speed replay viewing retains its events until rendering. Accelerated
playback is silent and drains them; headless verification also drains the queue.

All 21 retained human runs still match the previous implementation at 1,178
sampled simulation states and at completion. The latest mission-08 run also
retains all 20 original checkpoints. Submitted bundles have not been rewritten.

Unit checks cover finite/headroom-safe PCM, noise interpolation and clock rates,
subdued and filtered footsteps, distinct reproducible weapon buffers,
spatial placement, actual escort recruitment, event metadata, transitions and
replay sound consumption.
On-demand Chromium checks render actual offline audio to test stereo, overlapping
volleys, recruitment during a four-gun volley, combat recovery, balance at low and
full master volume, and cancelled-loop silence. They also exercise live mute,
pause, accelerated playback and world changes. Desktop and touch checks cover the real Sound button,
volume gestures, keyboard adjustment, saved volume, no autoplay and clean consoles.
Routine CI retains eleven browser smoke cases; the existing story case checks
instant reveal without adding another real-time reading journey to the gate.

Further listening should tune the relative weight of impacts and movement during
busy combat, especially on phone speakers and headphones. Browser checks verify
signal and lifecycle behavior; the first pass still needs human listening across
devices. Distinct ground surfaces and site ambience can follow that
feedback.

Operation 12 adds a support-gun report: clocked, modulated noise with a damped
low body and short mechanical contact, authored at −2 dB on the capped combat
bus. It uses the same spatial filtering and feedback ducking as the other guns.
The new sound ID is appended so deterministic seeds for existing effects remain
stable. The native offline mix check includes a sustained four-gun support burst
against the objective cue at low and full master volume. Filing RECALL uses that
non-spatial objective cue; no ambience is added.

## Story keyboards

Dialogue uses short original PCM recipes as abstract character voices. Each
character keeps one voice across all scenes: the operatives use dry smartphone taps;
Voss and Quill use plastic QWERTY keys; the antagonists have heavier mechanical
strokes. Location does not change the voice, and scene/beat device overrides
are unnecessary.

| Character | Timbre and cadence |
| --- | --- |
| Morrow | Lower, muted contact, brief returns, compact bursts with short pauses |
| Vale | Brighter, quick taps in uneven groups, light haptic body |
| Rook | Lower and weightier contact, deliberate alternating strokes |
| Sable | Tight, soft contact with quick groups and longer punctuation rests |
| Iona Voss | Light, higher keys, quick uneven groups and a hollow plastic body |
| Ren Quill | Softer, dry keys at an even pace, with more deliberate punctuation |
| Severin Holt | Low, weighty platen impact and longer return, measured cadence and the longest pauses |
| Ada Kestrel | Tighter, higher metal linkage, quick precise groups and a short return |
| Lucan Dacre | Low mechanical body, firmer snap and paired rhythmic accents |

The phone recipe combines filtered, clocked contact noise with a very short
haptic body. Plastic keys have separate bottom-out and quieter return contacts.
Typewriters add a damped mechanism/platen body and a brief metal resonance.
Constant and linear noise interpolation, layered envelopes and low-pass filters
shape the transients; there is no full-band noise wash, carriage bell or ambience.
Each key has three cached variations. Profiles change body, tuning, attack,
return timing, reading cadence and punctuation rests rather than merely shifting
one shared sample up or down.

Typing faders are raised by 3 dB from the initial mix for clearer taps.
Balance is checked at repeated typing cadence. Mechanical strokes have a lower
effect fader to compensate for their longer, heavier body. They remain below
the confirmation cue over a short reading window. Keys use the existing centred
feedback path and saved master volume. They require the existing gesture unlock,
and muted scenes do not allocate silent sources. PCM is created only on first
use; optional story keys are excluded from the game's background audio warmup.

Reveal respects grapheme boundaries. Spaces and punctuation are silent, with
pauses after clauses and sentences. At most one key plays per visual update,
with a minimum interval per character; delayed frames cannot discharge a queue
of sounds. Clicking/tapping the dialogue or image reveals the current line and
cancels its audio without skipping ahead. Previous, restart, close, mute, focus
loss and hidden tabs also cancel pending keys. Focus return resumes from the
same place. Reduced-motion mode gives an instant, silent reveal, and screen
readers receive the complete line once.

Unit checks cover graphemes, cadence, bounded PCM, variation and relative key
energy. Desktop/touch browser checks exercise the real audio context and sources,
instant reveal without page advance, mute, restart, focus interruption, keyboard
navigation, close and reduced motion. No simulation state or replay identity is
changed by these presentation sounds.

## Night music

**Negative Carry** (180 BPM) and the supplied **Negative Carry (combat variation)**
(200 BPM), by Lumi Pakkanen, are rendered through Xenpaper's actual playback engine.
The CPS tuning, Golden Bell, FM triangle bass, drum patch, glide automation and
ping-pong bus are preserved. The source projects and reproducible render procedure
are in [`music/`](../music/README.md). The game's production bundle contains only
the small player, not Xenpaper's compiler, synthesizer or Vue application.

Music follows the visual night theme (operations 01–10). It does not also play
in sunset missions just because those missions have night-length sight ranges.
Actual shots or living enemies pursuing a living friendly select combat; an
alarm flag or an investigation without a target does not. Ten simulation seconds
without that pressure returns to calm, so short gaps between shots do not keep
switching the arrangement. This director observes state without changing the
simulation, replay hashes or gameplay clocks.

Both recordings cover the same 224-beat form. The player transitions at the next
bar into the same beat of the other recording, crossfading for 350 ms. Each plays
at its original BPM and pitch. The last 16 beats in each source project preview
the opening again; they are not an extra verse. Rendering two cycles and taking
the second carries the delay tail across the loop. Each encoded file includes
100 ms of wrapped audio before and after the playable form, keeping MP3 edge
transients outside the explicit loop points. Native decoding handles encoder
delay/padding; the player skips the authored guard regions.

Downloads begin only during an audible running night mission. Each arrangement
is fetched/decoded once, outside the initial loading gate. A failed download
leaves effects usable and is retried on sound enable or a new attempt, not each
frame. A download finishing after pause, mute or a mission change cannot start
an old track. Files use Vite's fingerprinted asset URLs and relative base support.

Music has a quiet, centred bus feeding the existing master volume and output
ceiling. Recruitment and outcome cues briefly duck it along with combat effects.
The saved Sound preference and volume govern both music and effects. Pausing,
briefings, optional scenes, hidden tabs, focus loss, zero volume and accelerated
replays stop music sources and retain musical position. Resuming uses that
position; restart/mission replacement begins a fresh score. Success and failure
end the mission score so their existing cues and aftermath have room.

Unit tests cover pressure/release, unchanged replay state, lazy loading,
late-download cancellation, native-tempo bar transitions, interrupted crossfades,
pause/resume and retry limits. On-demand browser checks use actual decoded music
and native audio nodes for loop length, signal/headroom, lifecycle and mix balance.
These checks do not add another routine CI browser journey or render music in CI.
