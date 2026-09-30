// Original deterministic PCM recipes, each beside its duration and mix settings.
import { finish, lowpass, reflect, synthesis } from './synthesis';
import type { Synthesis } from './synthesis';
import { typingSounds } from './typing';

interface SoundDefinition {
  duration: number;
  decibels: number;
  /** Stable variation seed: reordering or inserting cues must not retune others. */
  seed: number;
  priority: number;
  bus: 'combat' | 'feedback';
  loop?: boolean;
  duckCombat?: boolean;
  reflections?: boolean;
  lowpass?: number;
  render: (voice: Synthesis) => void;
}

const terminalTone = ({ tone, click }: Synthesis) => {
  click(0, 0.09);
  tone(0.035, 0.12, 520, 520, 0.08);
  tone(0.115, 0.14, 780, 780, 0.07);
};

// Faders follow synthesis, before spatial/context gain and compression. Compare
// weapons at firing cadence and warnings over their entire lock, not sample peaks.
const sounds = {
  ...typingSounds,
  pistol: {
    duration: 0.38,
    decibels: 0,
    seed: 0,
    priority: 2,
    bus: 'combat',
    reflections: true,
    render({ tone, noise, click }) {
      noise(0, 0.065, 850, 8200, 0.85, 9, { rate: 16000, interpolation: 'constant' });
      tone(0, 0.15, 210, 72, 0.55);
      noise(0.017, 0.18, 250, 2400, 0.25, 6, { rate: 4200, modulation: 0.35, sweep: 0.5 });
      click(0.055, 0.13, 1300);
      // A tiny, damped contact: no falling-pitch casing whistle.
      noise(0.15, 0.018, 1100, 4300, 0.028, 7, { rate: 6400, interpolation: 'constant' });
    },
  },
  carbine: {
    duration: 0.5,
    decibels: -1.5,
    seed: 1,
    priority: 2,
    bus: 'combat',
    reflections: true,
    render({ tone, noise, click }) {
      noise(0, 0.055, 1800, 11000, 1.05, 8, { rate: 19500, interpolation: 'constant' });
      tone(0, 0.22, 190, 48, 0.7);
      noise(0.008, 0.28, 170, 3600, 0.48, 6, { rate: 6600, modulation: 0.5, sweep: 0.6 });
      click(0.105, 0.28, 1300);
    },
  },
  shotgun: {
    duration: 0.75,
    decibels: -1.5,
    seed: 2,
    priority: 2,
    bus: 'combat',
    reflections: true,
    render({ tone, noise, click }) {
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
    },
  },
  automatic: {
    duration: 0.23,
    decibels: 0,
    seed: 3,
    priority: 2,
    bus: 'combat',
    reflections: true,
    render({ tone, noise, click }) {
      noise(0, 0.042, 1350, 7800, 0.7, 8, { rate: 14500, interpolation: 'constant' });
      tone(0, 0.095, 270, 120, 0.4);
      noise(0.012, 0.1, 500, 3900, 0.25);
      click(0.049, 0.22, 1900);
    },
  },
  coil: {
    duration: 0.8,
    decibels: 0.5,
    seed: 4,
    priority: 3,
    bus: 'combat',
    reflections: true,
    render({ tone, noise, click }) {
      noise(0, 0.045, 2200, 14000, 1.1, 10, { rate: 20000, interpolation: 'constant' });
      tone(0, 0.23, 105, 36, 0.76);
      tone(0, 0.085, 3600, 280, 0.25, 7);
      tone(0.025, 0.55, 1580, 1560, 0.11, 6, 0.45);
      noise(0.03, 0.42, 450, 4000, 0.3, 6, { rate: 6800, modulation: 0.45, sweep: 0.4 });
      click(0.2, 0.13, 820);
    },
  },
  step: {
    duration: 0.16,
    decibels: 0,
    seed: 5,
    priority: 0,
    bus: 'feedback',
    lowpass: 850,
    render({ tone, noise }) {
      tone(0, 0.08, 95, 45, 0.12);
      noise(0, 0.065, 65, 650, 0.16, 6, { rate: 900, modulation: 0.3 });
      noise(0.024, 0.11, 160, 850, 0.055, 4, { rate: 1200, modulation: 0.6 });
    },
  },
  body: {
    duration: 0.18,
    decibels: 0,
    seed: 6,
    priority: 0,
    bus: 'combat',
    render({ tone, noise }) {
      tone(0, 0.11, 110, 52, 0.3);
      noise(0, 0.1, 160, 2200, 0.4);
    },
  },
  metal: {
    duration: 0.36,
    decibels: 0,
    seed: 7,
    priority: 0,
    bus: 'combat',
    render({ tone, click }) {
      click(0, 0.55, 3200);
      tone(0.002, 0.3, 1810, 1785, 0.15, 7, 0.8);
    },
  },
  fall: {
    duration: 0.4,
    decibels: -2,
    seed: 8,
    priority: 0,
    bus: 'combat',
    render({ tone, noise }) {
      tone(0, 0.21, 92, 32, 0.3);
      noise(0.015, 0.3, 80, 1600, 0.4, 4);
    },
  },
  wreck: {
    duration: 0.65,
    decibels: -3.5,
    seed: 9,
    priority: 3,
    bus: 'combat',
    render({ tone, noise, click }) {
      tone(0, 0.35, 120, 35, 0.5);
      noise(0, 0.3, 100, 5000, 0.65);
      click(0.16, 0.28, 780);
      click(0.28, 0.18, 530);
    },
  },
  reload: {
    duration: 0.5,
    decibels: 9,
    seed: 10,
    priority: 2,
    bus: 'feedback',
    render({ noise, click }) {
      click(0, 0.24, 900);
      noise(0.08, 0.22, 450, 2800, 0.12, 2, { rate: 2100, modulation: 0.75 });
      click(0.3, 0.27, 1500);
    },
  },
  ready: {
    duration: 0.18,
    decibels: 10,
    seed: 11,
    priority: 2,
    bus: 'feedback',
    render({ click }) {
      click(0, 0.35, 1200);
      click(0.045, 0.22, 2100);
    },
  },
  relay: {
    duration: 0.65,
    decibels: -9,
    seed: 12,
    priority: 2,
    bus: 'feedback',
    render({ tone, noise, click }) {
      noise(0, 0.42, 600, 3800, 0.3, 2);
      tone(0, 0.48, 1800, 80, 0.12, 3);
      click(0.44, 0.25, 800);
    },
  },
  breaker: {
    duration: 0.6,
    decibels: -11,
    seed: 13,
    priority: 2,
    bus: 'feedback',
    render({ tone, noise, click }) {
      tone(0, 0.23, 155, 50, 0.5);
      click(0, 0.4, 450);
      noise(0.04, 0.2, 1500, 8000, 0.2);
      tone(0.07, 0.45, 310, 40, 0.13, 5, 0.2);
    },
  },
  door: {
    duration: 0.7,
    decibels: -9,
    seed: 14,
    priority: 2,
    bus: 'feedback',
    render({ tone, noise, click }) {
      click(0, 0.27, 600);
      noise(0.045, 0.44, 120, 1800, 0.28, 1.5, { rate: 1100, modulation: 0.8 });
      tone(0.045, 0.45, 115, 70, 0.1, 1);
      click(0.47, 0.3, 440);
    },
  },
  pickup: {
    duration: 0.28,
    decibels: 1,
    seed: 15,
    priority: 2,
    bus: 'feedback',
    render({ noise, click }) {
      noise(0, 0.16, 250, 4000, 0.14, 3);
      click(0.11, 0.22, 1100);
    },
  },
  cloth: {
    duration: 0.35,
    decibels: 0,
    seed: 16,
    priority: 2,
    bus: 'feedback',
    render({ noise }) {
      noise(0, 0.19, 500, 3200, 0.16, 2, { rate: 2800, modulation: 0.7 });
      noise(0.14, 0.18, 250, 2300, 0.12, 3, { rate: 1900, modulation: 0.6 });
    },
  },
  heal: {
    duration: 0.5,
    decibels: -1.5,
    seed: 17,
    priority: 2,
    bus: 'feedback',
    render({ tone, noise }) {
      noise(0, 0.22, 600, 3600, 0.18, 2, { rate: 3800, modulation: 0.8 });
      noise(0.2, 0.18, 300, 2100, 0.12, 2, { rate: 1700, modulation: 0.6 });
      tone(0.3, 0.12, 740, 740, 0.045);
    },
  },
  terminal: {
    duration: 0.3,
    decibels: 2,
    seed: 18,
    priority: 2,
    bus: 'feedback',
    render: terminalTone,
  },
  radio: {
    duration: 0.5,
    decibels: 2.5,
    seed: 19,
    priority: 2,
    bus: 'feedback',
    render({ tone, noise }) {
      noise(0, 0.16, 600, 3600, 0.27, 4, {
        rate: 6500,
        interpolation: 'constant',
        modulation: 0.4,
      });
      tone(0.08, 0.13, 1230, 1230, 0.07);
      noise(0.21, 0.2, 450, 3300, 0.2, 3, { rate: 4200, modulation: 0.6 });
    },
  },
  alarm: {
    duration: 0.95,
    decibels: -5,
    seed: 20,
    priority: 4,
    bus: 'feedback',
    render({ tone, noise }) {
      for (const at of [0, 0.29]) {
        tone(at, 0.24, 420, 510, 0.2, 1.2, 0.2);
        noise(at, 0.08, 750, 3300, 0.13);
      }
      tone(0.62, 0.25, 290, 290, 0.13, 2);
    },
  },
  blast: {
    duration: 1.3,
    decibels: -3,
    seed: 21,
    priority: 3,
    bus: 'combat',
    reflections: true,
    render({ tone, noise, click }) {
      noise(0, 0.08, 900, 10000, 1, 8, { rate: 19000, interpolation: 'constant' });
      tone(0, 0.6, 95, 26, 0.9, 7);
      noise(0.015, 0.95, 35, 1300, 1, 6, { rate: 1900, modulation: 0.8, sweep: 0.25 });
      noise(0.12, 0.85, 300, 3000, 0.22, 5, { rate: 3200, modulation: 0.7, sweep: 0.4 });
      click(0.28, 0.16, 600);
      click(0.46, 0.12, 920);
    },
  },
  confirm: {
    duration: 0.12,
    decibels: 0,
    seed: 22,
    priority: 2,
    bus: 'feedback',
    render({ tone, click }) {
      click(0, 0.07);
      tone(0.01, 0.09, 550, 690, 0.08, 4);
    },
  },
  complete: {
    duration: 1.4,
    decibels: -2,
    seed: 23,
    priority: 4,
    bus: 'feedback',
    duckCombat: true,
    render({ tone, click }) {
      click(0, 0.18, 900);
      for (const [at, frequency] of [
        [0.12, 330],
        [0.3, 440],
        [0.52, 660],
      ])
        tone(at, 0.7, frequency, frequency, 0.12, 5, 0.06);
    },
  },
  failed: {
    duration: 1.25,
    decibels: -6.5,
    seed: 24,
    priority: 4,
    bus: 'feedback',
    duckCombat: true,
    render({ tone, noise }) {
      tone(0, 0.85, 220, 87, 0.2, 4, 0.2);
      noise(0.04, 0.95, 100, 1800, 0.14, 5);
    },
  },
  charge: {
    duration: 1,
    decibels: -7,
    seed: 25,
    priority: 4,
    bus: 'feedback',
    loop: true,
    render({ data, sampleRate }) {
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        data[i] =
          0.16 * Math.sin(2 * Math.PI * 220 * t + 1.6 * Math.sin(2 * Math.PI * 55 * t)) +
          0.035 * Math.sin(2 * Math.PI * 1320 * t);
      }
    },
  },
  tracking: {
    duration: 1,
    decibels: 8,
    seed: 26,
    priority: 4,
    bus: 'feedback',
    loop: true,
    render({ data, sampleRate }) {
      for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        data[i] =
          (0.035 * Math.sin(2 * Math.PI * 760 * t) + 0.02 * Math.sin(2 * Math.PI * 1140 * t)) *
          Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * 8 * t), 4);
      }
    },
  },
  objective: {
    duration: 0.3,
    decibels: 8,
    seed: 27,
    priority: 4,
    bus: 'feedback',
    duckCombat: true,
    render: terminalTone,
  },
  flash: {
    duration: 0.45,
    decibels: -6,
    seed: 28,
    priority: 2,
    bus: 'combat',
    render({ tone, noise }) {
      // Compact, band-limited pressure crack; no full-band wash or ear-ringing tone.
      noise(0, 0.09, 350, 4200, 0.5, 7, { rate: 7200, interpolation: 'linear', modulation: 0.55 });
      tone(0, 0.13, 180, 85, 0.22, 6);
      noise(0.035, 0.24, 170, 1800, 0.16, 6, { rate: 2200, modulation: 0.4, sweep: 0.4 });
    },
  },
  support: {
    duration: 0.28,
    decibels: -2,
    seed: 29,
    priority: 2,
    bus: 'combat',
    reflections: true,
    render({ tone, noise, click }) {
      noise(0, 0.048, 900, 6500, 0.64, 8, {
        rate: 12000,
        interpolation: 'constant',
        modulation: 0.25,
      });
      tone(0, 0.14, 180, 65, 0.46);
      noise(0.012, 0.16, 180, 2300, 0.28, 7, { rate: 3400, modulation: 0.5, sweep: 0.45 });
      click(0.07, 0.12, 950);
    },
  },
} satisfies Record<string, SoundDefinition>;

export type SoundId = keyof typeof sounds;
export const SOUND_IDS = Object.keys(sounds) as SoundId[];
export const soundDefinition = (id: SoundId): Readonly<SoundDefinition> => sounds[id];
export const loopSound = (id: SoundId) => soundDefinition(id).loop ?? false;
const gains = Object.fromEntries(
  SOUND_IDS.map((id) => [id, 10 ** (sounds[id].decibels / 20)]),
) as Record<SoundId, number>;
export const mixGain = (id: SoundId) => gains[id];

export function synthesize(id: SoundId, sampleRate: number, variant = 0): Float32Array {
  const spec = soundDefinition(id);
  const voice = synthesis(spec.duration, sampleRate, spec.seed, variant);
  spec.render(voice);
  // Electrical loops use integer cycles; preserve their seamless endpoints.
  if (spec.loop) return voice.data;
  if (spec.reflections) reflect(voice.data, sampleRate);
  if (spec.lowpass) lowpass(voice.data, sampleRate, spec.lowpass);
  return finish(voice.data, sampleRate);
}
