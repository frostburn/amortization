# Player completion recordings

Selected successful `.replay.json` bundles go here after playtesting. Vitest runs
them under **current rules** and requires a win within the recorded duration.
When mission and simulation fingerprints match, every original state checkpoint
is also verified. Otherwise this checks a route's continued viability, without
claiming that an older simulation's state checksums still match. Never rewrite a player's commands,
checkpoints, note, or build metadata to make a recording pass.

All fifty-three retained completions are byte-for-byte copies of submissions
provided in chat, including their `unversioned` / local-changes metadata.

## Character refresh: Ren Quill and guard diversity

Quill's name, pronouns and mission text changed on October 1; guard skin tones
and female specialist profiles are rendering-only. All 53 retained completions
still succeed under current rules. The recordings remain untouched, so their
original comments and archived mission definitions still use Mara.

The strict medal and settlement regressions bypass the renamed mission-copy
metadata in memory, as they already bypass the source-build label, while
continuing to compare every original checkpoint and final result. Custody's
escort display name is part of its state checksum; its older recordings use
**Try current rules** and continue to verify their rescue routes.

## The Bench: revised patrols and tower lighting

All four follow-up October 1 submissions reproduce their recorded outcomes and
all **63 original checkpoints** against `3d78143`, simulation fingerprint
`9e5e319f4f6b83716efd716a14c784fbcc95610b4c7a5568377d1ee9c89bc5e0`.
The fluorescent penthouse and distant-city changes touch rendering only, so
those checkpoints still match exactly. All four notes are empty; in chat the
player found the challenge appropriate and requested these visual corrections.

| Suffix     | Exact outcome                                                                  | Checkpoints |
| ---------- | ------------------------------------------------------------------------------ | ----------- |
| `8c23e0ec` | Won, tick 4064 / 135.47s; 4 survivors; 71 shots; no alarm; MINUTES left behind | 29          |
| `d1daad2b` | Lost, tick 1333 / 44.43s; 94 shots; no alarm                                   | 10          |
| `5b60d168` | Lost, tick 1704 / 56.80s; 38 shots; no alarm                                   | 13          |
| `3032234a` | Lost, tick 1430 / 47.67s; 74 shots; alarm                                      | 11          |

The win joins the required corpus as `bench-human-8c23e0ec.replay.json`.
RADIO goes offline at 15.77s, CUT opens the Bench at 49.57s and Holt is
eliminated at 53.03s. The team reaches the roof, returns downstairs to defeat
Dacre at 112.97s, then boards HELI together. The optional MINUTES remain
available. This verifies a human lethal completion under the revised patrols;
the command-driven custody route remains covered by the mission tests.

The three losses are preserved as `../fixtures/bench-lost-<suffix>.replay.json`
for diagnosis, not as requirements to keep losing. Every bundle is an unchanged
copy of the submission, and no combat, patrol, sight-range or objective rules
change in this visual follow-up. Shot counts include both sides.

## The Bench: first finale playtest

The three October 1 submissions are retained byte-for-byte in
`../fixtures/bench-prepatrol-<status>-<suffix>.replay.json`. Their recorded build
is `unversioned`, simulation fingerprint
`39144c5f8e6f0bbf361ac027758872faaa1534296f597ec4799ae98e38908751`.
Before the patrol changes, all three reproduced their recorded outcomes on
PR #35's initial implementation (`15d51a1`). This was an outcome comparison;
no claim is made here about original checkpoint compatibility.

| Suffix     | Original outcome                                                               | Under revised patrols                |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| `7fbc7d08` | Won at tick 3490 / 116.33s, 4 survivors, 69 shots, no alarm, MINUTES extracted | Lost at tick 2535 / 84.5s, 81 shots  |
| `022e93e8` | Lost at tick 2364 / 78.8s, 52 shots, no alarm                                  | Lost at tick 2239 / 74.63s, 34 shots |
| `622a99cd` | Lost at tick 520 / 17.33s, 65 shots, alarm                                     | Lost at tick 490 / 16.33s, 26 shots  |

