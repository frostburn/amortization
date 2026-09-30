# Continuity · Operation 13

Ada Kestrel has taken direct control of Continuity House. This daytime operation
ends her role in the campaign. Arrest and lethal force are both valid; neither
outcome reverses the payments, injunction or seizure recall from earlier missions.
The optional ending, **An empty control room**, moves the conflict toward Dacre's
interchange and makes no assumption about which route the player took. The debrief
states whether Kestrel was eliminated or taken into custody.

## Site and choices

The 60 × 42 site contains a two-storey headquarters inside a service perimeter.
Ground-floor reception, the two isolation cabinets and the stairwell sit beneath
the upper gallery and screened control room. Kestrel waits upstairs. RADIO is in
the far upper corner; reaching it means penetrating the building's defenses.
The upper gallery has a defended northern doorway and a screened southern approach.

Kestrel alternates the WEST and EAST wired turret circuits every twelve seconds.
The HUD shows the active feed and time to the next switch; the guns show their
power state. RADIO only prevents reinforcements. An unexposed maintenance identity
can request a single 24-second inspection; either feed can be permanently isolated
at its ground-floor cabinet. Killing Kestrel stops the local controller.

For an arrest, isolate both feeds and use **CUFF** for three seconds with free
hands. Kestrel then wears visible handcuffs and follows that operative. Wait/follow,
handoff to a partner, and stair traversal all work. Her guards oppose the crew,
but do not shoot their director. Killing her deliberately requires an attack on
her body or the separate **Attack Kestrel** button. The crew never automatically
shoots her, and a cuffed Kestrel cannot be targeted by an attack order.

Both routes require every survivor at VAN. Arrest also requires Kestrel there,
on the ground floor; simply cuffing her upstairs does not finish the mission.
REGISTER is optional. **Answerable** rewards a living arrest with all four
operatives extracted. Nonlethal now includes the mission target, so killing
Kestrel cannot earn it even if every guard survives.

## Floors and presentation

**UP / DOWN** are explicit squad interactions, not walkable slopes. Only selected
operatives on the entrance's floor take the stairs. A following escort walks to
the stairwell and changes floors after reaching it; Wait prevents this. Off-floor
move and attack orders cannot drag a split teammate toward an inaccessible target.
The exit controls ask the player to bring upstairs operatives down before rallying.

The active operative (first selected) determines the visible floor. Crew portraits
show GROUND / UPPER, the map has a floor badge, and selecting a split teammate snaps
the follow camera to their floor at the same zoom. The roof fades near the entrance;
the upper deck, furniture and walls fade as the active operative traverses stairs.
Hidden-floor characters and markers cannot intercept map clicks or drag selection.
Objective locators explicitly label targets on the other floor.

An optional `floor` on positions distinguishes simulation levels. Existing sites
omit it. Navigation caches a separate grid per level and door state; upper-floor
movement is bounded by the building. Sight, bullets, suppression, hearing, flashes,
interaction range and extraction checks cannot cross the ceiling. Floor identity is
preserved in path points, remembered contacts, cargo drops and replay commands.
The renderer projects the upper deck 3.4 units above ground. Each floor retains
ordinary painter ordering and through-wall outlines for walls on that floor.

## Verification

- Guarded command runs cover nonlethal arrest/escort and armed removal with the
  feeds still live, including optional evidence and replay round trips.
- Focused tests cover cross-floor shooting/flash isolation, stairs with a split
  crew, a waiting escort, capture prerequisites, extraction and medals.
- Desktop/touch browser journeys cover the briefing, map stair clicks, floor fades,
  selection/camera changes, arrest controls and the escorted return downstairs.
- Existing human replay fixtures stay in the suite and continue under current rules.
  The simulation fingerprint changes because floor support is new; old files are
  not relabelled as recordings of this build.

The first human batch contains two wins, five losses and one unfinished snapshot.
All eight reproduce every original checkpoint and outcome. Both wins extract
three operatives: one eliminates Kestrel with the alarm active; the other arrests
her and recovers REGISTER after losing its original carrier upstairs. The player
reported feeling challenged and that everything worked as intended. Keep the
balance unchanged. These runs verify both outcomes, stair use, cargo recovery and
survivor extraction; full-crew and wholly nonlethal completions still have only
synthetic coverage. [Detailed run review](../tests/replays/README.md#continuity-kestrel-removal).
