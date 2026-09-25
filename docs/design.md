# Design notes

The crew normally operates together. Splitting is useful when one maintenance identity can enter a guarded workplace while others prepare access and extraction. Selecting someone never changes another operative's order. Selecting everyone and regrouping are separate commands.

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

## Next useful work

Tune whether splitting the crew earns its cognitive cost. Then extend civilian responses and challenges, spatial equipment choices, directional animation, route variety, and missions built from these systems.