The winning note is “Needs more patrolling. Now the guards just stand there.”
The other notes are empty. In that win, Morrow disables RADIO before the squad
advances from the south. One flash, concentrated fire and dressings settle the
main fight; Dacre signals once, and falls at 37.1s. Four defenders never move at
all, and the southern rooftop sentry never contests extraction. The team uses
both seals, cuffs Holt, collects MINUTES and leaves together. The two losses
show that a direct rush and unsupported solo fighting already carry risk;
adding health or damage was not the appropriate response.

All nine defenders now patrol, including an inspector circuit past RADIO and
roof routes across the helipad approach. Dacre can coordinate from a locally
relayed sighting, and a screen gives his detail additional cover. The unchanged
winning script no longer completes and is **not** a required completion or a
human success under the new balance. The two loss timings are diagnostic only,
not balance requirements. No submitted commands, notes or metadata were edited.
Guarded synthetic custody and lethal routes were updated to respond to the
patrols, clear the roof and extract all four plus MINUTES, with exact command and
checkpoint replay. The fifty-two earlier human completions remain required.
The follow-up batch above supplies the fresh human completion under these patrols.

## Threshold: timed work and key recovery

All five September 30 submissions verify their 98 original checkpoints and final
outcomes against PR #34's `646fdee` and the unchanged simulation fingerprint
`25559847972c9b43914b2b1a243e9f903bb6329ddc566e39a871e3e0edb36630`.
The timer-bar follow-up changes presentation only; no commands, checksums, notes
or build metadata are rewritten. The successful bundle joins the corpus as
`threshold-key-recovery-db4918dd.replay.json`. The other four are retained in
`../fixtures/threshold-<status>-<suffix>.replay.json`; preserving their losses is
not a future balance requirement.

| Submission suffix | Exact outcome                                              | Checkpoints |
| ----------------- | ---------------------------------------------------------- | ----------- |
| `55e2fb28`        | Lost, tick 2642 / 88.07s; 62 shots; alarm                  | 19          |
| `ebbe91e0`        | Lost, tick 2684 / 89.47s; 55 shots; alarm                  | 19          |
| `51fe9ea6`        | Playing, tick 1559 / 51.97s; Morrow alone; 23 shots; alarm | 12          |
| `6dac685d`        | Lost, tick 2412 / 80.4s; 64 shots; alarm                   | 18          |
| `db4918dd`        | Won, tick 4222 / 140.73s; 3 survivors; 41 shots; alarm     | 30          |

Only `51fe9ea6` has an embedded note: “Lol, soft-locked”. Vale leaves SHUNT at
41.07s and falls at 45.20s, leaving Morrow inside dispatch with RADIO disabled.
The existing inside CUT escape is available with free hands. A command-only
continuation of the unchanged end state cuts the lock at 61.97s and reaches
(21.5, 20.5) outside at 66.97s with 100 HP. A regression retains this escape;
the new CUT bar shows that its eight-second work is progressing.

In the win, CUT opens at 25.93s, the first patrol arrives at 31.93s and RADIO is
disabled at 40.4s, preventing the second dispatch. Rook collects KEY at 65.50s
and completes LINK at 91.33s. Rook falls at 106.0s while the car is still arriving;
the key drops, the car finishes its eighteen-second arrival, and Vale recovers KEY at 122.23s without
having to repeat LINK. All three survivors board at 140.73s. Only **Settled** is
earned: the full-crew medal conditions are not met. Shot totals include both
sides. The batch supports retaining the current challenge and improving the
visibility of deadlines and work, rather than changing mission rules.

## Continuity: Kestrel removal

All eight September 30 submissions verify every original checkpoint and outcome
against PR #33's `e650522`, mission hash `47f6dc46` and simulation fingerprint
`c7a2922970d98e60158b9800aa82ac7f8ee2c698bd43ddccabf06ee58505516b`.
Every embedded note is empty. In chat the player reported feeling challenged and
that everything seemed to work as intended. No balance changes follow from this
batch.

The two wins join the completion corpus unchanged as
`continuity-lethal-69fbeb4a.replay.json` and
`continuity-arrest-9c278b66.replay.json`. The other six remain byte-for-byte
diagnostic evidence in `../fixtures/continuity-<status>-<suffix>.replay.json`,
outside the required completion corpus. Their losses are observed outcomes,
not constraints that future versions must preserve.

