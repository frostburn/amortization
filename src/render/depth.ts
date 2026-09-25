import type { Rect } from '../sim/types';

export interface DepthItem {
  footprint: Rect;
}

// Looking toward decreasing x/y: an object wholly north or west of another
// must be painted first. Opposing separations are side-by-side on screen.
function behind(a: Rect, b: Rect): boolean {
  return a.x + a.w <= b.x || a.y + a.h <= b.y;
}

/** Back-to-front painter order for ground-level footprints, not sprite centres. */
export function depthOrder<T extends DepthItem>(items: readonly T[]): T[] {
  const ordered = [...items].sort((a, b) => {
    const depth = (r: Rect) => r.x + r.y + (r.w + r.h) / 2;
    return depth(a.footprint) - depth(b.footprint);
  });
  const edges = ordered.map(() => [] as number[]);
  const incoming = new Uint16Array(ordered.length);
  for (let i = 0; i < ordered.length; i++)
    for (let j = i + 1; j < ordered.length; j++) {
      const a = behind(ordered[i].footprint, ordered[j].footprint);
      const b = behind(ordered[j].footprint, ordered[i].footprint);
      if (a === b) continue;
      const from = a ? i : j,
        to = a ? j : i;
      edges[from].push(to);
      incoming[to]++;
    }
  const result: T[] = [];
  const drawn = new Uint8Array(ordered.length);
  while (result.length < ordered.length) {
    let next = ordered.findIndex((_, i) => !drawn[i] && incoming[i] === 0);
    // Intersecting scenery has no unique painter order. Keep its tie-break stable.
    if (next === -1) next = drawn.findIndex((value) => !value);
    drawn[next] = 1;
    result.push(ordered[next]);
    for (const to of edges[next]) incoming[to]--;
  }
  return result;
}
