import { distance, living } from '../sim/types';
import type { Vec, World } from '../sim/types';

interface Focus extends Vec {
  lookAhead: Vec;
  members: Vec[];
}

/** Follow a compact selection; a widely split selection follows its largest local group. */
export function selectionFocus(world: World, selected: string[], alpha: number): Focus | null {
  const points = selected.flatMap((id) => {
    const p = world.agents.find((a) => a.id === id && living(a));
    return p
      ? [
          {
            person: p,
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
  const directions = group.map(({ person: p }) => {
    // Look along the next actual path segment, never straight through a wall at
    // a distant clicked destination. Movement takes priority over firing backwards.
    const next = p.path.find((q) => distance(p, q) > 1e-5);
    const dx = next ? next.x - p.x : p.x - p.previous.x;
    const dy = next ? next.y - p.y : p.y - p.previous.y;
    const length = Math.hypot(dx, dy);
    return length > 1e-5
      ? { x: dx / length, y: dy / length, moving: true }
      : { x: Math.cos(p.angle), y: Math.sin(p.angle), moving: false };
  });
  const moving = directions.filter((d) => d.moving);
  const looking = moving.length ? moving : directions;
  const lead = moving.length ? 4 : 2.2;
  return {
    x: group.reduce((sum, p) => sum + p.x, 0) / group.length,
    y: group.reduce((sum, p) => sum + p.y, 0) / group.length,
    members: group.map(({ x, y }) => ({ x, y })),
    // Opposing headings cancel instead of arbitrarily picking one person's facing.
    lookAhead: {
      x: (looking.reduce((sum, p) => sum + p.x, 0) / looking.length) * lead,
      y: (looking.reduce((sum, p) => sum + p.y, 0) / looking.length) * lead,
    },
  };
}

/** Screen-space pan: ease into turns, but immediately recover an off-screen selection. */
export function followOffset(
  point: Vec,
  lead: Vec,
  view: { width: number; height: number; inset?: Vec },
  seconds: number,
  snap = false,
): Vec {
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  // Reserve space for the local group as well as the focused point. When a
  // player zooms beyond what can fit, keep its centre visible without auto-zoom.
  const left = Math.min(view.width * 0.5, Math.max(view.width * 0.16, view.inset?.x ?? 0));
  const top = Math.min(view.height * 0.5, Math.max(view.height * 0.18, view.inset?.y ?? 0));
  const right = view.width - left;
  const bottom = Math.max(
    view.height * 0.5,
    Math.min(view.height * 0.86, view.height - (view.inset?.y ?? 0)),
  );
  const x = clamp(
    view.width * 0.5 - clamp(lead.x, -view.width * 0.2, view.width * 0.2),
    left,
    right,
  );
  const y = clamp(
    view.height * 0.53 - clamp(lead.y, -view.height * 0.2, view.height * 0.2),
    top,
    bottom,
  );
  const blend = snap ? 1 : 1 - Math.exp(-6 * clamp(seconds, 0, 0.1));
  const panX = Math.abs(x - point.x) > 1 ? (x - point.x) * blend : 0;
  const panY = Math.abs(y - point.y) > 1 ? (y - point.y) * blend : 0;
  return {
    x: clamp(point.x + panX, left, right) - point.x,
    y: clamp(point.y + panY, top, bottom) - point.y,
  };
}