| Submission suffix | Exact outcome | Mission flow |
| --- | --- | --- |
| `6b2b9a4b` | Lost, tick 1866 / 62.2s; 122 shots; alarm | Ground-floor assault loses Vale and Sable; EAST is isolated before the remaining pair falls |
| `5d616d7c` | Lost, tick 649 / 21.6s; 64 shots; alarm | Immediate stair assault reaches the upper floor with both feeds live; the crew falls in the west gallery |
| `88c716db` | Lost, tick 1572 / 52.4s; 89 shots; alarm | WEST is isolated, Morrow falls downstairs, and the remaining three lose the upper-floor fight |
| `69fbeb4a` | Won, tick 2808 / 93.6s; 3 survivors; 83 shots; alarm | Armed recovery after Morrow dies upstairs; Kestrel eliminated and survivors return via DOWN |
| `77baa5be` | Lost, tick 1737 / 57.9s; 48 shots; alarm | WEST is isolated after the alarm; the ground-floor fight defeats the crew |
| `bcc8b7c9` | Playing, tick 1638 / 54.6s; 3 survivors; 6 shots; alarm | Morrow dies carrying REGISTER upstairs; it drops on that floor and the other three remain alive downstairs |
| `c8937f8c` | Lost, tick 2724 / 90.8s; 52 shots; alarm | Inspection, an upstairs scouting visit and both feed isolations; the crew falls before reaching Kestrel |
| `9c278b66` | Won, tick 4890 / 163.0s; 3 survivors; 50 shots; no alarm | RADIO preparation, both feeds isolated, Kestrel arrested and dropped REGISTER recovered; both reach extraction |

Shot totals include both sides. In the lethal win, Morrow falls at 33.03s before
the other three go upstairs. Kestrel dies at 73.90s with neither feed isolated;
her remaining turrets stop, and the crew descends and extracts. RADIO stays live.
The shield officer and several other defenders survive, so clearing the entire
site is not a prerequisite for removal or escape.

In the arrest win, Morrow disables RADIO at 44.37s, collects REGISTER at 63.47s
and falls upstairs at 69.37s. The remaining crew isolates WEST at 85.07s and
EAST at 105.00s. Rook cuffs Kestrel at 131.10s; the crew retrieves the dropped
REGISTER and uses DOWN. Kestrel follows Rook down at 150.73s, reaching extraction
with 90 HP. The dead upstairs operative correctly does not block survivor
extraction, while Kestrel and the evidence still have to reach VAN.

Both wins earn only Settled: losing Morrow prevents the full-crew challenge
medals, including Answerable despite a successful arrest. This batch establishes
human completion of both outcomes, not a full-crew or wholly nonlethal human
route. The existing guarded command runs retain that coverage. No checkpoint
divergence, premature mission ending or unrecoverable upstairs cargo is evident.

Separate automated review found two input/copy defects: Regroup and orders onto a
teammate omitted the target's floor, and the extraction notice claimed REGISTER
was secured even when left behind. The follow-up preserves floor identity and
the active lead, and reports Kestrel and the optional cargo accurately. Desktop
and touch checks cover the corrected movement orders. The notice edit changes
the simulation source fingerprint, but bypassing only that gate still verifies
all 131 original checkpoints and every final outcome. Bundles retain their
original fingerprints; use **Try current rules** in the updated build.

## Margin call: all medals

All four September 30 submissions verify every original checkpoint and outcome
against merged maintenance commit `0051af8`, mission hash `b47ff7f7` and simulation
fingerprint `af5dc6a042af8324f23af872ef869d16e80599dc050e01fdcecfd99b655f1009`.
Their notes are empty. The two wins join the completion corpus unchanged;
`tests/medals.test.ts` verifies that they collectively earn all seven medals.

| Submission | Exact outcome | Medals |
| --- | --- | --- |
| `amortization-clearing-won-ddbce34b.replay.json` → `clearing-human-ddbce34b.replay.json` | Won, tick 3559 / 118.6s; 4 survivors; 0 shots | Settled, Full crew, Low profile, Nonlethal, Light touch |
| `amortization-clearing-won-985e3e2b.replay.json` → `clearing-human-985e3e2b.replay.json` | Won, tick 3647 / 121.6s; 4 survivors; 17 shots | Settled, Full crew, No disguise, Open channel |
| `amortization-clearing-playing-823595ff.replay.json` | Playing, tick 1046 / 34.9s; 3 survivors; 72 shots | None; KEYS still available |
| `amortization-clearing-playing-3b61f676.replay.json` | Playing, tick 1503 / 50.1s; 2 survivors; 58 shots | None; KEYS still available |

