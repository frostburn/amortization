# The Bench · Operation 15

The campaign ends on Crown Tower’s two executive levels: a penthouse and an open
roof. The crew arrives from Threshold’s service lift. Dacre and Holt are both
present; the helicopter is already waiting above them. The 50 × 38 site keeps a
comfortable follow-camera scale, selecting the visible floor from the active
operative. The penthouse has cool fluorescent lighting; the roof keeps Threshold’s
sunset palette. Both retain night sight distances. Exterior faces remain sunset-lit
alongside the fluorescent interior, using Threshold's shared facade design.
The facade drops toward a muted city with reddish sun-facing surfaces, with no
street or paving beside the executive floor. Roof light pools are clipped so
changing floor cannot recolor the building's exterior.

## Objectives and choices

- Defeat **Lucan Dacre**, the command marshal. Charcoal armour, gold shoulders,
  carbine, 160 visible health. No healing, immunity phases or summoned guards.
- Open the Bench by holding **SEAL A** and **SEAL B** with separate operatives and
  free hands for four seconds together. Each station has a short setup; work
  pauses on movement, flash, death or release. Shared progress is saved. Opening
  releases the workers and permanently removes the actual collision/sight door.
- **CUT** takes eight noisy seconds and also works from the chamber’s inside.
  It provides a casualty fallback without requiring two surviving operatives.
- **Holt** has ordinary 90 health. Defeat Dacre and open the chamber to cuff him
  for three seconds with free hands. Attack his body explicitly to kill him;
  automatic fire never selects him. Guards will not shoot their chairman,
  including while he is cuffed. Custody uses the existing wait/follow and escort
  handoff controls, with Holt’s own portrait.
- **MINUTES** are optional evidence. Carrying them occupies both hands.
- Take **UP** to the roof and board **HELI** with every survivor and a living,
  cuffed Holt. A following prisoner walks to the stairs and changes floor; a
  waiting prisoner stays behind. Bullets, sight, flashes and routes cannot cross
  the two levels. **DOWN** remains available for recovery.

RADIO is in the north gallery, away from arrival. Its five-second shutdown stops
the two standard reinforcement waves. It does not disable Dacre’s local command.
All nine defenders walk authored circuits. The inspector sweeps between RADIO
and the central gallery; the north and south sentries can encounter a returning
or split crew. Dacre and his detail circulate around the board table and command
screen. On the roof, the marksman changes firing lanes while the carbine patrol
crosses the helipad approach. There are no additional guards or health/damage
increases. Timing, cover, separation and local sightings change the engagement.

On-map bars show dispatch deadlines, work on RADIO/CUT/CUFF, shared seal progress
and Dacre’s signal. Goal locators track Dacre’s actual position.

## Command marshal

Dacre signals for two seconds after seeing an identified intruder, or receiving
a current sighting from a surviving retinue officer who can see him. He raises a
hand and stops moving and shooting. Any hit or flash cancels the signal, with an
eight-second recovery before another attempt. Death clears the signal and bar.

A completed order moves only his surviving, nearby shield officer, support gunner
and breacher. Each needs clear sight of Dacre. Destinations come from each
officer’s authored posts; a command tries at most two paths per officer, rejecting
routes longer than sixteen units. Partners remember the contact position seen
when the signal began, never a later unseen position. An officer cannot relay
through a wall, while stunned, or without identifying and seeing the intruder. Dead officers stay dead and
do not regain health. Disabling RADIO has no effect on these hand signals.

The chamber and board table create different approaches around the retinue. A
single order to pursue Dacre can expose the crew to the shield, support gun and
breacher together. Flashes, cover, split fire and interrupted commands offer
answers. The roof has a marksman and a carbine sentry; every guard need not die.

## Ending and rewards

The helicopter waits indefinitely. Both principals must be resolved before
boarding becomes available. The scored world stops on success; a separate visual
world boards the passengers at the side door, lifts the helicopter and flies it
away. The results dialog waits for departure, while **View results** stays
available immediately. Restart and Operations are offered; there is no Next
operation. Failure retains the existing moving-world aftermath.

**Answerable** awards Holt’s live custody. The seven applicable medals bring the
campaign to 108; Nonlethal is absent here because defeating Dacre is mandatory.
The optional, replayable **Off duty** scene welcomes the crew back to food,
raised glasses and a district celebrating its freedom. All four operatives
speak with their own portrait and keyboard voice in the same fixed scene after
every win. Gameplay casualties receive no comment or explanation; Mara’s line
works for either Holt outcome. No cast or outcome is saved for story replay.
Existing completion records still unlock it, and sound/volume preferences apply.

## Verification

`tests/bench.test.ts` has two complete, guarded, unmodified-site command runs:
paired seals with Holt in custody, and CUT with Holt eliminated. Both extract all
four operatives and MINUTES, then replay their recorded commands and checkpoints
exactly. The routes use infiltration to RADIO, cover, two flashes, split fire and
a separate rooftop advance while protecting the evidence carrier. The routes now address the returning south patrol and both rooftop defenders.
These prove completion, not typical-player difficulty. The first human batch
exposed the static defense; its unmodified winning script loses under the new
patrols. All three originals and the analysis are retained as diagnostics in
[the replay notes](../tests/replays/README.md#the-bench-first-finale-playtest).
The follow-up human batch confirms a full-crew lethal completion with CUT and
MINUTES left behind. All four submissions reproduce all 63 original checkpoints;
the lighting/exterior follow-up preserves the simulation and mission definitions.
The win joins the required human corpus and the three losses remain diagnostic.

Focused checks cover door collision and cache invalidation, saved/interrupted
seal work, a lone-survivor inside CUT, capture prerequisites, command timing and
interruptions, remembered contact positions, bounded surviving retinue, and
extraction across floors. A no-input minute checks that every patrol actually
travels its reachable loop without spontaneous contact. A relayed command test
checks cover, identification, stun, loss of sight and the fixed contact snapshot.
Story checks cover the fixed full cast and replay after reloading records with
obsolete outcome data; completion counts, times and medals are preserved. Existing
human bundles remain unchanged and run under current rules. Campaign-wide aftermath tests cover helicopter boarding without
mutating the scored world.

The extended Playwright journey uses presentation fixtures and real desktop/touch
controls for concise briefing, command/seal bars, cuffing, split-floor selection,
roof extraction, immediate results, delayed departure and optional ending. It is
outside the routine smoke tag; the standard CI browser load is unchanged.
Desktop/touch screenshots cover the fluorescent interior, tower overview and
sunset roof. GPU pixel checks verify even indoor illumination, light pools at
roof height and no light leaking from operatives on the other floor.
