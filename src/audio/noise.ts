/** Random control points clocked in Hz, independent of the output sample rate.
 * Holding them gives grain; interpolating them softens each transition. */
export function clockedNoise(
  random: () => number,
  sampleRate: number,
  interpolation: 'constant' | 'linear' = 'linear',
) {
  let phase = 0,
    from = random(),
    to = random();
  return (frequency: number) => {
    const value = interpolation === 'constant' ? from : from + (to - from) * phase;
    phase += Math.max(0, Math.min(1, frequency / sampleRate));
    if (phase >= 1) {
      phase -= 1;
      from = to;
      to = random();
    }
    return value;
  };
}