Shot totals include both sides. The unfinished snapshots are diagnostic context,
not recorded defeats or additions to the required completion corpus.

In the quiet win, Morrow takes KIT while Vale holds SHUNT from 11.7s until 44.9s.
Morrow collects KEYS at 27.2s, clears the shutter and opens GATE at 35.8s. He waits
behind the east wall while the other three explore the south perimeter, double
back and take the outside north road to VAN. The carrier then crosses through
GATE to join them. RADIO remains active, all seven guards live, no shots are
fired and nobody takes damage. This validates the human split-team SHUNT route
and full-crew quiet extraction previously missing from the retained recordings.

The alarm win bypasses the freight lanes through the north maintenance approach,
killing only the west entrance guard and the patrol near the vault. Vale and
Rook use their field dressings at 30.7s and 31.0s, restoring all four to full
health. The alarm starts at 26.0s and Sable finishes CUT at 34.1s. The squad waits
behind the vault racks while the first response investigates the shutter, finds
no target and resumes patrol; Sable takes KEYS at 53.5s. Both response waves arrive,
but the squad withdraws west and goes around the outside north wall to VAN.
Neither marksman nor any reinforcement fires; the last shot is at 24.1s. RADIO
stays active and eleven guards survive. Full health at extraction therefore
does not mean this was a damage-free run.

The two unfinished assaults show the cost of meeting the response directly:
`823595ff` loses Morrow at 27.1s by the east gate, while `3b61f676` loses Rook at
42.2s and Morrow at 43.8s inside the vault. Both leave RADIO active. These are
ordinary combat casualties, with no checkpoint divergence or broken extraction
requirement evident in this batch.

The low-risk perimeter withdrawal is the main cheese: it avoids the east-road
crossing and response patrols by spending time on a long walk. Waiting out the
shutter investigation also avoids combat without requiring a disguise. The
recorded wins take roughly two minutes, including waiting and exploratory moves;
they do not establish the fastest possible bypass. Leave the routes and balance
unchanged for now. If the detour becomes dominant, revisit perimeter exposure or
the response's search around a breached vault, while preserving legitimate
retreats and enemies' need for sight. These wins do not establish that marksmen
require flanking or that all medal routes offer comparable challenge.

## Data organization maintenance

Extracting the shared crew roster changes the simulation's source fingerprint,
without changing its behavior. A before/after comparison against the merged
Countermand code matches 3,916 sampled current-rule state hashes and final
outcomes across all 55 stored bundles (47 completions and eight diagnostics).
All twelve mission definitions are identical. No replay data or expectations
were rewritten; older fingerprints use **Try current rules** as usual.

## Countermand: human completion after the shield fix

All six follow-up submissions verify every original checkpoint and outcome
against the pre-maintenance code. They share mission hash `6f0d06c3` and simulation
fingerprint `50127b9bf7925df6b6e3fb68237a459841e00b5628304cc878f412d983924081`.
The successful submission `amortization-countermand-won-e6184c0a.replay.json`
joins the completion corpus as `countermand-human-e6184c0a.replay.json`, unchanged.
Its note reads: “Challenge level felt good.” The other five notes are empty.

| Submission suffix | Exact outcome | Mission flow |
| --- | --- | --- |
| `e6184c0a` | Won, tick 4731 / 157.7s; four survivors; 80 shots; no alarm | Disguised RADIO preparation, coordinated assault, RECALL filed and extracted |
| `c045edc0` | Snapshot, tick 881; three survivors; six shots; alarm | Inspector exposes Morrow before RADIO; he falls in records |
| `5c80e947` | Snapshot, tick 944; three survivors; 13 shots; alarm | Distant hit makes the first shield respond and report; Rook falls before his flash helps defeat it |
| `ccfd4772` | Lost, tick 2354; 58 shots; no alarm | RADIO disabled, but the shield/support/breacher defense defeats the loading-lane assault |
| `ac5fa0f2` | Snapshot, tick 921; three survivors; five shots; alarm | Inspector exposes Morrow before RADIO; he falls in records |
| `c10080a9` | Lost, tick 2913; 120 shots; alarm | Recovers RECALL with RADIO live, loses Sable in records, then falls to the dispatch defense before filing |

