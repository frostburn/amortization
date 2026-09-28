import { distance } from './types';
import type { Mission, Rect, Vec, World } from './types';

export const BODY_RADIUS = 0.2;
// Permit contact with the clearance boundary without trapping a body on it.
const EPSILON = 1e-7;

export function obstacles(world: World): Rect[] {
  return [
    ...world.mission.solids,
    ...(world.gateOpen ? [] : [world.mission.gate]),
    ...(world.mission.archive && !world.shutterOpen ? [world.mission.archive.door] : []),
  ];
}

export function passable(world: World, p: Vec, radius = BODY_RADIUS): boolean {
  return pointClear(world.mission, obstacles(world), p, radius);
}

function pointClear(mission: Mission, solids: Rect[], p: Vec, radius = BODY_RADIUS): boolean {
  return (
    p.x >= radius - EPSILON &&
    p.y >= radius - EPSILON &&
    p.x <= mission.width - radius + EPSILON &&
    p.y <= mission.height - radius + EPSILON &&
    !solids.some(
      (r) =>
        p.x >= r.x - radius + EPSILON &&
        p.x <= r.x + r.w + radius - EPSILON &&
        p.y >= r.y - radius + EPSILON &&
        p.y <= r.y + r.h + radius - EPSILON,
    )
  );
}

// Slab intersection: grazing an edge also blocks sight. The same solids drive navigation.
export function intersects(a: Vec, b: Vec, rect: Rect, margin = 0): boolean {
  let near = 0,
    far = 1;
  for (const axis of ['x', 'y'] as const) {
    const low = rect[axis] - margin;
    const high = rect[axis] + (axis === 'x' ? rect.w : rect.h) + margin;
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-8) {
      if (a[axis] < low || a[axis] > high) return false;
    } else {
      const t0 = (low - a[axis]) / delta,
        t1 = (high - a[axis]) / delta;
      near = Math.max(near, Math.min(t0, t1));
      far = Math.min(far, Math.max(t0, t1));
      if (near > far) return false;
    }
  }
  return true;
}

export const lineClear = (world: World, a: Vec, b: Vec, margin = 0) =>
  !obstacles(world).some((r) => intersects(a, b, r, margin));

// Destinations, grid connections, smoothing, and movement share one body clearance.
// Sight rays retain their separate, inclusive edge test.
export const canWalk = (world: World, a: Vec, b: Vec) =>
  passable(world, a) && passable(world, b) && lineClear(world, a, b, BODY_RADIUS - EPSILON);

export function nearestFree(world: World, target: Vec, toward?: Vec): Vec {
  if (passable(world, target)) return { ...target };
  for (let radius = 0.4; radius <= 4; radius += 0.4) {
    let best: Vec | undefined;
    for (let i = 0; i < 16; i++) {
      const p = {
        x: target.x + Math.cos((i * Math.PI) / 8) * radius,
        y: target.y + Math.sin((i * Math.PI) / 8) * radius,
      };
      if (passable(world, p)) {
        if (!toward) return p;
        if (!best || distance(p, toward) < distance(best, toward)) best = p;
      }
    }
    if (best) return best;
  }
  return { ...target };
}

// Keep the original neighbour order: equal-cost heap ties determine the route,
// and changing those ties would change combat timing in recorded attempts.
const directions = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
const lengths = directions.map(([dx, dy]) => Math.hypot(dx / 2, dy / 2));

interface NavigationGrid {
  width: number;
  height: number;
  points: Vec[];
  edges: Uint8Array;
}

// Derived geometry stays outside World and replay state. At most four door
// combinations are retained per mission; discarded missions can be collected.
const grids = new WeakMap<Mission, { geometry: string; states: Map<number, NavigationGrid> }>();

