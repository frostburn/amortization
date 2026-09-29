# Missions 03–04: human medal campaign, 29 September 2026

All nine supplied recordings reproduce exactly on main `2f943db`: all 95
checkpoints and final outcomes match. The six wins collectively earn **7/7
medals in each mission**, extending the verified human campaign to all 28
medals in the first four operations.

| Run | Mission | Result | Crew | Time | Medals |
| --- | --- | --- | --- | --- | --- |
| `47c34d52` | 03 | won | 4/4 | 45.3s | Settled, Full crew, Low profile, Nonlethal, By the book |
| `a688c9d5` | 03 | won | 4/4 | 30.2s | Settled, Full crew, No disguise, Open channel |
| `f7d67b5a` | 04 | won / SERVICE | 4/4 | 34.7s | Settled, Full crew, Low profile, Nonlethal |
| `de39b1e1` | 04 | unfinished | 3/4 | 30.0s | — |
| `ee6a86bd` | 04 | unfinished | 2/4 | 48.5s | — |
| `746ce38e` | 04 | lost | 0/4 | 71.7s | — |
| `83054cc8` | 04 | won / SERVICE | 4/4 | 51.2s | Settled, Full crew, Low profile, Nonlethal, Due diligence |
| `171fb37a` | 04 | won / SERVICE | 4/4 | 48.8s | Settled, Full crew, Open channel |
| `a98316b1` | 04 | won / STREET | 4/4 | 48.5s | Settled, Full crew, Low profile, No disguise |

## Mission flow

The quiet courier run completes the diversion and handoff without firing or
killing the courier. Its complementary armed run extracts with RADIO online
and the alarm triggered. The mission-specific By the book medal and both
mutually exclusive alarm constraints are achievable as described.

Custody's first successful SERVICE rescue is close: Mara finishes with 11 HP.
Four shots do not kill any guards, so Nonlethal still applies. The later quiet
SERVICE run brings Mara out with all 75 HP, no shots, no casualties, and the
optional register. Open channel and No disguise are earned in separate wins;
the latter uses CUT, disables RADIO and exits through STREET without a site
alarm. These are distinct ways through the mission, not one universal approach.

Both unfinished attempts already lost operatives and still have Mara locked
in the transport, despite carrying the optional register. The failed attempt
also leaves Mara locked and ends when the last operative dies. No completion or
medal is awarded in those states. No new mission-flow defect was found.

## The backwards van

`f7d67b5a` reports: “Lol, the van drove off in reverse.” SERVICE parks near the
north end of the west street, so the departure animation chooses negative Y.
The renderer previously always drew the nose toward positive Y. Sending the
van south instead would take it toward the street building farther down that
lane.

Parked vans now face their departure direction from the start. Renderer and
animation share one heading calculation for both street axes. Vans pointing
north or west show rear doors, red lamps and a rear bumper; their cab, roof and
near panels are drawn in the appropriate order. The custody transport remains
parked as before. Collision footprints and mission definitions are unchanged.

## Retained verification

All six original wins are retained byte-for-byte in `tests/replays`. Campaign
coverage now checks complete medal sets for missions 01–04. The existing
aftermath checks cover all eleven exits, and a focused desktop/touch browser
check plays the reported SERVICE run through boarding and departure while
preserving its scored world. The ten-case CI browser smoke gate is unchanged.

This is a rendering fix: no simulation files, replay fingerprints, timing,
medals or recorded outcomes change. The three unsuccessful attempts were
verified and investigated without adding them as recurring CI runs.
