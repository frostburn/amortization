// Shared deterministic PCM primitives. Authored recipes and their playback
// settings live together in palette.ts.
import { clockedNoise } from './noise';

export function synthesis(duration: number, sampleRate: number, seedId: number, variant: number) {
  const data = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 104729 + seedId * 7919 + variant * 65537;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 2147483648 - 1;
  };
  const tuning = 1 + (variant - 1) * 0.018;
  const envelope = (t: number, length: number, decay: number) =>
    Math.min(1, t / 0.001) * Math.exp((-t / length) * decay) * Math.min(1, (length - t) / 0.008);
  function tone(
    start: number,
    length: number,
    from: number,
    to: number,
    gain: number,
    decay = 5,
    ring = 0,
  ) {
    let phase = 0;
    const offset = Math.round(start * sampleRate),
      count = Math.min(data.length - offset, Math.ceil(length * sampleRate));
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate;
      phase +=
        (2 * Math.PI * tuning * (to + (from - to) * Math.exp((-t / length) * 8))) / sampleRate;
      data[offset + i] +=
        (Math.sin(phase) + ring * Math.sin(phase * 2.73)) * gain * envelope(t, length, decay);
    }
  }
  function noise(
    start: number,
    length: number,
    low: number,
    high: number,
    gain: number,
    decay = 6,
    texture: {
      rate?: number;
      interpolation?: 'constant' | 'linear';
      modulation?: number;
      sweep?: number;
    } = {},
  ) {
    let smooth = 0,
      rounded = 0,
      bass = 0;
    const source = clockedNoise(random, sampleRate, texture.interpolation),
      drift = clockedNoise(random, sampleRate),
      rate = (texture.rate ?? high * 1.4) * tuning;
    const hi = 1 - Math.exp((-2 * Math.PI * Math.min(high, sampleRate * 0.45)) / sampleRate);
    const lo = 1 - Math.exp((-2 * Math.PI * low) / sampleRate);
    const offset = Math.round(start * sampleRate),
      count = Math.min(data.length - offset, Math.ceil(length * sampleRate));
    for (let i = 0; i < count; i++) {
      const t = i / sampleRate,
        clock =
          rate *
          (1 + (texture.modulation ?? 0) * drift(37)) *
          (1 + (((texture.sweep ?? 1) - 1) * t) / length);
      smooth += hi * (source(clock) - smooth);
      rounded += hi * (smooth - rounded);
      bass += lo * (rounded - bass);
      data[offset + i] += (rounded - bass) * gain * envelope(t, length, decay);
    }
  }
  const click = (at: number, gain: number, pitch = 1800) => {
    noise(at, 0.025, pitch * 0.35, Math.max(2500, pitch * 2.2), gain, 7, {
      rate: pitch * 3.5,
      interpolation: 'constant',
      modulation: 0.3,
    });
    tone(at, 0.018, pitch, pitch, gain * 0.1, 7, 0.25);
  };

  return { data, sampleRate, tone, noise, click };
}
export type Synthesis = ReturnType<typeof synthesis>;

export function reflect(data: Float32Array, sampleRate: number) {
  // Copy the dry signal so early reflections do not feed back.
  const dry = data.slice();
  for (const [seconds, level] of [
    [0.031, 0.09],
    [0.067, 0.045],
  ]) {
    const offset = Math.round(seconds * sampleRate);
    let reflection = 0;
    for (let i = offset; i < data.length; i++) {
      reflection += 0.18 * (dry[i - offset] - reflection);
      data[i] += reflection * level;
    }
  }
}

export function lowpass(data: Float32Array, sampleRate: number, cutoff: number) {
  // Bake a two-pole low-pass into the clip, independent of listener distance.
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  let first = 0,
    second = 0;
  for (let i = 0; i < data.length; i++) {
    first += alpha * (data[i] - first);
    second += alpha * (first - second);
    data[i] = second;
  }
}

export function finish(data: Float32Array, sampleRate: number) {
  let peak = 0;
  for (const sample of data) peak = Math.max(peak, Math.abs(sample));
  const trim = Math.min(1, 0.92 / peak),
    fade = Math.ceil(sampleRate * 0.008);
  for (let i = 0; i < data.length; i++) data[i] *= trim * Math.min(1, (data.length - 1 - i) / fade);
  return data;
}