function navigationGrid(world: World): NavigationGrid {
  const mission = world.mission;
  const geometry = [
    mission.width,
    mission.height,
    mission.solids.length,
    Number(!!mission.archive),
    ...mission.solids.flatMap((r) => [r.x, r.y, r.w, r.h]),
    mission.gate.x,
    mission.gate.y,
    mission.gate.w,
    mission.gate.h,
    ...(mission.archive
      ? [
          mission.archive.door.x,
          mission.archive.door.y,
          mission.archive.door.w,
          mission.archive.door.h,
        ]
      : []),
  ].join(',');
  let cached = grids.get(mission);
  // Also covers an editor/test replacing or moving solids in place.
  if (cached?.geometry !== geometry) {
    cached = { geometry, states: new Map() };
    grids.set(mission, cached);
  }
  const state = Number(world.gateOpen) | (Number(world.shutterOpen) << 1);
  const existing = cached.states.get(state);
  if (existing) return existing;

  const width = mission.width * 2,
    height = mission.height * 2;
  const points = Array.from({ length: width * height }, (_, id) => ({
    x: (id % width) / 2 + 0.25,
    y: Math.floor(id / width) / 2 + 0.25,
  }));
  const solids = obstacles(world);
  const free = Uint8Array.from(points, (p) => Number(pointClear(mission, solids, p)));
  const edges = new Uint8Array(points.length);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const id = y * width + x;
      if (!free[id]) continue;
      for (let i = 0; i < directions.length; i++) {
        const [dx, dy] = directions[i],
          nx = x + dx,
          ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && free[ny * width + nx])
          edges[id] |= 1 << i;
      }
    }
  // Clear corner-cutting and thin-wall crossings. Each rectangle only visits
  // nearby edges, not every edge on the map; each undirected edge is tested once.
  for (const rect of solids) {
    const left = Math.max(0, Math.floor((rect.x - BODY_RADIUS) * 2) - 1),
      right = Math.min(width - 1, Math.ceil((rect.x + rect.w + BODY_RADIUS) * 2) + 1),
      top = Math.max(0, Math.floor((rect.y - BODY_RADIUS) * 2) - 1),
      bottom = Math.min(height - 1, Math.ceil((rect.y + rect.h + BODY_RADIUS) * 2) + 1);
    for (let y = top; y <= bottom; y++)
      for (let x = left; x <= right; x++) {
        const id = y * width + x;
        for (let i = 0; i < 4; i++) {
          if (!(edges[id] & (1 << i))) continue;
          const [dx, dy] = directions[i],
            next = id + dy * width + dx;
          if (intersects(points[id], points[next], rect, BODY_RADIUS - EPSILON)) {
            edges[id] &= ~(1 << i);
            edges[next] &= ~(1 << (7 - i));
          }
        }
      }
  }
  const grid = { width, height, points, edges };
  cached.states.set(state, grid);
  return grid;
}

// A half-metre grid is small enough for doors. A binary heap keeps repeated guard paths cheap.
export function findPath(world: World, start: Vec, requested: Vec): Vec[] {
  const end = nearestFree(world, requested);
  if (!passable(world, start) || !passable(world, end)) return [];
  if (canWalk(world, start, end)) return [end];
  const { width, height, points, edges } = navigationGrid(world);
  const costs = new Float64Array(width * height).fill(Infinity);
  const parent = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);
  const heap: { id: number; score: number }[] = [];
  function push(id: number, score: number) {
    heap.push({ id, score });
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].score <= score) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }
  function pop() {
    const top = heap[0],
      tail = heap.pop()!;
    if (heap.length) {
      heap[0] = tail;
      let i = 0;
      for (;;) {
        let j = i;
        const l = i * 2 + 1,
          r = l + 1;
        if (l < heap.length && heap[l].score < heap[j].score) j = l;
        if (r < heap.length && heap[r].score < heap[j].score) j = r;
        if (j === i) break;
        [heap[i], heap[j]] = [heap[j], heap[i]];
        i = j;
      }
    }
    return top.id;
  }
  // The real start is a separate node: its containing cell's centre can be inside
  // a building. Connect only to nearby grid centres that it can actually reach.
  const sx = Math.floor(start.x * 2),
    sy = Math.floor(start.y * 2);
  for (let y = sy - 1; y <= sy + 1; y++)
    for (let x = sx - 1; x <= sx + 1; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const id = y * width + x,
        p = points[id];
      if (!canWalk(world, start, p)) continue;
      costs[id] = distance(start, p);
      push(id, costs[id] + distance(p, end));
    }
  while (heap.length) {
    const id = pop();
    if (closed[id]) continue;
    closed[id] = 1;
    const p = points[id];
    // Sharing a grid cell does not prove the final segment clears its corner.
    if (distance(p, end) < 0.8 && canWalk(world, p, end)) {
      const result: Vec[] = [end];
      let cursor = id;
      while (cursor >= 0) {
        result.push(points[cursor]);
        cursor = parent[cursor];
      }
      result.reverse();
      // Shorten only along segments with clearance for the operative's body.
      const smooth: Vec[] = [];
      let from = start;
      for (let i = 0; i < result.length; i++) {
        let j = i;
        while (j + 1 < result.length && canWalk(world, from, result[j + 1])) j++;
        smooth.push({ ...result[j] });
        from = result[j];
        i = j;
      }
      return smooth;
    }
    for (let i = 0; i < directions.length; i++) {
      if (!(edges[id] & (1 << i))) continue;
      const [dx, dy] = directions[i],
        next = id + dy * width + dx;
      if (closed[next]) continue;
      const cost = costs[id] + lengths[i];
      if (cost < costs[next]) {
        costs[next] = cost;
        parent[next] = id;
        push(next, cost + distance(points[next], end));
      }
    }
  }
  return [];
}
