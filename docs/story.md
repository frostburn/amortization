# Optional story scenes

The campaign follows a concrete chain: free Voss, establish what was taken,
free the auditor who objected, publish the evidence, stop reconstruction of the
debts, obtain authority to repay people, rescue the captured operatives, serve
the mandate, release payments, and withdraw the seizure orders. Those victories
stand. The antagonists respond to losses; a later revelation must not quietly
undo the player's work.

The prologue and all thirteen mission endings now have short, manually advanced
scenes. They supplement the existing briefing and epilogue. Their tone is
restrained and serious, with people discussing specific consequences instead of
trading jokes or explaining controls. Only the opening and the all-survivors
rescue ending speak through an operative: the other endings remain valid when a
mission was won with casualties. Voss and Mara provide continuity away from the
field team.

## Where the player finds them

- **Watch opening** in the first briefing and Operations. It is always available.
- **Watch scene** in a successful debrief. Finishing a scene changes its label to
  **Replay scene**; closing early does not mark it watched.
- Each completed mission in **Operations** offers its scene again. Existing
  completion records, including migrated records, unlock their scenes immediately.
  Uncompleted missions show an unlock condition without revealing the scene title.
- No scene autoplays, chains into another scene, starts an operation or advances
  the simulation. Escape, the close button and outside clicks return to the same
  underlying briefing/results/Operations dialog. Previous, restart and arrow keys
  allow rereading. Text reveals to character-specific keyboard sounds. Click/tap
  the picture or dialogue, or use **Reveal line**, to show the rest immediately
  and stop the keys. A further **Next** action advances; lines never advance
  themselves. Right arrow also reveals before advancing.
- The sound toggle and master volume govern typing as well as game effects.
  Closing, navigating away from a line, muting, or losing focus cancels its keys.
  Hidden/unfocused scenes keep the reader's place and resume without a backlog.
  Reduced-motion mode shows complete lines without typing sounds. Assistive
  technology receives each complete line once, independently of the visual reveal.
- Watching a gameplay replay does not create a completion or unlock a scene.
  A scene's watched flag is separate from medals and mission progress.

The loading shell is inline HTML/CSS and a small bootstrap module. It remains
visible through renderer initialization, then yields immediately to the briefing.
There is no invented percentage or minimum delay. Module/renderer failures leave
a reload action. The story's images are loaded on demand and never gate playing
or reading the dialogue. [Artwork and generation prompts](story-art.md).

Each character keeps one keyboard voice throughout the story, regardless of
location. Morrow uses muted taps, Voss and Mara use distinct plastic keys, and
the bosses retain their mechanical typewriter signatures.
Individual timbre, cadence and punctuation rests are described in
[Sound design](audio.md#story-keyboards). These are abstract character voices,
not a claim that every conversation literally takes place at a keyboard.

## The opposing cast

| Character                           | Power and manner                                                                                                                                | Foreshadowed encounter                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Severin Holt, chairman              | Signs the exceptions that make exploitation ordinary. Calm, concerned with enforceable authority; he can admit a district is lost.              | The Bench: a secured adjudication chamber with several physical seals and protected positions.   |
| Ada Kestrel, director of continuity | Owns the infrastructure and understands its limitations. Treats failures as engineering evidence, and eventually stays at the controls herself. | An occupied control room: active rerouting, local power and changing access.                     |
| Lucan Dacre, security marshal       | Coordinates people rather than adding isolated guards. Accepts responsibility for the failed detention layout.                                  | A mobile command line at a transit interchange, using shields and overlapping support positions. |

## Scene progression

| Available after  | Scene                    | Purpose                                                                                                                     |
| ---------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Opening          | The remaining balance    | Voss's debt has become confinement; Holt signs the apparently healthy district report.                                      |
| 01 · Depot       | A name in the margin     | Voss supplies the annex address. Holt wants to know who challenges her account.                                             |
| 02 · Archive     | The same signature       | Voss traces the payments and Holt's exception; the original evidence cannot simply be replaced.                             |
| 03 · Transfer    | The objections           | Voss finds Mara's rejected audits. Dacre reveals the company's pressure for a corrected statement.                          |
| 04 · Custody     | An uncorrected statement | Mara admits how close she came to signing. Dacre asks for coordinated authority.                                            |
| 05 · Broadcast   | Acknowledgements         | Real institutions receive the audit; Kestrel's recovery infrastructure is still a threat.                                   |
| 06 · Severance   | What cannot be restored  | The backups are genuinely destroyed. Kestrel and Dacre disagree over access and safety.                                     |
| 07 · Clearing    | Custodians               | The escrow money exists. Kestrel commits to local control rather than relying on the radio.                                 |
| 08 · Mandate     | The list of names        | Repayments become specific people. Dacre prepares surveillance ahead of the safehouse raid.                                 |
| 09 · Personnel   | Four places at the table | The reunited crew gets a quiet moment. Dacre learns from the split-team rescue.                                             |
| 10 · Injunction  | Proof of service         | Holt acknowledges the suspension and prepares to hear an appeal personally at the Bench.                                    |
| 11 · Settlement  | Money coming in          | A recipient struggles to believe her payment; old seizure dispatches remain in circulation.                                 |
| 12 · Countermand | Beyond the district      | The seizure crews leave and the money stays returned. The three antagonists take up distinct positions beyond the district. |
| 13 · Continuity  | An empty control room    | Kestrel is removed, in custody or dead. Local control is handed over; Dacre gathers the remaining crews at the interchange. |

Kestrel's encounter is implemented in [Continuity](continuity.md): two storeys,
alternating local feeds, and a choice of arrest or lethal force. Her removal is
final in either outcome; she does not reappear as a later boss.

## Future boss design, not implemented here

These are encounter promises for the remaining antagonists.
Introduce and explain any new mechanics in the mission UI whether or not the
player has watched a scene.

**Dacre** should physically move with a coordinated guard line. Portable command
positions, shield escorts and support fire can create changing approaches. A
split team should be able to interrupt coordination while another group reaches
him. He must obey sight and lose track of unseen operatives; commanding the
response is not permission to know the player's location through walls.

**Holt** should have physical protection the player can dismantle. The Bench's
distributed seals could sustain security privileges while the chairman moves
between protected chambers. Holding more than one station breaks that system
and exposes a route to him. His importance should come from the site and its
defenders, not an unexplained health multiplier or a cutscene-only victory.

## Implementation boundaries

Each mission's scene, concise briefing and epilogue live together in
`src/content/mission-copy.ts`. Shared speakers, settings and the opening are in
`src/content/story.ts`; the dialog is in `src/ui/story.ts`. Completion records
remain the source of truth for unlocks. `amortization.story.v1` stores only the
IDs of scenes the player explicitly finished.

Story copy itself stays outside replay fingerprints. Continuity adds a new
mission definition and floor support, while existing human runs remain verification
fixtures under the current rules. Scene art is decorative and captions are
accessible text. The first paint uses no image, font download, video, or audio.