In the win, Morrow disables RADIO at 30.03s and returns to the north side of the
loading defense. Sable's 12.43-unit coil hit at 45.9s makes the shield officer
retreat; Morrow's pistol then lands unprotected flank shots. The second officer
blocks frontal fire until Sable's flash at 82.33s lowers its protection. Both
flashes and two field dressings are used. Support pressure reaches both sides;
these traces verify the mechanic, not how clearly its presentation reads.

Vale collects RECALL at 116.9s, files it from 134.07s to 143.07s, and boards at
157.7s after one all-crew VAN order. Filing and the original-cargo requirement
both hold. Final health is Morrow 16, Vale 78, Rook 22 and Sable 56. The resulting
medals are Settled, Full crew and Low profile; the north staff patrol survives.

The five unsuccessful/unfinished submissions are diagnostic evidence, not
required losses or completions. The snapshots correctly remain playable with
three survivors. This batch supports leaving the current balance unchanged;
it adds no simulation, mission, browser-test or CI-workflow changes.

## Countermand long-range shield feedback

The four September 30 submissions use mission hash `e06783a4` and simulation
fingerprint `37853990a3695a11e0c38bbf065fc800e0c9d40b9b97555590fe336fc073b6db`.
Every original checkpoint and outcome reproduces against the pre-fix PR code
when only its changed source-fingerprint gate is bypassed. Original commands,
checksums, notes and unversioned/dirty metadata remain untouched.

They are stored as `../fixtures/countermand-range-<suffix>.replay.json`, outside
the required completion corpus. The winning run depends on an exploit, and
the three losses are evidence to investigate rather than required failures.

| Suffix | Original outcome | Outcome under corrected rules |
| --- | --- | --- |
| `7458f5ab` | Win, tick 5249, four survivors, 74 shots, no alarm | Loss at tick 2045; the opening no longer removes an inert shield officer |
| `669aab97` | Loss, tick 2889, 105 shots, no alarm | Loss at tick 2378 |
| `a2c4c905` | Loss, tick 2944, 113 shots, alarm | Loss at tick 2211 |
| `a4df968b` | Loss, tick 2515, 59 shots, no alarm | Still playing at recorded end; Rook survives with 9 HP |

The note in `a2c4c905` reads: “Enemies should take cover when receiving fire they
cannot see the source of.” The other three notes are empty. In three runs Sable
stands roughly 12.4 units from the first officer and lands fifteen coil shots.
The officer never leaves patrol mode, takes no step, and dies. The rifle reaches
13 units, beyond the 12-unit hearing radius and 11.25-unit daylight pistol sight.

Direct hits now bridge that gap: the victim takes local cover and can report the
attack without knowing the shooter’s identity. Shields retain their protective
facing during the retreat, with the existing turn limit. All four unchanged
command sequences now make the first officer move and break the original firing
line. Regression assertions focus on that response, not reproducing the obsolete
final results in the table. Quiet and revised armed command-only routes still
extract all four; the 46 older human completion fixtures also remain valid.

## September 29: hidden enemies, objective zoom and human medals

All twelve new submissions reproduced every original checkpoint against the
merged implementation before this pass. Eleven wins join the completion corpus
unchanged. The ten Mission 05–06 wins still reproduce every checkpoint after the
coil pursuit fix; `tests/medals.test.ts` verifies their combined medal coverage.

