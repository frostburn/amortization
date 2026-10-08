import { hold } from '../mixer';
import { Graph, createWaves } from './graph';
import { Transport } from './transport';
import type { MusicMood, Pitch, Score, ScoreNote } from './types';

export function pitchAt(pitch: Pitch, beat: number): number {
  let value = pitch.initial;
  for (const curve of pitch.curves) {
    if (beat < curve.offset) break;
    const position =
      Math.min(1, (beat - curve.offset) / curve.duration) * (curve.values.length - 1);
    const index = Math.floor(position),
      fraction = position - index;
    value =
      curve.values[index] * (1 - fraction) +
      curve.values[Math.min(index + 1, curve.values.length - 1)] * fraction;
  }
  return value;
}

/** A short look-ahead scheduler feeds native sources on the existing AudioContext.
 * No decoding, audio files, worklets, compiler or second context is required. */
export class ScorePlayer {
  readonly transport: Transport;
  private output: GainNode;
  private effect: Graph;
  private waves: PeriodicWave[];
  private voices = new Set<Graph>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private desired: MusicMood;
  constructor(
    private context: BaseAudioContext,
    destination: AudioNode,
    private score: Score,
    beat: number,
    mood: MusicMood,
    automatic = true,
  ) {
    this.desired = mood;
    this.output = context.createGain();
    this.output.gain.setValueAtTime(0, context.currentTime);
    this.output.connect(destination);
    this.waves = createWaves(context, score);
    this.effect = new Graph(context, score.effect, this.output, this.waves, context.currentTime);
    const when = context.currentTime + 0.04;
    this.output.gain.linearRampToValueAtTime(0.35, when + 0.025); // Xenpaper's session gain.
    // Resume callbacks need timeAt during construction, before this.transport
    // exists. Initial notes use the starting segment until it is assigned.
    this.transport = new Transport(score, beat, when, mood, (note, start, from, at) =>
      this.play(
        note,
        start,
        from,
        at,
        (b) => this.transport?.timeAt(b) ?? when + ((b - beat) * 60) / score.bpm[mood],
      ),
    );
    this.tick();
    if (automatic) this.timer = setInterval(() => this.tick(), 25);
  }
  get activeVoices() {
    return this.voices.size;
  }
  setMood(mood: MusicMood) {
    this.desired = mood;
  }
  tick(now = this.context.currentTime) {
    if (!this.stopped) this.transport.advance(now, this.desired);
  }
  private play(
    note: ScoreNote,
    start: number,
    from: number,
    when: number,
    timeAt: (beat: number) => number,
  ) {
    const gain = this.context.createGain();
    gain.connect(note.fx ? this.effect.nodes[this.score.effect.input] : this.output);
    const graph = new Graph(this.context, this.score.recipes[note.voice], gain, this.waves, when);
    this.voices.add(graph);
    graph.onended = () => {
      this.voices.delete(graph);
      gain.disconnect();
    };
    let initialPitch = true;
    const retime = (beat: number) => {
      if (!note.pitch) return;
      const param = graph.pitch.offset,
        at = timeAt(beat);
      param.cancelScheduledValues(at);
      const value = pitchAt(note.pitch, beat - start);
      if (initialPitch) param.setValueAtTime(value, at);
      else param.linearRampToValueAtTime(value, at);
      initialPitch = false;
      for (const curve of note.pitch.curves) {
        for (let i = 0; i < curve.values.length; i++) {
          const b = start + curve.offset + (curve.duration * i) / (curve.values.length - 1);
          if (b > beat && b <= start + note.duration)
            param.linearRampToValueAtTime(curve.values[i], timeAt(b));
        }
      }
    };
    retime(from);
    return { retime, release: (at: number) => graph.release(at) };
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    const now = this.context.currentTime;
    hold(this.output.gain, now);
    this.output.gain.linearRampToValueAtTime(0, now + 0.025);
    for (const voice of this.voices) voice.stop(now + 0.035);
    // Also tears down feedback loops and silent sources if the context suspends
    // before native ended events can be delivered.
    setTimeout(() => this.dispose(), 45);
  }
  dispose() {
    this.stopped = true;
    clearInterval(this.timer);
    for (const voice of this.voices) voice.dispose();
    this.effect.dispose();
    this.output.disconnect();
  }
}
