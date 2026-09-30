import type { Vec } from '../sim/types';
import { project } from '../render/isometric';
import { loopSound, mixGain, soundDefinition, synthesize } from './palette';
import type { SoundId } from './palette';

export interface ListeningView {
  centre: Vec;
  width: number;
  scale: number;
}
export interface Placement {
  pan: number;
  gain: number;
  cutoff: number;
}
export const centred: Placement = { pan: 0, gain: 1, cutoff: 16000 };

/** Stereo follows the isometric screen; distance follows the camera's ground
 * position, so zooming does not turn a nearby shot into a louder explosion. */
export function placement(point: Vec, view: ListeningView): Placement {
  const dx = point.x - view.centre.x,
    dy = point.y - view.centre.y;
  const distance = Math.hypot(dx, dy);
  return {
    pan: Math.max(
      -0.85,
      Math.min(0.85, (project({ x: dx, y: dy }).x * view.scale) / Math.max(1, view.width * 0.5)),
    ),
    gain: 1 / (1 + (distance / 12) ** 2),
    cutoff: Math.max(1800, 14000 / (1 + distance / 12)),
  };
}

const COMBAT_LEVEL = 0.66;

function hold(param: AudioParam, when: number) {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(when);
  else {
    const value = param.value;
    param.cancelScheduledValues(when);
    param.setValueAtTime(value, when);
  }
}

export interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  pan: StereoPannerNode;
  filter: BiquadFilterNode;
  id: SoundId;
  start: number;
  end: number;
  stopped: boolean;
  targets: { gain: number; pan: number; cutoff: number; rate: number };
}

