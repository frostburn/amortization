import type { Synthesis } from './synthesis';

type TypingDevice = 'phone' | 'keyboard' | 'typewriter';

// Each character keeps one voice and reading cadence across every scene.
// Seeds never consume the simulation's random stream.
export const typingVoices = {
  morrow: {
    device: 'phone',
    seed: 40,
    pitch: 0.86,
    weight: 0.95,
    snap: 0.8,
    release: 0.85,
    interval: 25,
    pause: 0.85,
    rhythm: [0.85, 0.9, 1.15, 1.1],
    keyGap: 60,
  },
  voss: {
    device: 'keyboard',
    seed: 41,
    pitch: 1.17,
    weight: 0.8,
    snap: 1.05,
    release: 0.8,
    interval: 22,
    pause: 1,
    rhythm: [0.75, 0.85, 1.3, 0.8, 1.3],
    keyGap: 54,
  },
  mara: {
    device: 'keyboard',
    seed: 42,
    pitch: 0.95,
    weight: 0.85,
    snap: 0.7,
    release: 1.1,
    interval: 29,
    pause: 1.2,
    rhythm: [0.95, 1.05, 1, 1],
    keyGap: 65,
  },
  holt: {
    device: 'typewriter',
    seed: 43,
    pitch: 0.73,
    weight: 1.2,
    snap: 0.85,
    release: 1.2,
    interval: 33,
    pause: 1.4,
    rhythm: [1.05, 0.95, 1.05, 0.95],
    keyGap: 75,
  },
  kestrel: {
    device: 'typewriter',
    seed: 44,
    pitch: 1.18,
    weight: 0.8,
    snap: 1.1,
    release: 0.7,
    interval: 22,
    pause: 0.9,
    rhythm: [0.8, 0.85, 0.85, 1.5],
    keyGap: 55,
  },
  dacre: {
    device: 'typewriter',
    seed: 45,
    pitch: 0.9,
    weight: 1.1,
    snap: 1,
    release: 0.9,
    interval: 27,
    pause: 1.05,
    rhythm: [0.7, 1.3, 0.7, 1.3],
    keyGap: 65,
  },
} satisfies Record<
  string,
  {
    device: TypingDevice;
    seed: number;
    pitch: number;
    weight: number;
    snap: number;
    release: number;
    interval: number;
    pause: number;
    rhythm: number[];
    keyGap: number;
  }
>;
export type TypingSpeaker = keyof typeof typingVoices;
export type TypingSound = `key-${TypingSpeaker}`;

export function typingSound(speaker: TypingSpeaker): TypingSound {
  return `key-${speaker}`;
}

function keyDefinition(speaker: TypingSpeaker) {
  const v = typingVoices[speaker],
    device = v.device,
    p = v.pitch;
  return {
    duration: device === 'phone' ? 0.055 : device === 'keyboard' ? 0.085 : 0.115,
    // Balance repeated strokes, not isolated peaks: the mechanical body carries
    // much more energy than a phone tap and needs a lower fader.
    decibels: device === 'phone' ? 4 : device === 'keyboard' ? -2 : -10,
    seed: v.seed + (device === 'phone' ? 0 : device === 'keyboard' ? 100 : 200),
    priority: 1,
    bus: 'feedback' as const,
    lowpass: (device === 'phone' ? 3200 : device === 'keyboard' ? 3800 : 4200) * p,
    render({ tone, noise, click }: Synthesis) {
      if (device === 'phone') {
        // Dry glass contact and a tiny haptic body; no notification-like chirp.
        noise(0, 0.011, 750 * p, 3200 * p, 0.15 * v.snap, 7, {
          rate: 3800 * p,
          interpolation: 'constant',
        });
        tone(0, 0.018, 1400 * p, 1400 * p, 0.035, 8, 0.13);
        tone(0.001, 0.032, 220 * p, 160 * p, 0.018 * v.weight);
      } else if (device === 'keyboard') {
        // Hollow plastic bottom-out, followed by a quieter keycap return.
        noise(0, 0.012, 1100 * p, 5000 * p, 0.24 * v.snap, 6, {
          rate: 6000 * p,
          interpolation: 'constant',
        });
        tone(0.002, 0.037, 540 * p, 460 * p, 0.1 * v.weight, 6, 0.14);
        noise(0.003, 0.037, 230 * p, 1900 * p, 0.13 * v.weight, 5, {
          rate: 2200 * p,
          interpolation: 'linear',
        });
        click(0.028 * v.release, 0.045, 1250 * p);
      } else {
        // Linkage, platen impact, then a damped return. Weight comes from the
        // body and timing, without making every letter a loud impact effect.
        noise(0, 0.013, 1700 * p, 6000 * p, 0.29 * v.snap, 7, {
          rate: 7600 * p,
          interpolation: 'constant',
        });
        tone(0.004, 0.065, 240 * p, 170 * p, 0.15 * v.weight, 7, 0.08);
        noise(0.004, 0.055, 180 * p, 2200 * p, 0.23 * v.weight, 6, {
          rate: 3200 * p,
          interpolation: 'linear',
          modulation: 0.4,
        });
        tone(0.009, 0.052, 1200 * p, 1200 * p, 0.028 * v.snap, 8, 0.28);
        click(0.035 * v.release, 0.095, 900 * p);
      }
    },
  };
}

export const typingSounds = Object.fromEntries(
  (Object.keys(typingVoices) as TypingSpeaker[]).map((speaker) => [
    typingSound(speaker),
    keyDefinition(speaker),
  ]),
) as Record<TypingSound, ReturnType<typeof keyDefinition>>;
