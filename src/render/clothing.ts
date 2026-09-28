import type { Point3 } from './model-mesh';

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
  const slopes = knees.map((knee) => knee[0] / (hip - knee[2]));
  // Horizontal clearance includes the angled thigh, its projecting kneecap,
  // and the inward chord of the faceted fabric between ring vertices.
  const clearance = Math.max(...slopes.map((slope) => 0.092 * Math.hypot(1, slope)));
  return [
    [-0.2, Math.max(widths.hips * 1.16, 0.205)],
    [-0.1, Math.max(widths.hips * 1.08, 0.198)],
    [0.02, Math.max(widths.hips, 0.19)],
    [0.18, widths.waist],
    [0.43, widths.shoulders],
  ].map(([height, width]) => {
    const skirt = height < 0;
    const front = skirt ? Math.max(0.115, Math.max(...slopes) * -height + clearance) : 0.115;
    const back = skirt ? Math.min(-0.115, Math.min(...slopes) * -height - clearance) : -0.115;
    const center = (front + back) / 2,
      radius = (front - back) / 2;
    // Rounded rectangular hems cover both thighs; an ellipse pinches at the corners.
    const exponent = height <= 0.02 ? 0.5 : 1;
    return Array.from({ length: 16 }, (_, i): Point3 => {
      const t = (i * Math.PI) / 8,
        c = Math.cos(t),
        s = Math.sin(t);
      return [
        center + Math.sign(c) * Math.abs(c) ** exponent * radius,
        Math.sign(s) * Math.abs(s) ** exponent * width,
        hip + height,
      ];
    });
  });
}