export class Mixer {
  private bank = new Map<string, AudioBuffer>();
  private voices = new Set<Voice>();
  private master: GainNode;
  private feedback: DynamicsCompressorNode;
  private combat: DynamicsCompressorNode;
  private combatGain: GainNode;
  private limiter: WaveShaperNode;
  private serial = 0;
  readonly maxVoices = 24;
  constructor(
    readonly context: BaseAudioContext,
    output: AudioNode = context.destination,
  ) {
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.feedback = context.createDynamicsCompressor();
    this.feedback.threshold.value = -16;
    this.feedback.knee.value = 10;
    this.feedback.ratio.value = 6;
    this.feedback.attack.value = 0.003;
    this.feedback.release.value = 0.18;
    // Compress the sum of gunfire/impacts without pulling down mission cues.
    this.combat = context.createDynamicsCompressor();
    this.combat.threshold.value = -24;
    this.combat.knee.value = 6;
    this.combat.ratio.value = 16;
    this.combat.attack.value = 0.001;
    this.combat.release.value = 0.09;
    this.combatGain = context.createGain();
    this.combatGain.gain.value = COMBAT_LEVEL;
    this.limiter = context.createWaveShaper();
    this.limiter.curve = Float32Array.from({ length: 2049 }, (_, i) => {
      const x = i / 1024 - 1,
        a = Math.abs(x);
      return Math.sign(x) * (a < 0.65 ? a : 0.65 + 0.3 * Math.tanh((a - 0.65) / 0.3));
    });
    this.combat.connect(this.combatGain);
    this.combatGain.connect(this.master);
    this.feedback.connect(this.master);
    // Master volume follows dynamics, preserving the mix at low slider levels.
    this.master.connect(this.limiter);
    this.limiter.connect(output);
  }
  get activeVoices() {
    return [...this.voices].filter((v) => !v.stopped).length;
  }
  get cachedBuffers() {
    return this.bank.size;
  }
  volume(value: number, fade = 0.02) {
    const gain = this.master.gain,
      now = this.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(value * value * 0.85, now, fade);
  }
  buffer(id: SoundId, variant: number): AudioBuffer {
    const key = `${id}:${variant}`;
    let buffer = this.bank.get(key);
    if (!buffer) {
      const sampleRate = this.context.sampleRate;
      const pcm = synthesize(id, sampleRate, variant);
      buffer = this.context.createBuffer(1, pcm.length, sampleRate);
      buffer.getChannelData(0).set(pcm);
      this.bank.set(key, buffer);
    }
    return buffer;
  }
  play(
    id: SoundId,
    where = centred,
    options: { when?: number; level?: number; rate?: number; variant?: number } = {},
  ): Voice | undefined {
    if (where.gain < 0.015) return;
    const ctx = this.context,
      when = options.when ?? ctx.currentTime;
    const overlapping = [...this.voices].filter(
      (v) => !v.stopped && v.start <= when && v.end > when,
    );
    if (overlapping.length >= this.maxVoices) {
      const victim = overlapping.sort(
        (a, b) =>
          soundDefinition(a.id).priority - soundDefinition(b.id).priority || a.start - b.start,
      )[0];
      if (soundDefinition(victim.id).priority > soundDefinition(id).priority) return;
      this.stop(victim, when);
    }
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      pan = ctx.createStereoPanner(),
      filter = ctx.createBiquadFilter();
    const variant = options.variant ?? (loopSound(id) ? 0 : this.serial++ % 3),
      level = where.gain * (options.level ?? 1) * mixGain(id);
    source.buffer = this.buffer(id, variant);
    source.loop = loopSound(id);
    source.playbackRate.value = options.rate ?? 1;
    filter.type = 'lowpass';
    filter.frequency.value = where.cutoff;
    filter.Q.value = 0.5;
    gain.gain.setValueAtTime(source.loop ? 0 : level, when);
    if (source.loop) gain.gain.setTargetAtTime(level, when, 0.025);
    pan.pan.value = where.pan;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(soundDefinition(id).bus === 'combat' ? this.combat : this.feedback);
    const voice: Voice = {
      source,
      gain,
      pan,
      filter,
      id,
      start: when,
      end: source.loop ? Infinity : when + source.buffer.duration / source.playbackRate.value,
      stopped: false,
      targets: {
        gain: level,
        pan: where.pan,
        cutoff: where.cutoff,
        rate: options.rate ?? 1,
      },
    };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      pan.disconnect();
      this.voices.delete(voice);
    };
    source.start(when);
    if (soundDefinition(id).duckCombat) this.duckCombat(when);
    return voice;
  }
  private duckCombat(when: number) {
    const gain = this.combatGain.gain;
    hold(gain, when);
    gain.setTargetAtTime(COMBAT_LEVEL * 0.35, when, 0.005);
    gain.setValueAtTime(COMBAT_LEVEL * 0.35, when + 0.35);
    gain.setTargetAtTime(COMBAT_LEVEL, when + 0.35, 0.12);
  }
  position(voice: Voice, where: Placement, level = 1, rate = 1) {
    if (voice.stopped) return;
    const now = this.context.currentTime;
    const targets = {
      gain: where.gain * level * mixGain(voice.id),
      pan: where.pan,
      cutoff: where.cutoff,
      rate,
    };
    const parameters = {
      gain: voice.gain.gain,
      pan: voice.pan.pan,
      cutoff: voice.filter.frequency,
      rate: voice.source.playbackRate,
    };
    for (const key of ['gain', 'pan', 'cutoff', 'rate'] as const) {
      if (targets[key] === voice.targets[key]) continue;
      const param = parameters[key];
      hold(param, now);
      param.setTargetAtTime(targets[key], now, 0.04);
    }
    voice.targets = targets;
  }
  stop(voice: Voice, when = this.context.currentTime) {
    if (voice.stopped) return;
    voice.stopped = true;
    voice.end = Math.min(voice.end, when + 0.015);
    voice.gain.gain.cancelScheduledValues(when);
    voice.gain.gain.setTargetAtTime(0, when, 0.004);
    voice.source.stop(Math.max(when + 0.015, voice.start));
  }
  silence() {
    for (const voice of this.voices) this.stop(voice);
    this.combatGain.gain.cancelScheduledValues(this.context.currentTime);
    this.combatGain.gain.setTargetAtTime(COMBAT_LEVEL, this.context.currentTime, 0.02);
  }
  dispose() {
    this.silence();
    this.master.disconnect();
    this.feedback.disconnect();
    this.combat.disconnect();
    this.combatGain.disconnect();
    this.limiter.disconnect();
  }
}
