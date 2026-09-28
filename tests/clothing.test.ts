import { describe, expect, it } from 'vitest';
import { coatRings, shoulderPadTransform } from '../src/render/clothing';
import { footfall, hipHeight, kneePosition } from '../src/render/gait';
import type { Point3 } from '../src/render/model-mesh';

const widths = { hips: 0.175, waist: 0.17, shoulders: 0.195 };
const lerp = (a: Point3, b: Point3, t: number): Point3 =>
  a.map((v, i) => v + (b[i] - v) * t) as Point3;

function stride(phase: number | null) {
  const hip = hipHeight(phase);
  const knees = [-1, 1].map((side, i): Point3 => {
    const foot = phase === null ? { forward: 0, lift: 0 } : footfall(phase + i / 2);
    const knee = kneePosition(hip, foot.forward, foot.lift + 0.09);
    return [knee.forward, side * 0.115, knee.height];
  });
  return { hip, knees };
}

function hemFront(ring: Point3[], side: number) {
  return Math.max(
    ...ring.flatMap((a, i) => {
      const b = ring[(i + 1) % ring.length];
      const t = (side - a[1]) / (b[1] - a[1]);
      return t >= 0 && t <= 1 ? [a[0] + (b[0] - a[0]) * t] : [];
    }),
  );
}

// Slice the triangulated loft, including each quad's diagonal. Merely checking
// ring vertices misses leg tips protruding through the fabric between rings.
function covered(point: Point3, rings: Point3[][]) {
  const top = rings.findIndex((ring) => ring[0][2] >= point[2]);
  if (top === 0) return true; // Visible leg below the hem.
  if (top < 0) return false;
  const low = rings[top - 1],
    high = rings[top],
    t = (point[2] - low[0][2]) / (high[0][2] - low[0][2]);
  const section = low.flatMap((p, i) => [
    lerp(p, high[i], t),
    lerp(p, high[(i + 1) % high.length], t),
  ]);
  let inside = false;
  for (let i = 0, j = section.length - 1; i < section.length; j = i++) {
    const a = section[i],
      b = section[j];
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

describe('articulated clothing', () => {
  it('keeps the shoulder pivot fixed while the cap follows a restrained arm rotation', () => {
    for (const side of [-1, 1]) {
      const shoulder: Point3 = [0, side * widths.shoulders, 1.055];
      for (const elbow of [
        [-0.139, side * 0.21, 0.85], // Backswing.
        [0.109, side * 0.21, 0.85], // Forward swing.
        [0.19, side * 0.18, 0.91], // Aim.
        [0.16, side * 0.19, 0.81], // Carry.
      ] satisfies Point3[]) {
        const transform = shoulderPadTransform(shoulder, elbow);
        expect(transform([0, 0, 0])).toEqual(shoulder);
        const tip = transform([0, 0, -0.1]).map((v, i) => v - shoulder[i]);
        const arm = elbow.map((v, i) => v - shoulder[i]);
        const tilt = (v: number[]) => Math.atan2(Math.hypot(v[0], v[1]), -v[2]);
        expect(Math.hypot(...tip)).toBeCloseTo(0.1);
        expect(tilt(tip)).toBeGreaterThan(0);
        expect(tilt(tip)).toBeLessThan(tilt(arm) * 0.6);
        expect(Math.sign(tip[0])).toBe(Math.sign(arm[0]));
      }
    }
  });

  it('lets the trailing hem hang back while the leading side folds around either knee', () => {
    const voss = { hips: 0.17, waist: 0.13, shoulders: 0.16 };
    for (const phase of [0.375, 0.875]) {
      const { hip, knees } = stride(phase);
      const [trailing, leading] = [...knees].sort((a, b) => a[0] - b[0]);
      const hem = coatRings(hip, knees, voss)[0];
      expect(hemFront(hem, leading[1]) - hemFront(hem, trailing[1])).toBeGreaterThan(0.1);
      expect(hemFront(hem, trailing[1])).toBeLessThan(0.2);
      const mirrored = coatRings(
        hip,
        knees.map(([x, y, z]) => [x, -y, z]),
        voss,
      )[0];
      for (const side of [-0.115, 0, 0.115])
        expect(hemFront(hem, side)).toBeCloseTo(hemFront(mirrored, -side));
    }
  });

  it.each([
    ['guard', widths],
    ['Voss', { hips: 0.17, waist: 0.13, shoulders: 0.16 }],
    ['slim operative', { hips: 0.16, waist: 0.12, shoulders: 0.16 }],
    ['broad operative', { hips: 0.18, waist: 0.19, shoulders: 0.235 }],
  ])('covers %s thighs and raised kneecaps above the hem through a full stride', (_, widths) => {
    for (const phase of [null, ...Array.from({ length: 24 }, (_, i) => i / 24)]) {
      const { hip, knees } = stride(phase);
      const rings = coatRings(hip, knees, widths);
      // The shin folds back below the knee; the hem must not keep extending
      // along the thigh into empty space at the end of the swing.
      expect(Math.max(...rings[0].map((point) => point[0]))).toBeLessThanOrEqual(
        Math.max(...knees.map((knee) => knee[0])) + 0.12,
      );
      // The chest and belt cannot swell when a knee lifts.
      expect(rings.slice(-2)).toEqual(coatRings(hip, [[0, 0, hip - 0.32]], widths).slice(-2));
      const exposed: Point3[] = [];
      for (const knee of knees) {
        const down = hip - knee[2],
          length = Math.hypot(knee[0], down);
        for (let step = 0; step <= 12; step++) {
          const t = step / 12,
            radius = 0.068 + (0.058 - 0.068) * t;
          for (let i = 0; i < 24; i++) {
            const angle = (i * Math.PI) / 12;
            const point: Point3 = [
              knee[0] * t + (Math.cos(angle) * radius * down) / length,
              knee[1] + Math.sin(angle) * radius,
              hip - down * t + (Math.cos(angle) * radius * knee[0]) / length,
            ];
            if (!covered(point, rings)) exposed.push(point);
          }
        }
        // The joint and front kneecap can rise above the coat's lower edge.
        for (const [offset, forward, right, height] of [
          [0, 0.067, 0.06, 0.06],
          [0.038, 0.038, 0.055, 0.051],
        ])
          for (const z of [-1, -0.6, 0.45, 1])
            for (let i = 0; i < 8; i++) {
              const angle = (i * Math.PI) / 4,
                r = Math.abs(z) === 1 ? 0.55 : 1;
              const point: Point3 = [
                knee[0] + offset + Math.cos(angle) * forward * r,
                knee[1] + Math.sin(angle) * right * r,
                knee[2] + z * height,
              ];
              if (!covered(point, rings)) exposed.push(point);
            }
      }
      expect(exposed, `cloth intersections at stride ${phase}`).toEqual([]);
    }
  });
});
