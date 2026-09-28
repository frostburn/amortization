import type { Vec } from '../sim/types';
import { project } from '../render/isometric';
import { loopSound, synthesize } from './palette';
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

const priority = (id: SoundId) =>
  ['alarm', 'complete', 'failed', 'charge', 'tracking'].includes(id)
    ? 4
    : ['blast', 'coil', 'wreck'].includes(id)
      ? 3
      : ['step', 'body', 'metal', 'fall'].includes(id)
        ? 0
        : 2;

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
  private compressor: DynamicsCompressorNode;
  private limiter: WaveShaperNode;
  private serial = 0;
  readonly maxVoices = 24;
  constructor(
    readonly context: BaseAudioContext,
    output: AudioNode = context.destination,
  ) {
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;
    this.limiter = context.createWaveShaper();
    this.limiter.curve = Float32Array.from({ length: 2049 }, (_, i) => {
      const x = i / 1024 - 1,
        a = Math.abs(x);
      return Math.sign(x) * (a < 0.65 ? a : 0.65 + 0.3 * Math.tanh((a - 0.65) / 0.3));
    });
    this.master.connect(this.compressor);
    this.compressor.connect(this.limiter);
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
        (a, b) => priority(a.id) - priority(b.id) || a.start - b.start,
      )[0];
      if (priority(victim.id) > priority(id)) return;
      this.stop(victim, when);
    }
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      pan = ctx.createStereoPanner(),
      filter = ctx.createBiquadFilter();
    const variant = options.variant ?? (loopSound(id) ? 0 : this.serial++ % 3);
    source.buffer = this.buffer(id, variant);
    source.loop = loopSound(id);
    source.playbackRate.value = options.rate ?? 1;
    filter.type = 'lowpass';
    filter.frequency.value = where.cutoff;
    filter.Q.value = 0.5;
    gain.gain.setValueAtTime(source.loop ? 0 : where.gain * (options.level ?? 1), when);
    if (source.loop) gain.gain.setTargetAtTime(where.gain * (options.level ?? 1), when, 0.025);
    pan.pan.value = where.pan;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.master);
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
        gain: where.gain * (options.level ?? 1),
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
    return voice;
  }
  position(voice: Voice, where: Placement, level = 1, rate = 1) {
    if (voice.stopped) return;
    const now = this.context.currentTime;
    const targets = { gain: where.gain * level, pan: where.pan, cutoff: where.cutoff, rate };
    const parameters = {
      gain: voice.gain.gain,
      pan: voice.pan.pan,
      cutoff: voice.filter.frequency,
      rate: voice.source.playbackRate,
    };
    for (const key of ['gain', 'pan', 'cutoff', 'rate'] as const) {
      if (targets[key] === voice.targets[key]) continue;
      const param = parameters[key];
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
      else {
        // Some Web Audio implementations lack cancelAndHoldAtTime. Preserve
        // the current rendered value before replacing their automation.
        const value = param.value;
        param.cancelScheduledValues(now);
        param.setValueAtTime(value, now);
      }
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
  }
  dispose() {
    this.silence();
    this.master.disconnect();
    this.compressor.disconnect();
    this.limiter.disconnect();
  }
}
