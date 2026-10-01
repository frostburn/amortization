# Threshold · Operation 14

The penultimate operation reaches the service lift beneath Holt's tower. Dacre's
remaining interchange guards hold the approach; the crew must obtain the physical
key and get everyone aboard. The next encounter is reserved for **Dacre and Holt
together in the skyscraper penthouse**. Kestrel remains removed, and the payments
and seizure recall from earlier operations stand.

## Site and choices

The 60 × 42 interchange has three readable areas: a locked dispatch office to the
west, the tram concourse in the centre, and the executive service lobby to the
northeast. The northern staff walk is screened; the southern platform has a
marksman. An inspector patrols the central crossing. A shield officer, support
gunner and breacher form the local lobby reserve.

The service entrance is a low annex of Crown Tower. Behind it, the full-size
skyscraper extends beyond the map, sharing the finale's footprint, window rhythm
and sunset materials. This is render-only scenery; the lift approach, collision
layout, default camera scale and recorded routes are unchanged.

- **KEY** is the original service module. Its carrier has both hands occupied.
  Hold **SHUNT** with a partner to open dispatch, or force **CUT** for eight seconds.
  CUT works from inside as well. Keep the shunt operator in place until the
  runner has cleared the shutter. RADIO sits inside dispatch, away from entry.
- **LINK** needs the key carrier and five uninterrupted seconds. Moving, Hold,
  dropping the key or being flashed resets unfinished work. A completed call is
  permanent and takes **eighteen seconds** to bring the car down.
- The wired bell dispatches the **three existing reserve guards** to LINK even
  when RADIO is off. It supplies a fixed incident location, not an unseen
  operative's position, and does not itself identify anyone or raise the radio
  alarm. Guards with direct contact retain it. RADIO still prevents outside
  reinforcements.
- **LIFT** stays available once it arrives. Order boarding with the original
  key and every survivor in its ring. A fallen carrier drops a recoverable key;
  recovering it never requires repeating the call. There is no departure deadline
  or automatic extraction. The east delivery gate and arrival van are not exits.

Quiet play uses the split-team shutter, the staff walk, a timed patrol crossing
and lobby cover. Force opens dispatch permanently but draws investigation and
radio reinforcements; the crew can fight and then approach the lift through the
screens. Local reserve pressure survives an early radio shutdown.

The ordinary six medals apply, plus **Light touch** for leaving the dispatch lock
intact and extracting all four with KEY. The concise briefing contains the job
and essential timing; route advice stays inside the opt-in disclosure. Goal
locators follow the key carrier or dropped key. The lift control shows its call
state, countdown and boarding prerequisites. On the map, RADIO's red bar drains
toward the next patrol dispatch while disable work fills a separate mint bar.
LINK and CUT show actual work progress; SHUNT names its holder. LIFT shows the
eighteen-second arrival, then **Open · waiting** without implying a departure
deadline. All bars use simulation time and remain readable at different zooms.

## Sunset and departure

Sunset is a presentation palette, separate from the daylight perception setting.
It uses red paving and brick, plum shadows, yellow coping and glass, long scenery
shadows, and a warm low-angle light on the existing character meshes. Enemy role
colors remain distinct. Soft operative light pools preserve the readable ambient
floor. **Every guard retains its ordinary night sight distance.** Decorative
shadows provide no stealth bonus.

The service lift has a visible doorway and sliding leaves. On completion,
survivors walk into the car and its doors close before automatic results appear.
The arrival van stays parked. **View results** remains immediately available.
The scored simulation and replay stop at extraction; this animation uses the
existing separate aftermath world.

The optional reward scene, **Above the last street**, puts Dacre beside Holt
upstairs. It uses the existing portraits, backgrounds and keyboard voices, obeys
the sound preference, and remains replayable from Operations.

## Verification

- Two command-only runs on the untouched guarded mission complete with all four
  alive: nonlethal SHUNT access without an alarm, and an armed CUT route. Both
  serialize and verify replay checkpoints.
- Focused tests cover night sight distances, carrier-only work, interrupted work,
  independent reserve dispatch, arrival without automatic boarding, key recovery,
  survivor requirements and lift aftermath without changing the scored result.
- Desktop and touch browser journeys cover briefing disclosures, objective
  locators, default zoom, sunset rendering, call/arrival controls, key recovery,
  boarding and closing doors. The existing lighting pixel test protects night
  lighting and camera transforms.
- Five human attempts verify all 98 original checkpoints without changing the
  simulation fingerprint: three defeats, one unfinished run and one win with
  three survivors at 140.73s. The winner cuts dispatch, disables RADIO after one
  patrol, calls the lift and retrieves KEY after Rook falls; the completed call
  survives the handover. This establishes a human recovery route, not a full-crew
  or silent human completion. The unchanged win joins the completion corpus;
  the other four remain diagnostic fixtures.
- The unfinished run's note reports a soft lock: Morrow is alone inside dispatch
  after Vale leaves SHUNT and falls. Continuing that exact world with the
  existing inside CUT command opens the shutter at 61.97s and lets Morrow leave
  with 100 HP. A regression checks that recovery and its visible work timer.
  The existing escape guidance/button remains available; no balance change or
  forced mission failure is needed.
- Desktop and touch timer checks cover simultaneous patrol/disable bars, paused
  time, fixed label size during zoom, unobstructed map input, inside CUT, LINK,
  arrival, open-lift status and cleanup on completion. Unit checks also cover
  the second patrol interval, saved upload/trace and transfer progress, temporary
  turret shutdown, inactive floors, cancelled work and defeat.

The locked dispatch room also exposed repeated failed path searches when an
operative was ordered to attack its inaccessible guard. Navigation now retains
up to 64 exact failed start/end queries per cached geometry state. Moving either
endpoint, opening a door or editing geometry retries immediately. Successful
paths, simulation timing and replay state are unchanged.