| Fixture suffix | Mission | Original outcome | Medal route |
| --- | --- | --- | --- |
| `broadcast-human-42048895` | 05 | Won, tick 1928, 4 survivors, 0 shots | Quiet, nonlethal, untraced |
| `broadcast-human-740307a2` | 05 | Won, tick 2242, 4 survivors, 17 shots | Live alarm, untraced |
| `broadcast-human-f8b2c49a` | 05 | Won, tick 1729, 4 survivors, 44 shots | Quiet, no disguise, optional LOG |
| `broadcast-human-ec959f54` | 05 | Won, tick 2807, 3 survivors, 15 shots | Completion only |
| `severance-human-e3aa7439` | 06 | Won, tick 2982, 4 survivors, 0 shots | Quiet, nonlethal |
| `severance-human-e73b41fe` | 06 | Won, tick 1937, 4 survivors, 39 shots | Quiet, no disguise, optional REGISTER |
| `severance-human-2f9a7242` | 06 | Won, tick 2341, 4 survivors, 0 shots | Quiet; blast casualties prevent Nonlethal |
| `severance-human-37611591` | 06 | Won, tick 2156, 4 survivors, 6 shots | Live alarm |
| `severance-human-e366104a` | 06 | Won, tick 2672, 4 survivors, 5 shots | Live alarm |
| `severance-human-bdbb0b9a` | 06 | Won, tick 1913, 3 survivors, 9 shots | Completion only |
| `settlement-human-16e9dc9e` | 11 | Won, tick 5019, 2 survivors, 73 shots | Completion only |

Every fixture has the `.replay.json` extension and comes from the submission
`amortization-<mission>-won-<suffix>.replay.json`. Mission hashes are `dde31aa3`
(broadcast), `d9f55e6a` (severance) and `52cac497` (settlement). The first two
missions use simulation fingerprint `a7a78c49ae47f6d96b53c4cc6d90c9f0caae6b53339e209a119b5520e95a18e3`;
settlement uses `e4cf63e96bc0cafdd0720993ddf52eac52be3973d85f3238da2e3531f07c50ed`.
All retain their original unversioned/dirty metadata. Together the full-crew
runs earn all eight broadcast medals and all seven severance medals. Losing an
operative correctly leaves only the completion medal, even with evidence aboard.

The unretained loss `amortization-broadcast-lost-ff9ebd8f.replay.json` has no
feedback note. It still reproduces exactly: all four fall at tick 3231, with 33
shots, alarm active and LOG carried. It is diagnostic evidence, not a required
loss or an invalid completion.

Two feedback notes prompted fixes:

- `e3aa7439`: “Zooming to a clicked objective is super annoying.” Locate now pans
  at the existing scale. Browser checks cover single and spread-out goals at
  several zoom levels on desktop and touch; the recording has no camera inputs.
- `16e9dc9e`: “Sable's stutter aim was hilarious but likely not what we want here.”
  A moving target repeatedly crossed the attack order's stop threshold. Sable
  took one corrective step and cancelled her coil charge, then restarted it.
  The order now holds a valid charge until the target actually leaves range or
  sight. A regression requires one uninterrupted charge against a retreating
  patrol that remains within rifle range.

The Mission 11 commands still win at tick 5019 under the corrected combat timing:
Rook and Sable extract REGISTER, with 49 and 87 HP and 78 shots in total. The
original run had 66 and 100 HP and 73 shots, so it is current-rule completion
coverage, not an exact checkpoint match. REGISTER survives Vale's death; Rook
recovers it and works CLEAR while Sable holds SIGN. Reconciliation remains intact
through the handoff, and both stations are required for the release. The older
Mission 07 route `8de9cdd6` now loses and is retired below.

Foreground walls and roofs reveal hollow faction-coloured character outlines.
Following the clipping feedback, only the covered portions remain outlined.
Each current pose is contoured first, then masked by its foreground scenery;
exposed body parts and the wall's top edge gain no artificial contour. This does
not change sight or combat rules. Desktop/touch pixel checks cover partial and
toe-only obstruction, doors, targeting, night lighting, camera scale, turrets and
reset. The earlier 2,400-frame CPU comparison measured the initial whole-character
effect, before clipping; it is not a performance claim for the revised pass.
The human bundles contain no frame telemetry.

## Value date: recovery and performance

Both September 29 submissions have empty feedback notes and contain no flash
commands. They use mission hash `52cac497` and simulation fingerprint
`d1e7b628e56516b3ff609844920129f029bcfc077eb3e0c145dd00202e6d43be`.
Their original checkpoints reproduce exactly before and after the ray-query
optimization. The dedicated tests skip only the changed source-fingerprint
gate, retaining every original state and final-result comparison.

| Fixture | Original submission | Exact outcome |
| --- | --- | --- |
| `settlement-recovery-1b29d03c.replay.json` | `amortization-settlement-won-1b29d03c.replay.json` | Tick 9811 / 327.03s; 3 survivors; 41 shots; no alarm |
| `../fixtures/settlement-insufficient-crew-1d635f76.replay.json` | `amortization-settlement-lost-1d635f76.replay.json` | Tick 2891 / 96.37s; 1 survivor; 43 shots; no alarm |

