import { distance, living } from '../sim/types';
import type { Vec, World } from '../sim/types';

/** Follow a compact selection; a widely split selection follows its largest local group. */
export function selectionFocus(world: World, selected: string[], alpha: number): Vec | null {
  const points = selected.flatMap((id) => {
    const p = world.agents.find((a) => a.id === id && living(a));
    return p
      ? [
          {
            x: p.previous.x + (p.x - p.previous.x) * alpha,
            y: p.previous.y + (p.y - p.previous.y) * alpha,
          },
        ]
      : [];
  });
  if (!points.length) return null;
  const groups = points.map((p) => points.filter((q) => distance(p, q) <= 8));
  // Stable ties keep the first selected operative active rather than following empty space.
  const group = groups.reduce((best, next) => (next.length > best.length ? next : best));
  return {
    x: group.reduce((sum, p) => sum + p.x, 0) / group.length,
    y: group.reduce((sum, p) => sum + p.y, 0) / group.length,
  };
}
