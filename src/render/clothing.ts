import type { Point3 } from './model-mesh';

const COAT_SIDES = 16;
const COAT_NORMALS = Array.from({ length: COAT_SIDES }, (_, i) => {
  const angle = ((i - 0.5) * Math.PI * 2) / COAT_SIDES;
  return [Math.cos(angle), Math.sin(angle)];
});

/** A shoulder cap follows part of the arm's rotation, around the actual shoulder joint. */
export function shoulderPadTransform(shoulder: Point3, elbow: Point3) {
  const forward = elbow[0] - shoulder[0],
    right = elbow[1] - shoulder[1],
    down = shoulder[2] - elbow[2],
    horizontal = Math.hypot(forward, right);
  const angle = Math.atan2(horizontal, down) * 0.4,
    c = Math.cos(angle),
    s = Math.sin(angle);
  // Rotation axis from the resting, downward sleeve to the posed upper arm.
  const x = horizontal ? right / horizontal : 0,
    y = horizontal ? -forward / horizontal : 0;
  return ([a, b, z]: Point3): Point3 => {
    const along = (x * a + y * b) * (1 - c);
    return [
      shoulder[0] + a * c + y * z * s + x * along,
      shoulder[1] + b * c - x * z * s + y * along,
      shoulder[2] + z * c + (x * b - y * a) * s,
    ];
  };
}

/** Loft the coat around the thighs. The belt and chest remain fixed to the torso. */
export function coatRings(
  hip: number,
  knees: readonly Point3[],
  widths: { hips: number; waist: number; shoulders: number },
): Point3[][] {
  const legs = knees.map((knee) => {
    const slope = knee[0] / (hip - knee[2]);
    return { knee, slope, clearance: 0.092 * Math.hypot(1, slope) };
  });
  const kneeCrest = Math.max(-0.15, ...knees.map((knee) => knee[2] - hip + 0.05));
  return [
    [-0.2, Math.max(widths.hips * 1.16, 0.205)],
    [kneeCrest, Math.max(widths.hips * 1.08, 0.198)],
    [0.02, Math.max(widths.hips, 0.19)],
    [0.18, widths.waist],
    [0.43, widths.shoulders],
  ].map(([height, width]) => {
    if (height < 0) {
      // Wrap each thigh locally. Tangents join their rounded sections, so the
      // leading leg pushes its own side out without dragging the other hem.
      const sections = legs.map(({ knee, slope, clearance }) => {
        const forward = slope * -height;
        // The shin folds back below the knee; don't stretch the hem past it.
        const front = Math.min(knee[0] + 0.105, forward + clearance);
        const back = forward - clearance;
        return { center: (front + back) / 2, radius: (front - back) / 2, side: knee[1] };
      });
      const support = COAT_NORMALS.map(([x, y]) =>
        Math.max(
          // The resting coat keeps its rounded rectangular section at the back.
          ((Math.abs(x) * 0.115) ** (4 / 3) + (Math.abs(y) * width) ** (4 / 3)) ** (3 / 4),
          ...sections.map((s) => x * s.center + y * s.side + Math.hypot(x * s.radius, y * 0.086)),
        ),
      );
      return COAT_NORMALS.map(([x, y], i): Point3 => {
        const j = (i + 1) % COAT_SIDES,
          [nextX, nextY] = COAT_NORMALS[j],
          determinant = x * nextY - y * nextX;
        return [
          (support[i] * nextY - support[j] * y) / determinant,
          (x * support[j] - nextX * support[i]) / determinant,
          hip + height,
        ];
      });
    }
    // Hip, waist, and shoulder rings stay fixed above the animated skirt.
    const exponent = height <= 0.02 ? 0.5 : 1;
    return Array.from({ length: COAT_SIDES }, (_, i): Point3 => {
      const t = (i * Math.PI * 2) / COAT_SIDES,
        c = Math.cos(t),
        s = Math.sin(t);
      return [
        Math.sign(c) * Math.abs(c) ** exponent * 0.115,
        Math.sign(s) * Math.abs(s) ** exponent * width,
        hip + height,
      ];
    });
  });
}