The winning run holds SHUNT with Vale, disables RADIO and retrieves REGISTER
with Morrow. Reconciliation completes at 108.43s. Morrow sets down the register
immediately before falling at 172.47s; Vale recovers it at 198.8s and retains the
completed reconciliation. After separate arrivals at SIGN and CLEAR, Sable and
Vale finish the paired release at 265.23s. All three survivors and REGISTER
extract. This validates casualty recovery and the two-person work requirement.

The loss also disables RADIO but loses Morrow shortly after retrieval. The
register drops correctly; Rook and then Sable fall before it is recovered.
Only Vale remains, so the mission correctly fails with an explicit explanation
that SIGN and CLEAR need two people. It is kept as a diagnostic fixture outside
the required completion corpus; its exact outcome guards this behavior-preserving
optimization, not a permanent difficulty target.

Neither file records frame times or reconstructs selection-only/camera inputs.
A browser CPU profile found avoidable off-screen pose construction and repeated
full intersection tests in sight-cone rendering. Viewport pose culling and ray
bounds checks reduce that work without altering the recorded simulation. The
separate desktop/touch flash tests verify preview gestures, valid throws and
out-of-range cancellation; these human recordings do not test grenade usability.

## Stay of execution: quiet teamwork and medals

`injunction-quiet-d4da9148.replay.json` is the unchanged submission
`amortization-injunction-won-d4da9148.replay.json`. Every original checkpoint
matches: tick **2760 / 92 seconds**, **four survivors at full health**, **zero
shots**, no alarm, optional LOG left behind. Vale holds LOOP while disguised
Morrow uploads; both withdraw through the west entrance before the whole crew
uses the public perimeter to VAN.

The medal check evaluates this real completion as **Settled, Full crew, Low
profile, Nonlethal and Off the record**. No disguise, Open channel and Due
diligence remain unearned. A browser check also watches the original winning
replay and confirms that playback does not award medals or campaign records.

## Stay of execution: unsupported upload diagnostic

The unchanged submission `amortization-injunction-won-640aec9a.replay.json` is
kept at [`../fixtures/injunction-unmasked-solo-640aec9a.replay.json`](../fixtures/injunction-unmasked-solo-640aec9a.replay.json),
separate from the required successful runs. It matched every original checkpoint
on `6b1c6df`: tick **2234 / 74.47s**, **one survivor (Vale)**, **23 shots**, alarm
active, optional LOG left behind. Feedback: “Got confused and accidentally
cheesed the level. That path-finding, tho XD.”

Morrow took KIT and uploaded without LOOP or RADIO preparation. The trace at
35.53s reached only the nearby registry inspector. After killing that inspector,
Morrow resumed and finished at 56.97s. The two response teams patrolled the east
side instead of responding to UPLINK. At 59.17s, the all-crew extraction order
sent Morrow and the two idle long-gun carriers through guarded lanes; they died,
leaving Vale's public north-street approach to satisfy the survivors-only exit.

The current regression runs the original commands and confirms that dispatched
site guards stop the unsupported upload at approximately 50%. Waiting another
30 seconds beyond the submitted duration still cannot unlock the van. No inputs,
checkpoints, metadata or comments were edited to produce this result. Separate
quiet, prepared assault and defended radio-live runs verify full-crew wins after
both flash grenades are spent.

The final extraction also motivated a public-perimeter preference for outside
operatives. Vale's earlier northward clicks at ticks 1561 and 1576 landed across
the west wall: going south first was the real route to its opening. Desktop and
touch checks reproduce the former coordinate and verify the new detour caption,
route arrow and Hold cancellation without changing that intended destination.

## Key personnel: locked EXIT feedback

`personnel-split-exit-b6202c06.replay.json` is the unchanged submission
`amortization-personnel-won-b6202c06.replay.json`, recorded with the cell patrol:
mission `9e1c0d27`, simulation `72792e8a…`. It verifies every original checkpoint
and wins at tick **2699 / 90.0s**, with **four survivors**, **five shots** and no
alarm. Vale leaves with 15 HP; the other three are undamaged. Neither prisoner
recovers GEAR and the optional register stays behind.

