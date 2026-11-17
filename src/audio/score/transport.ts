import type { MusicMood, Score, ScoreNote } from './types';

export interface NoteVoice {
  retime(fromBeat: number): void;
  release(when: number): void;
}
interface Segment {
  beat: number;
  when: number;
  mood: MusicMood;
}
interface Playing {
  note: ScoreNote;
  start: number;
  voice: NoteVoice;
}
export const LOOK_AHEAD = 0.18;
const mask = (mood: MusicMood) => (mood === 'calm' ? 1 : 2);
const EPSILON = 1e-7;

/** One beat clock for both arrangements. Common notes are shared voices, not
 * phase-shifted copies; note ends and glides follow the same tempo boundary. */
export class Transport {
  private clock: Segment;
  private pending: Segment | null = null;
  private cursor: number;
  private active = new Map<string, Playing>();
  constructor(
    readonly score: Score,
    beat: number,
    when: number,
    mood: MusicMood,
    private play: (note: ScoreNote, startBeat: number, fromBeat: number, when: number) => NoteVoice,
  ) {
    this.clock = { beat, when, mood };
    this.cursor = beat;
    this.resume(beat, when, mood);
  }
  beatAt(when: number) {
    const clock = this.pending && when >= this.pending.when ? this.pending : this.clock;
    return clock.beat + (Math.max(0, when - clock.when) * this.score.bpm[clock.mood]) / 60;
  }
  readonly timeAt = (beat: number) => {
    const clock = this.pending && beat >= this.pending.beat ? this.pending : this.clock;
    return clock.when + ((beat - clock.beat) * 60) / this.score.bpm[clock.mood];
  };
  private moodAt(beat: number) {
    return this.pending && beat >= this.pending.beat ? this.pending.mood : this.clock.mood;
  }
  get transition() {
    return this.pending;
  }
  get activeNotes() {
    return this.active.size;
  }
  advance(now: number, desired: MusicMood) {
    if (this.pending && now >= this.pending.when && this.cursor > this.pending.beat) {
      this.clock = this.pending;
      this.pending = null;
    }
    // Commit only beyond the already scheduled audio window. A quickly cancelled
    // fight never rewrites native notes already handed to the audio thread.
    if (!this.pending && desired !== this.clock.mood) {
      const beat =
        Math.ceil((Math.max(this.cursor, this.beatAt(now + LOOK_AHEAD)) + EPSILON) / 4) * 4;
      this.pending = { beat, when: this.timeAt(beat), mood: desired };
    } else if (this.pending && desired === this.clock.mood && this.pending.beat >= this.cursor) {
      this.pending = null;
    }
    const horizon = this.beatAt(now + LOOK_AHEAD);
    // A stalled tab must skip missed percussion instead of spraying a backlog.
    if (this.timeAt(this.cursor) < now - LOOK_AHEAD) {
      for (const playing of this.active.values()) playing.voice.release(now);
      this.active.clear();
      this.cursor = this.beatAt(now + 0.02);
      if (this.pending && this.cursor >= this.pending.beat) {
        this.clock = this.pending;
        this.pending = null;
      }
      this.resume(this.cursor, now + 0.02, this.moodAt(this.cursor));
    }
    const boundary = this.pending;
    if (boundary && boundary.beat >= this.cursor && boundary.beat < horizon) {
      this.schedule(this.cursor, boundary.beat);
      this.releaseUntil(boundary.beat, now);
      // End only arrangement-specific voices. Common held notes and all delay
      // tails survive. Incoming held melody notes join at the current pitch.
      for (const [key, playing] of this.active) {
        if (!(playing.note.mask & mask(boundary.mood))) {
          playing.voice.release(boundary.when);
          this.active.delete(key);
        } else playing.voice.retime(boundary.beat);
      }
      this.resume(boundary.beat, boundary.when, boundary.mood);
      this.schedule(boundary.beat, horizon);
    } else this.schedule(this.cursor, horizon);
    this.cursor = Math.max(this.cursor, horizon);
    this.releaseUntil(horizon, now);
  }
  private releaseUntil(horizon: number, now: number) {
    for (const [key, playing] of this.active) {
      const end = playing.start + playing.note.duration;
      if (end < horizon) {
        playing.voice.release(Math.max(now, this.timeAt(end)));
        this.active.delete(key);
      }
    }
  }
  private schedule(from: number, to: number) {
    for (
      let cycle = Math.floor(from / this.score.beats);
      cycle <= Math.floor(to / this.score.beats);
      cycle++
    ) {
      this.score.notes.forEach((note, index) => {
        const start = cycle * this.score.beats + note.beat;
        if (start < from || start >= to || !(note.mask & mask(this.moodAt(start)))) return;
        const key = `${cycle}:${index}`;
        this.active.set(key, {
          note,
          start,
          voice: this.play(note, start, start, this.timeAt(start)),
        });
      });
    }
  }
  private resume(beat: number, when: number, mood: MusicMood) {
    // Rehydrate sustained pitched notes only, never a half-finished drum hit.
    for (const cycle of [
      Math.floor(beat / this.score.beats) - 1,
      Math.floor(beat / this.score.beats),
    ]) {
      this.score.notes.forEach((note, index) => {
        const start = cycle * this.score.beats + note.beat,
          key = `${cycle}:${index}`;
        if (
          cycle < 0 ||
          !note.pitch ||
          !(note.mask & mask(mood)) ||
          start >= beat ||
          start + note.duration <= beat ||
          this.active.has(key)
        )
          return;
        this.active.set(key, { note, start, voice: this.play(note, start, beat, when) });
      });
    }
  }
}
