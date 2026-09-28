// Original, deterministic PCM recipes. The mixer caches these buffers instead
// of generating fresh noise and oscillator graphs for every gunshot.
import { clockedNoise } from './noise';

const durations = {
  pistol: 0.38,
  carbine: 0.5,
  shotgun: 0.75,
  automatic: 0.23,
  coil: 0.8,
  step: 0.16,
  body: 0.18,
  metal: 0.36,
  fall: 0.4,
  wreck: 0.65,
  reload: 0.5,
  ready: 0.18,
  relay: 0.65,
  breaker: 0.6,
  door: 0.7,
  pickup: 0.28,
  cloth: 0.35,
  heal: 0.5,
  terminal: 0.3,
  radio: 0.5,
  alarm: 0.95,
  blast: 1.3,
  confirm: 0.12,
  complete: 1.4,
  failed: 1.25,
  charge: 1,
  tracking: 1,
} as const;
export type SoundId = keyof typeof durations;
export const SOUND_IDS = Object.keys(durations) as SoundId[];
export const loopSound = (id: SoundId) => id === 'charge' || id === 'tracking';

export function synthesize(id: SoundId, sampleRate: number, variant = 0): Float32Array {
  const duration = durations[id];
  const data = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = 104729 + SOUND_IDS.indexOf(id) * 7919 + variant * 65537;
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
  if (loopSound(id)) {
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      if (id === 'charge')
        data[i] =
          0.16 * Math.sin(2 * Math.PI * 220 * t + 1.6 * Math.sin(2 * Math.PI * 55 * t)) +
          0.035 * Math.sin(2 * Math.PI * 1320 * t);
      else
        data[i] =
          (0.035 * Math.sin(2 * Math.PI * 760 * t) + 0.02 * Math.sin(2 * Math.PI * 1140 * t)) *
          Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * 8 * t), 4);
    }
    // Electrical loops have integer cycles, keeping their phase continuous.
    return data;
  }
  switch (id) {
    case 'pistol':
      noise(0, 0.065, 850, 8200, 0.85, 9, { rate: 16000, interpolation: 'constant' });
      tone(0, 0.15, 210, 72, 0.55);
      noise(0.017, 0.18, 250, 2400, 0.25, 6, { rate: 4200, modulation: 0.35, sweep: 0.5 });
      click(0.055, 0.13, 1300);
      // A tiny, damped contact: no falling-pitch casing whistle.
      noise(0.15, 0.018, 1100, 4300, 0.028, 7, { rate: 6400, interpolation: 'constant' });
      break;
    case 'carbine':
      noise(0, 0.055, 1800, 11000, 1.05, 8, { rate: 19500, interpolation: 'constant' });
      tone(0, 0.22, 190, 48, 0.7);
      noise(0.008, 0.28, 170, 3600, 0.48, 6, { rate: 6600, modulation: 0.5, sweep: 0.6 });
      click(0.105, 0.28, 1300);
      break;
    case 'shotgun':
      noise(0, 0.12, 450, 6800, 1.05, 6, {
        rate: 12000,
        interpolation: 'constant',
        modulation: 0.3,
      });
      tone(0, 0.36, 120, 38, 0.9, 5);
      noise(0.018, 0.38, 90, 1800, 0.64, 7, { rate: 2800, modulation: 0.65, sweep: 0.3 });
      noise(0.32, 0.13, 500, 3200, 0.3, 2, { rate: 3600, modulation: 0.75 });
      click(0.34, 0.25, 700);
      click(0.48, 0.35, 1100);
      break;
    case 'automatic':
      noise(0, 0.042, 1350, 7800, 0.7, 8, { rate: 14500, interpolation: 'constant' });
      tone(0, 0.095, 270, 120, 0.4);
      noise(0.012, 0.1, 500, 3900, 0.25);
      click(0.049, 0.22, 1900);
      break;
    case 'coil':
      noise(0, 0.045, 2200, 14000, 1.1, 10, { rate: 20000, interpolation: 'constant' });
      tone(0, 0.23, 105, 36, 0.76);
      tone(0, 0.085, 3600, 280, 0.25, 7);
      tone(0.025, 0.55, 1580, 1560, 0.11, 6, 0.45);
      noise(0.03, 0.42, 450, 4000, 0.3, 6, { rate: 6800, modulation: 0.45, sweep: 0.4 });
      click(0.2, 0.13, 820);
      break;
    case 'step':
      tone(0, 0.08, 95, 45, 0.12);
      noise(0, 0.065, 65, 650, 0.16, 6, { rate: 900, modulation: 0.3 });
      noise(0.024, 0.11, 160, 850, 0.055, 4, { rate: 1200, modulation: 0.6 });
      break;
    case 'body':
      tone(0, 0.11, 110, 52, 0.3);
      noise(0, 0.1, 160, 2200, 0.4);
      break;
    case 'metal':
      click(0, 0.55, 3200);
      tone(0.002, 0.3, 1810, 1785, 0.15, 7, 0.8);
      break;
    case 'fall':
      tone(0, 0.21, 92, 32, 0.3);
      noise(0.015, 0.3, 80, 1600, 0.4, 4);
      break;
    case 'wreck':
      tone(0, 0.35, 120, 35, 0.5);
      noise(0, 0.3, 100, 5000, 0.65);
      click(0.16, 0.28, 780);
      click(0.28, 0.18, 530);
      break;
    case 'reload':
      click(0, 0.24, 900);
      noise(0.08, 0.22, 450, 2800, 0.12, 2, { rate: 2100, modulation: 0.75 });
      click(0.3, 0.27, 1500);
      break;
    case 'ready':
      click(0, 0.35, 1200);
      click(0.045, 0.22, 2100);
      break;
    case 'relay':
      noise(0, 0.42, 600, 3800, 0.3, 2);
      tone(0, 0.48, 1800, 80, 0.12, 3);
      click(0.44, 0.25, 800);
      break;
    case 'breaker':
      tone(0, 0.23, 155, 50, 0.5);
      click(0, 0.4, 450);
      noise(0.04, 0.2, 1500, 8000, 0.2);
      tone(0.07, 0.45, 310, 40, 0.13, 5, 0.2);
      break;
    case 'door':
      click(0, 0.27, 600);
      noise(0.045, 0.44, 120, 1800, 0.28, 1.5, { rate: 1100, modulation: 0.8 });
      tone(0.045, 0.45, 115, 70, 0.1, 1);
      click(0.47, 0.3, 440);
      break;
    case 'pickup':
      noise(0, 0.16, 250, 4000, 0.14, 3);
      click(0.11, 0.22, 1100);
      break;
    case 'cloth':
      noise(0, 0.19, 500, 3200, 0.16, 2, { rate: 2800, modulation: 0.7 });
      noise(0.14, 0.18, 250, 2300, 0.12, 3, { rate: 1900, modulation: 0.6 });
      break;
    case 'heal':
      noise(0, 0.22, 600, 3600, 0.18, 2, { rate: 3800, modulation: 0.8 });
      noise(0.2, 0.18, 300, 2100, 0.12, 2, { rate: 1700, modulation: 0.6 });
      tone(0.3, 0.12, 740, 740, 0.045);
      break;
    case 'terminal':
      click(0, 0.09);
      tone(0.035, 0.12, 520, 520, 0.08);
      tone(0.115, 0.14, 780, 780, 0.07);
      break;
    case 'radio':
      noise(0, 0.16, 600, 3600, 0.27, 4, {
        rate: 6500,
        interpolation: 'constant',
        modulation: 0.4,
      });
      tone(0.08, 0.13, 1230, 1230, 0.07);
      noise(0.21, 0.2, 450, 3300, 0.2, 3, { rate: 4200, modulation: 0.6 });
      break;
    case 'alarm':
      for (const at of [0, 0.29]) {
        tone(at, 0.24, 420, 510, 0.2, 1.2, 0.2);
        noise(at, 0.08, 750, 3300, 0.13);
      }
      tone(0.62, 0.25, 290, 290, 0.13, 2);
      break;
    case 'blast':
      noise(0, 0.08, 900, 10000, 1, 8, { rate: 19000, interpolation: 'constant' });
      tone(0, 0.6, 95, 26, 0.9, 7);
      noise(0.015, 0.95, 35, 1300, 1, 6, { rate: 1900, modulation: 0.8, sweep: 0.25 });
      noise(0.12, 0.85, 300, 3000, 0.22, 5, { rate: 3200, modulation: 0.7, sweep: 0.4 });
      click(0.28, 0.16, 600);
      click(0.46, 0.12, 920);
      break;
    case 'confirm':
      click(0, 0.07);
      tone(0.01, 0.09, 550, 690, 0.08, 4);
      break;
    case 'complete':
      click(0, 0.18, 900);
      for (const [at, frequency] of [
        [0.12, 330],
        [0.3, 440],
        [0.52, 660],
      ])
        tone(at, 0.7, frequency, frequency, 0.12, 5, 0.06);
      break;
    case 'failed':
      tone(0, 0.85, 220, 87, 0.2, 4, 0.2);
      noise(0.04, 0.95, 100, 1800, 0.14, 5);
      break;
  }
  // A little filtered early reflection gives guns weight, without a long wash
  // masking rapid fire or danger cues. Copy the dry signal so echoes don't feed back.
  if (['pistol', 'carbine', 'shotgun', 'automatic', 'coil', 'blast'].includes(id)) {
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
  if (id === 'step') {
    // Bake a two-pole low-pass into every footstep, even at the listener's feet.
    const alpha = 1 - Math.exp((-2 * Math.PI * 850) / sampleRate);
    let first = 0,
      second = 0;
    for (let i = 0; i < data.length; i++) {
      first += alpha * (data[i] - first);
      second += alpha * (first - second);
      data[i] = second;
    }
  }
  let peak = 0;
  for (const sample of data) peak = Math.max(peak, Math.abs(sample));
  const trim = Math.min(1, 0.92 / peak),
    fade = Math.ceil(sampleRate * 0.008);
  for (let i = 0; i < data.length; i++) data[i] *= trim * Math.min(1, (data.length - 1 - i) / fade);
  return data;
}