Feedback: “Was EXIT unavailable? I tried to click it. If so, differentiate
accessible diamonds from inaccessible ones.” Rook is freed at 31.9s. Five EXIT
commands at 32.6–39.2s are refused because Vale is still captive; Vale's rescue
order arrives at 55.8s. Rook later operates EXIT and leaves ahead of Morrow and
Vale, before the final all-crew VAN order at 88.9s.

Map markers now replace the actionable diamond with a muted padlock and explicit
LOCKED label when a prerequisite is missing. Hovering or tapping explains the
remaining requirement in the map caption, including the remaining prisoner's
name. CELLS power, the separate operator, selected-operative equipment/identity,
locked transports and archives, and extraction use the same presentation.
Objective locators retain the locked styling. Blocked clicks still reach the
normal refusal feedback and preserve standing orders. These are presentation
changes only; the new recording remains exactly compatible.

## Key personnel: cell patrol and scenery

All four September 29 recordings reproduced their original checkpoints and
outcomes on `70b4da3` (mission `1c232d29`, simulation `1b285ee3…`).

| Submission suffix | Original outcome | Feedback / route |
| --- | --- | --- |
| `bd8f18da` | Won, tick 1575 / 52.5s; four alive; zero shots | Disguised rescue, then one squad VAN order. Asked for a patrol to make leaving the cells require timing. |
| `2b2c6c9d` | Lost, tick 1569; six shots | “Got curious about the gear...” Morrow approaches the guarded lockers. |
| `ba99bd4c` | Lost, tick 2033; nine shots | Sable enters holding and engages its patrol. |
| `4f7405c3` | Lost, tick 2342; four shots | The freed group approaches GEAR, then targets the breach officer. |

`personnel-gate-rescue-bd8f18da.replay.json` retains the winning submission
unchanged. With the added cell-corridor patrol it still wins at tick 1575, but
now incurs three shots and Rook leaves with 49 HP. The current-rules test proves
continued completion, not the old quiet outcome or original checkpoints. The
three losses remain diagnostic inputs rather than required defeats.

A separate synthetic verification waits for the patrol before moving each
prisoner and finishes with all four undamaged, no alarm and no shots. The armed
verification coordinates the rescue, deals with the cell patrol, and recovers
both prisoners' equipment. Both record and replay exact current checkpoints.

The attached screenshot exposed a van drawn across the wrong axis, an overlapping
console caption and lamps positioned using the old depot's absolute coordinates.
Rendering now respects vehicle orientation and supporting-wall extents; the
redundant console caption is gone. Browser checks cover labels, lamp bounds and
van extraction hits at four scales, alongside the existing desktop/touch rescue
journeys. The additional graphics check is outside routine CI smoke tests.

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
The camera look-ahead change did not alter either fingerprint. The three wins
originally joined the completion corpus unchanged; `8de9cdd6` was later retired
after the coil pursuit correction described above:

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
a casualty. These original submissions did not exercise the quiet route,
full-crew extraction or field dressings; the [September 30 runs](#margin-call-all-medals)
now cover all three. No combat values or mission geometry were
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
the September 29 runs above now supply replacement human completions.

## Retired recordings

These recordings no longer win within their recorded duration under revised
rules and were removed from the completion corpus. Original submissions remain
in git history; they were not converted to passing fixtures.

- `clearing-assault-8de9cdd6.replay.json`: preserving valid operative coil charges
  changes the subsequent fight. The unchanged orders now lose at tick 1620,
  before the original tick-1871 win. It is removed from required completions;
  the other two human Mission 07 assault routes still win.
- `broadcast-premature-extraction.replay.json` (`52011baa`, PR #14): the new weapon
  ranges, stationary carbine preparation and sentry encounter defeat the old
  assault at tick 615, before its next recorded order. Its original win was tick
  5851. The premature extraction regression remains covered in browser tests.
- `severance-squad-assault.replay.json` (`546bc6e8`, PR #14): the new loadout and
  specialist pair defeat the old moving assault at tick 930, before its next
  recorded order. Its original win was tick 1684. The synthetic quiet and armed
  routes use the new weapon commitments; the September 29 human runs now cover
  quiet, armed and live-alarm completions with all medals available.
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
