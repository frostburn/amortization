# The Bench · Operation 15

The campaign ends on Crown Tower’s two executive levels: a penthouse and an open
roof. The crew arrives from Threshold’s service lift. Dacre and Holt are both
present; the helicopter is already waiting above them. The 50 × 38 site keeps a
comfortable follow-camera scale, selecting the visible floor from the active
operative. It uses Threshold’s sunset palette and night sight distances.

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
On-map bars show dispatch deadlines, work on RADIO/CUT/CUFF, shared seal progress
and Dacre’s signal. Goal locators track Dacre’s actual position.

## Command marshal

Dacre signals for two seconds after seeing an identified intruder. He raises a
hand and stops moving and shooting. Any hit or flash cancels the signal, with an
eight-second recovery before another attempt. Death clears the signal and bar.

A completed order moves only his surviving, nearby shield officer, support gunner
and breacher. Each needs clear sight of Dacre. Destinations come from each
officer’s authored posts; a command tries at most two paths per officer, rejecting
routes longer than sixteen units. Partners remember the contact position seen
when the signal began, never a later unseen position. Dead officers stay dead and
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
The optional, replayable **The remaining work** scene uses Voss and Mara so it
holds for any surviving crew and both Holt outcomes. Earlier victories stand.
Existing sound and volume preferences also govern that scene.

## Verification

`tests/bench.test.ts` has two complete, guarded, unmodified-site command runs:
paired seals with Holt in custody, and CUT with Holt eliminated. Both extract all
four operatives and MINUTES, then replay their recorded commands and checkpoints
exactly. The routes use infiltration to RADIO, cover, two flashes, split fire and
a separate rooftop advance while protecting the evidence carrier. The southern
roof sentry remains alive. These prove completion, not typical-player difficulty;
the first human run of this mission is pending.

Focused checks cover door collision and cache invalidation, saved/interrupted
seal work, a lone-survivor inside CUT, capture prerequisites, command timing and
interruptions, remembered contact positions, bounded surviving retinue, and
extraction across floors. Existing human bundles remain unchanged and run under
current rules. Campaign-wide aftermath tests cover helicopter boarding without
mutating the scored world.

The extended Playwright journey uses presentation fixtures and real desktop/touch
controls for concise briefing, command/seal bars, cuffing, split-floor selection,
roof extraction, immediate results, delayed departure and optional ending. It is
outside the routine smoke tag; the standard CI browser load is unchanged.
