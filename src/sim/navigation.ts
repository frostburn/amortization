import { distance } from './types';
import type { Rect, Vec, World } from './types';

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
  return (
    p.x >= radius - EPSILON &&
    p.y >= radius - EPSILON &&
    p.x <= world.mission.width - radius + EPSILON &&
    p.y <= world.mission.height - radius + EPSILON &&
    !obstacles(world).some(
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

export function nearestFree(world: World, target: Vec): Vec {
  if (passable(world, target)) return { ...target };
  for (let radius = 0.4; radius <= 4; radius += 0.4) {
    for (let i = 0; i < 16; i++) {
      const p = {
        x: target.x + Math.cos((i * Math.PI) / 8) * radius,
        y: target.y + Math.sin((i * Math.PI) / 8) * radius,
      };
      if (passable(world, p)) return p;
    }
  }
  return { ...target };
}

// A half-metre grid is small enough for doors. A binary heap keeps repeated guard paths cheap.
export function findPath(world: World, start: Vec, requested: Vec): Vec[] {
  const end = nearestFree(world, requested);
  if (!passable(world, start) || !passable(world, end)) return [];
  if (canWalk(world, start, end)) return [end];
  const width = world.mission.width * 2,
    height = world.mission.height * 2;
  const point = (id: number) => ({
    x: (id % width) / 2 + 0.25,
    y: Math.floor(id / width) / 2 + 0.25,
  });
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
        p = point(id);
      if (!canWalk(world, start, p)) continue;
      costs[id] = distance(start, p);
      push(id, costs[id] + distance(p, end));
    }
  while (heap.length) {
    const id = pop();
    if (closed[id]) continue;
    closed[id] = 1;
    const p = point(id);
    // Sharing a grid cell does not prove the final segment clears its corner.
    if (distance(p, end) < 0.8 && canWalk(world, p, end)) {
      const result: Vec[] = [end];
      let cursor = id;
      while (cursor >= 0) {
        result.push(point(cursor));
        cursor = parent[cursor];
      }
      result.reverse();
      // Shorten only along segments with clearance for the operative's body.
      const smooth: Vec[] = [];
      let from = start;
      for (let i = 0; i < result.length; i++) {
        let j = i;
        while (j + 1 < result.length && canWalk(world, from, result[j + 1])) j++;
        smooth.push(result[j]);
        from = result[j];
        i = j;
      }
      return smooth;
    }
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = (id % width) + dx,
          ny = Math.floor(id / width) + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx,
          q = point(next);
        if (closed[next] || !canWalk(world, p, q)) continue;
        const cost = costs[id] + distance(p, q);
        if (cost < costs[next]) {
          costs[next] = cost;
          parent[next] = id;
          push(next, cost + distance(q, end));
        }
      }
  }
  return [];
}
