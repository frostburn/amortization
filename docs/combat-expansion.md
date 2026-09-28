**Combat expansion: Public offering and Severance.** Introduce the first new weapons and enemy roles in operations 05 and 06. This is a design proposal; the numerical values below are starting points for playtesting. Earlier operations retain their current equipment and encounters during this rollout.

The crew should usually move together, with occasional splits to cover a crossing, approach from another angle, or protect someone working. Equipment should create those decisions. A disguised solo operative can prepare access and escape trouble; sustained aggression remains a job for the crew.

The first weapon set is small:

| Weapon             | Tactical use                                           | Commitment                                                                                |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Concealable pistol | Disguise work, close protection, fighting while moving | Short reach and modest sustained damage                                                   |
| Carbine            | Cover a courtyard or defend a working teammate         | Longer reach; roughly 0.35 seconds of stationary preparation before firing after movement |
| Breach shotgun     | Win a close encounter at a doorway or around a rack    | Strong close damage, short reach, and a clear recovery window                             |

Use automatic magazine reloads with unlimited reserve ammunition initially. Reload progress survives movement, weapon stowing, and order changes. Different magazine sizes and recovery times give teammates reasons to cover one another. Damage and range should be predictable enough to plan around.

Begin with visible mission loadouts: two pistols and two carbines in operation 05; replace one carbine with a shotgun in operation 06. Weapon assignment appears in the briefing and crew roster. Pistols can be concealed; long guns remain conspicuous when stowed. KIT identifies an eligible pistol carrier before assignment. Any operative can eventually use any equipment; a loadout editor belongs to a later pass.

**Flash grenades replace the smoke proposal.** Their purpose is to create a short crossing, breach, or withdrawal opportunity while keeping the map readable.

- Start with two grenades per mission, one on each long-gun carrier. Both missions remain completable after these are spent.
- A ground-target preview names the thrower, shows the landing point and affected area, and marks exposed allies. One confirmation orders one throw. Group selection never causes several simultaneous throws.
- Use a short, visible throw and fuse. An invalid trajectory or out-of-range target explains the problem before commitment; aiming preserves existing orders.
- An initial tuning target is a three-unit radius and 1.5 seconds of disorientation. Walls and substantial props block exposure. Facing does not affect protection in this first version.
- Exposed crew and enemies temporarily lose the ability to acquire targets, fire, or work. Movement orders remain active. Saved upload progress survives; an interrupted charge placement follows its existing restart rule. Repeated flashes refresh the remaining effect instead of adding durations together.
- An ongoing radio report continues. Detonation attracts investigation; witnessing the throw identifies its author, while hearing it only gives security a location to investigate.
- Render a brief, restrained local pulse, a flinch or shielding pose, and a small recovery indicator. The camera view remains clear, including while a selected operative is disoriented.

Both sides use the same weapon preparation and recovery rules. Enemy roles should be recognisable from their weapon silhouette and behaviour, with a short description available on inspection. Health, positioning, and readiness should explain why an encounter is dangerous.

**Operation 05: Public offering introduces carbines, rifle sentries, and flashes.** The upload already gives the crew a reason to defend someone who cannot shoot, and holding LOOP leaves only two operatives free to fight.

Replace one courtyard patrol near the server-room approach with a rifle sentry. Give it nearby physical cover and approaches from two directions. It holds a useful firing lane, breaks sight when pressured, and takes time to prepare another shot after repositioning. Ordinary patrols continue to provide the moving threat inside the server room. Start by changing the composition of existing guards rather than increasing their total number.

The quiet route still uses a concealed pistol, LOOP, and the racks to time an upload. The armed route uses a carbine to cover the operator while another operative watches the approach. A flash buys time to cross the sentry's lane, move a defender, or pull the uploader back behind a rack. Its duration is much shorter than the upload, so maintaining a safe position still matters. Saved upload progress supports retreat and another attempt.

The first encounter should reveal the sentry's weapon and firing preparation before it can trap the crew in the open. Briefing guidance points out its lane and the racks that interrupt it. RADIO, tracing, and the need to collect the LOOP operator remain central to planning the exit.

**Operation 06: Severance adds shotguns and breach officers.** The two core halls provide close encounters; the courtyard and cooling blocks give a defender and an advancing partner space to cooperate.

Replace an existing courtyard pair with a rifle sentry and a breach officer. The sentry holds a lane while the breach officer uses a reachable screened approach toward a last-seen threat. The officer's short weapon, advance, and firing recovery clearly advertise the danger. It can withdraw from a losing approach and try another known route. Coordination uses observations and communicated positions.

Keep patrol windows in both core halls so a disguised operative can still plant the charges. The armed alternative can leave a carbine covering a hall entrance while a shotgun operative clears the nearby corner and another plants. A flash can enable entry or withdrawal, but its effect ends before the five-second placement finishes. Detonation and withdrawal then test regrouping under pressure. If a radio call succeeds, a later response can reuse the rifle-and-breacher pairing at the existing response entrance.

All critical routes need a way to break sight or change angle. Encounter difficulty should survive a spent grenade supply, while careful preparation should earn a noticeably safer passage.

The remaining ideas stay available for later missions:

| Idea                                | What it would add                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Compact automatic                   | Mobile escort and close flanking, balanced by frequent reloads                                                                  |
| Coil rifle and security marksman    | A long, visibly charged firing lane that rewards breaking sight or approaching elsewhere                                        |
| Support gun and bounded suppression | Hold a firing arc while a partner moves; pressure delays firing preparation while movement stays responsive                     |
| Shield officer                      | Strong frontal protection, limited turning speed, and an ordinary vulnerable body; a reason to establish two firing angles      |
| Credential inspector                | A visible identity check that makes disguise routes depend on timing and positioning                                            |
| Sensor drone and turret             | Security devices with readable scans, physical connections, and opportunities for disruption                                    |
| Noise decoy and local jammer        | Redirect attention or interrupt nearby communication for a limited window                                                       |
| Borrowed corporate authority        | Use a disguise at a terminal to redirect a patrol, authorise a delivery, open staff access, or schedule an equipment inspection |

Implement and playtest operation 05's additions before introducing operation 06's pair. Review human runs for meaningful changes of position, useful group control, and occasional purposeful splits. Repeatedly ordering all four people individually should be exceptional. A compact advance should encounter clear reasons to stop, take cover, or change approach.

Verification should cover quiet and armed completions of both missions, routes with grenades already spent, flash occlusion and friendly effects, and understandable targeting on desktop and touch. All new orders and timers must follow simulation time and replay deterministically. When combat rules land, check retained human inputs under those rules, retire runs that no longer complete with the reason recorded, and collect replacement runs without rewriting the original player's actions.
