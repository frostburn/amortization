# Optional story scenes

The campaign follows a concrete chain: free Voss, establish what was taken,
free the auditor who objected, publish the evidence, stop reconstruction of the
debts, obtain authority to repay people, rescue the captured operatives, serve
the mandate, release payments, and withdraw the seizure orders. Those victories
stand. The antagonists respond to losses; a later revelation must not quietly
undo the player's work.

The prologue and all fifteen mission endings now have short, manually advanced
scenes. They supplement the existing briefing and epilogue. Their tone stays
serious through the campaign, discussing concrete consequences without
explaining controls; the finale lets the crew relax and celebrate. The opening
and all-survivors rescue ending speak through an operative.
The finale is a warmer homecoming: all four operatives join Voss and Quill
for a celebration. Cutscenes use a fixed story cast, just as each operation starts
with a full roster. Gameplay casualties do not alter dialogue, and nobody comments
on the crew’s recovery.

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
location. The four operatives use individual smartphone taps, Voss and Quill use
distinct plastic keys, and the bosses retain their mechanical typewriter signatures.
Individual timbre, cadence and punctuation rests are described in
[Sound design](audio.md#story-keyboards). These are abstract character voices,
not a claim that every conversation literally takes place at a keyboard.

## The opposing cast

| Character                           | Power and manner                                                                                                                                | Campaign encounter                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Severin Holt, chairman              | Signs the exceptions that make exploitation ordinary. Calm, concerned with enforceable authority; he can admit a district is lost.              | The Bench in the skyscraper penthouse: physical protections and Dacre's remaining officers.                     |
| Ada Kestrel, director of continuity | Owns the infrastructure and understands its limitations. Treats failures as engineering evidence, and eventually stays at the controls herself. | An occupied control room: active rerouting, local power and changing access.                                    |
| Lucan Dacre, security marshal       | Coordinates people rather than adding isolated guards. Accepts responsibility for the failed detention layout.                                  | Withdraws from the interchange to fight alongside Holt in the penthouse, using shields and coordinated support. |

## Scene progression

| Available after  | Scene                    | Purpose                                                                                                                      |
| ---------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Opening          | The remaining balance    | Voss's debt has become confinement; Holt signs the apparently healthy district report.                                       |
| 01 · Depot       | A name in the margin     | Voss supplies the annex address. Holt wants to know who challenges her account.                                              |
| 02 · Archive     | The same signature       | Voss traces the payments and Holt's exception; the original evidence cannot simply be replaced.                              |
| 03 · Transfer    | The objections           | Voss finds Quill's rejected audits. Dacre reveals the company's pressure for a corrected statement.                          |
| 04 · Custody     | An uncorrected statement | Quill admits how close he came to signing. Dacre asks for coordinated authority.                                             |
| 05 · Broadcast   | Acknowledgements         | Real institutions receive the audit; Kestrel's recovery infrastructure is still a threat.                                    |
| 06 · Severance   | What cannot be restored  | The backups are genuinely destroyed. Kestrel and Dacre disagree over access and safety.                                      |
| 07 · Clearing    | Custodians               | The escrow money exists. Kestrel commits to local control rather than relying on the radio.                                  |
| 08 · Mandate     | The list of names        | Repayments become specific people. Dacre prepares surveillance ahead of the safehouse raid.                                  |
| 09 · Personnel   | Four places at the table | The reunited crew gets a quiet moment. Dacre learns from the split-team rescue.                                              |
| 10 · Injunction  | Proof of service         | Holt acknowledges the suspension and prepares to hear an appeal personally at the Bench.                                     |
| 11 · Settlement  | Money coming in          | A recipient struggles to believe her payment; old seizure dispatches remain in circulation.                                  |
| 12 · Countermand | Beyond the district      | The seizure crews leave and the money stays returned. The three antagonists take up distinct positions beyond the district.  |
| 13 · Continuity  | An empty control room    | Kestrel is removed, in custody or dead. Local control is handed over; Dacre gathers the remaining crews at the interchange.  |
| 14 · Threshold   | Above the last street    | The service lift carries the crew past the executive lockdown. Dacre joins Holt upstairs; earlier victories remain in force. |
| 15 · The Bench   | Off duty                 | The full crew comes home to a celebration with Voss and Quill. The district is free.                                         |

Kestrel's encounter is implemented in [Continuity](continuity.md): two storeys,
alternating local feeds, and a choice of arrest or lethal force. Her removal is
final in either outcome; she does not reappear as a later boss.

## The final encounter

[The Bench](bench.md) implements Dacre and Holt together in Crown Tower’s
penthouse. Dacre is a command marshal who signals visible retinue into crossfire
positions. His order takes two seconds and can be interrupted with damage or a
flash. It uses the position seen when the signal began; it cannot track an unseen
operative or summon replacement officers.

Holt has ordinary health. His protection is the sealed chamber and the remaining
defenders. Two operatives can open its distributed seals together, with a noisy
CUT fallback for a lone survivor. Once Dacre falls, Holt can be cuffed and escorted
upstairs, or explicitly killed. Extraction is the helicopter waiting on the roof.

The fixed ending includes all four operatives, Voss and Quill. The street turns
out to welcome the helicopter, there is food and a bottle at the safehouse, and
the team toasts the people they brought home. Quill’s line works for either Holt
outcome without specifying custody or death.
The payments, recall and local control stand. The future hearings remain, but
the scene ends on a shared victory, not another assignment or secret superior.
Neither cutscene viewing nor MINUTES is a prerequisite for winning or
understanding the operation.

## Implementation boundaries

Each mission's scene, concise briefing and epilogue live together in
`src/content/mission-copy.ts`. Shared speakers, settings and the opening are in
`src/content/story.ts`; the dialog is in `src/ui/story.ts`. Completion records
remain the source of truth for unlocks. Scenes do not read or save a winning cast
or Holt outcome. Obsolete `ending` fields are ignored when reading old records;
completion counts, times and medals are preserved.
`amortization.story.v1` stores only the IDs of scenes the player explicitly finished.

Story copy itself stays outside replay fingerprints. New mission definitions and
mechanics change their relevant fingerprints, while existing human runs remain verification
fixtures under the current rules. Scene art is decorative and captions are
accessible text. The first paint uses no image, font download, video, or audio.
