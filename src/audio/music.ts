import type { World } from '../sim/types';
import { controllable, living } from '../sim/types';
import { visualTheme } from '../render/theme';
import { hold } from './mixer';
import { beats, paddingSeconds, bpm } from '../../music/loop.json';

export type MusicMood = 'calm' | 'combat';
// The last 16 beats in the projects preview the return to the opening.
// The recordings contain one complete 224-beat cycle, with the delay tail wrapped.
export const MUSIC_BEATS = beats;
export const MUSIC_PADDING = paddingSeconds;
export const MUSIC_TRACKS = {
  calm: { bpm: bpm.calm, url: new URL('./tracks/negative-carry.mp3', import.meta.url).href },
  combat: {
    bpm: bpm.combat,
    url: new URL('./tracks/negative-carry-combat.mp3', import.meta.url).href,
  },
} as const;
const RELEASE_SECONDS = 10;
const CROSSFADE = 0.35;

/** An alarm can stay latched after a fight. Actual fire and an enemy pursuing a
 * living friendly drive the arrangement; merely investigating a noise does not. */
export class MusicDirector {
  private world: World | null = null;
  private shots = 0;
  private lastFight = -Infinity;
  update(world: World): MusicMood {
    if (this.world !== world) {
      this.world = world;
      this.shots = world.shots;
      this.lastFight = -Infinity;
    }
    const targets = new Set(world.agents.filter(controllable).map((a) => a.id));
    if (world.escort?.recruited && living(world.escort)) targets.add(world.escort.id);
    if (
      world.shots > this.shots ||
      world.guards.some((g) => living(g) && g.mode === 'combat' && targets.has(g.target ?? ''))
    )
      this.lastFight = world.time;
    this.shots = world.shots;
    return world.time - this.lastFight < RELEASE_SECONDS ? 'combat' : 'calm';
  }
}

interface Clock {
  beat: number;
  when: number;
  bpm: number;
  previous?: Clock;
}
interface MusicVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  mood: MusicMood;
  stopAt: number;
}
const beatAt = (clock: Clock, now: number): number =>
  now < clock.when
    ? clock.previous
      ? beatAt(clock.previous, now)
      : clock.beat
    : clock.beat + ((now - clock.when) * clock.bpm) / 60;

/** Native looping buffers keep music off the frame/physics clock. Pauses retain
 * the musical position; changes of arrangement retain it in beats, at each
 * recording's authored tempo. No Xenpaper parser or synthesizer ships at runtime. */
export class Music {
  private buffers = new Map<MusicMood, AudioBuffer>();
  private loading = new Set<MusicMood>();
  private failed = new Set<MusicMood>();
  private voices = new Set<MusicVoice>();
  private current: MusicVoice | null = null;
  private clock: Clock | null = null;
  private beat = 0;
  private active = false;
  private desired: MusicMood = 'calm';
  private director = new MusicDirector();
  constructor(
    private context: AudioContext,
    private output: AudioNode,
  ) {}
  retry() {
    this.failed.clear();
  }
  reset() {
    this.pause();
    this.beat = 0;
    this.director = new MusicDirector();
    this.retry();
  }
  update(world: World, running: boolean) {
    this.desired = this.director.update(world);
    if (!running || world.status !== 'playing' || visualTheme(world.mission) !== 'night') {
      this.pause();
      return;
    }
    this.active = true;
    // Load only on the first audible night mission. Preparing both arrangements
    // allows the first firefight to transition without another network wait.
    this.load(this.desired);
    this.load(this.desired === 'calm' ? 'combat' : 'calm');
    this.sync();
  }
  private load(mood: MusicMood) {
    if (this.buffers.has(mood) || this.loading.has(mood) || this.failed.has(mood)) return;
    this.loading.add(mood);
    void fetch(MUSIC_TRACKS[mood].url)
      .then((response) => {
        if (!response.ok) throw new Error(`Music download failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => this.context.decodeAudioData(bytes))
      .then((buffer) => {
        this.buffers.set(mood, buffer);
        // A download finishing after mute/pause/world replacement only caches
        // its buffer. sync consults the latest desired state before starting it.
        this.sync();
      })
      .catch(() => {
        // Keep effects and the other arrangement usable. Retry on sound enable
        // or a new attempt, never on every animation frame after a failed fetch.
        this.failed.add(mood);
      })
      .finally(() => this.loading.delete(mood));
  }
  private sync() {
    if (!this.active || this.context.state !== 'running') return;
    if (this.current?.mood === this.desired) return;
    const buffer = this.buffers.get(this.desired);
    if (!buffer) return;
    const now = this.context.currentTime,
      bpm = MUSIC_TRACKS[this.desired].bpm;
    let when = now + 0.02,
      beat = this.beat;
    if (this.clock) {
      // Start the incoming arrangement on the next bar, at the same score
      // position. Its 180/200 BPM recording plays at native speed and pitch.
      const position = beatAt(this.clock, now);
      beat = Math.ceil((position + 0.05) / 4) * 4;
      when = now + ((beat - position) * 60) / this.clock.bpm;
      if (now >= this.clock.when) delete this.clock.previous;
    }
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = MUSIC_PADDING;
    source.loopEnd = MUSIC_PADDING + (MUSIC_BEATS * 60) / bpm;
    source.connect(gain);
    gain.connect(this.output);
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(1, when + CROSSFADE);
    const voice: MusicVoice = { source, gain, mood: this.desired, stopAt: Infinity };
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    source.start(
      when,
      MUSIC_PADDING + ((((beat % MUSIC_BEATS) + MUSIC_BEATS) % MUSIC_BEATS) * 60) / bpm,
    );
    if (this.current) this.stop(this.current, when, CROSSFADE);
    this.voices.add(voice);
    this.current = voice;
    this.clock = { beat, when, bpm, ...(this.clock ? { previous: this.clock } : {}) };
  }
  private stop(voice: MusicVoice, when: number, fade: number) {
    const end = when + fade + 0.01;
    if (end >= voice.stopAt) return;
    hold(voice.gain.gain, when);
    voice.gain.gain.linearRampToValueAtTime(0, when + fade);
    voice.source.stop(end);
    voice.stopAt = end;
  }
  pause() {
    this.active = false;
    const now = this.context.currentTime;
    if (this.clock) this.beat = Math.max(0, beatAt(this.clock, now)) % MUSIC_BEATS;
    this.clock = null;
    this.current = null;
    // Includes an outgoing fade and a future source waiting for the next bar.
    for (const voice of this.voices) this.stop(voice, now, 0.025);
  }
}
