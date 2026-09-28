# Sound design

The palette is dry, mechanical and industrial. Weapon reports should tell the
player what is firing; electrical warning sounds should leave time to react.
Quiet work and movement need texture without making every click an announcement.

## Audible vocabulary

| Source | Character and information |
| --- | --- |
| Pistol | Short crack, compact body, slide and small casing tick |
| Carbine | Brighter attack, heavier low report and bolt action |
| Shotgun | Broad low blast followed by a distinct pump cycle |
| Compact automatic | Tight, short clacks that remain separate at its actual fire rate |
| Coil rifle | Rising electrical charge, abrupt discharge and metallic tail; breaking the lock stops the charge |
| Wired turret | Accelerating acquisition chatter before its carbine report; losing the target stops it |
| Hits and casualties | Fabric/body impacts and falls differ from metal strikes and a sentry wreck |
| Reload | Magazine handling when reload begins, action closing when the gun is ready |
| Radio | A local squelch when a guard starts a working backup call; a separate short site alarm |
| Footsteps | Concrete boot and sole scuff, driven by the same travelled distance as the walking cycle |
| Relay / feeds | Radio power-down versus a heavy breaker trip and electrical decay |
| Access / cargo | Latch and sliding mechanism versus handling a case; cloth and dressing sounds for KIT and treatment |
| Demolition / outcomes | Pressure and debris for blasts; restrained completion or defeat cues |

The same weapon has the same identity on either side. Legacy operations use
the pistol report. Three deterministic variations avoid identical repetitions.
Short early reflections add body to shots without a long reverberant wash.
Footsteps favor the nearest two arrivals in a rendered frame; distant boots are
omitted so a moving formation does not drown out threats.

A low machinery bed fills the quiet gaps and drops during combat. It carries no
mission information. It stops while planning or viewing a dialog. Charges and
sentry acquisition also stop on pause, cancellation, mute, loss of focus and world
replacement; resuming follows their current simulation progress. Short effect
tails can finish after pausing, and orders issued while paused still give feedback.

## Mixing and controls

Sound begins only when the player presses **Sound off** to enable it. The adjacent
volume slider adjusts the master mix and remembers its value locally. Reloading
the page starts muted even when a volume preference exists. Keyboard volume
adjustments do not pan the map or change squad orders.

Stereo follows horizontal screen position after isometric projection, including
camera panning and split-team follow. Distance attenuation and high-frequency
loss use the camera's ground position, independently of zoom. Site alarms and
outcome cues stay centred. This is a readable tactical mix, not a wall-occlusion
or room-acoustics simulation, and adds no new AI hearing rules.

The mixer limits active voices to 24 and favors threat/outcome cues over footsteps
and impact tails. A compressor and final soft ceiling keep simultaneous volleys
under control. Finished sources disconnect their entire voice graph. Sustained
sources have short releases and their parameter automation is replaced as they
move; a stationary ambience loop does not accumulate per-frame automation.

PCM is synthesized in code and cached in the browser. Initial preparation is
spread across event-loop turns; a first-use cache miss can still create its clip
on demand. The low-frequency ambience uses a smaller 12 kHz buffer. No audio
downloads, sample licences, extra dependencies or music-stream requests are needed.

## Replays and checks

Shot and interaction events carry positions and semantic details. A separate
audio director observes feet, reloads, charges and guard calls; it does not write
to gameplay state. The presentation queue remains excluded from replay checksums.
Normal-speed replay viewing retains its events until rendering. Accelerated
playback is silent and drains them; headless verification also drains the queue.

All 21 retained human runs still match the previous implementation at 1,178
sampled simulation states and at completion. The latest mission-08 run also
retains all 20 original checkpoints. Submitted bundles have not been rewritten.

Unit checks cover finite/headroom-safe PCM, distinct reproducible weapon buffers,
spatial placement, event metadata, transitions and replay sound consumption.
On-demand Chromium checks render actual offline audio to test stereo, overlapping
volleys and cancelled-loop silence, and exercise live mute, pause, accelerated
playback and world changes. Desktop and touch checks cover the real Sound button,
volume gestures, keyboard adjustment, saved volume, no autoplay and clean consoles.
Routine CI retains its existing ten browser smoke cases.

Further listening should tune the relative weight of impacts and movement during
busy combat, especially on phone speakers and headphones. Browser checks verify
signal and lifecycle behavior; the first pass still needs human listening across
devices. Distinct ground surfaces and more varied site ambience can follow that
feedback.
