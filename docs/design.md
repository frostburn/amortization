# Design notes

The crew normally operates together. Splitting is useful when one maintenance identity can enter a guarded workplace while others prepare access and extraction. Selecting someone never changes another operative's order. Selecting everyone and regrouping are separate commands.

Selection should survive imprecise combat inputs. Clicking a selected operative on the map keeps their group; portraits and number keys deliberately isolate individuals. Empty drag boxes and attempts to remove the final selected member keep the existing selection. Losing that final operative selects the survivors. Touch map taps issue orders; portraits handle touch selection.

Reaching the engineer changes entry into escort. Physical evidence removes one gun from the fight and can change hands. A blown disguise creates a combat problem rather than immediate mission failure.

## Boundaries

- Serializable simulation data and plain TypeScript functions. No framework objects in gameplay state.
- Mission geometry and patrols belong to content. Substantial props are solids; lights and lettering are decoration.
- Guards own suspicion, remembered identities, last seen positions, and delayed radio reports. Site-wide identity knowledge follows a completed report.
- The world clock drives patrols, interactions, weapons, radio calls, and reinforcements. Pause stops all; slow time scales all.
- Cover is physical occlusion. This release has no numerical cover bonus or cover snapping.
- Moving people are not permanent navigation obstacles. Destination slots spread the crew; future local avoidance can improve crowd flow.
- Local records have a version and validation. Browser storage failure must not prevent play.

## Visual system

Near-black green chrome, slate industrial surfaces, mint selection and health, amber objectives and suspicion, coral combat alerts. Arial/Helvetica with spaced uppercase labels; monospace for clocks and shortcuts. A narrow command sidebar and persistent portrait strip frame the map.

The generated concept established composition and palette. Intentional differences: code-drawn architecture keeps displayed geometry exact; initial scenery is simpler; functional field dressing, evidence drop, and camera controls supplement the concept. Decorative stealth and mobility statistics were omitted because they have no gameplay counterpart. On narrow screens the sidebar moves below the map and crew.

Generated portrait and person atlases supply character art. Architecture, sight cones, bullets, and markers come from game state. Generated map artwork never defines collisions.

The person atlas is animated through a small mesh: opposite strides and foot lifts, knee flexion and restrained arm swing. Gait phase advances once per 1.1 world units of interpolated walking distance, keeping it aligned with movement, pause and slow time. Each atlas quadrant has its own sole anchors. Contact shadows follow the ground projection of each foot while the swinging boot lifts above them; selection rings and depth ordering retain the world ground position. Vehicle face details use world-plane projection rather than screen-space offsets.

The extraction van uses a shaped cab and cargo body with a sloped windscreen, short bonnet, door seams and handles. Tyres touch the road and show through wheel openings in the side panel. Its visual height matches a standing person; its navigation footprint and extraction radius are unchanged.

## Material breach

The second contract turns access into a standing squad order. An exposed fire-control shunt on the public street must be held continuously; it does not consume the disguise. The disguised runner uses that access, prepares the delivery gate, and steals a required physical ledger. Moving the operator, assigning another job, or losing them releases the shutter. A doorway safety sensor prevents invalid collision states, and cutting from either side prevents an abandoned infiltrator being permanently trapped.

The loud alternative takes eight seconds and leaves permanent access. Nearby guards hear it even without radio service. A carrier cannot use a gun, cut the lock, or work the shunt until setting down the ledger. The conspicuous ledger removes the uniform's protection; the screen wall and road patrol make the withdrawal a distinct navigation problem. No failure timer forces a particular approach.

Mission metadata owns briefs, objectives, map dimensions, gates, landmarks, response entry points, and patrols. The shared simulation supports an optional escort and a held shutter. The renderer fits each map and uses code-drawn filing cabinets and ground markings for the annex. Both operations can be launched directly; a completion also offers the next operation. Records remain independent and migrate the first operation's earlier score.

## Next useful work

Tune whether splitting the crew earns its cognitive cost. Then extend civilian responses and challenges, spatial equipment choices, full directional character art, route variety, and missions built from these systems.
