import type { Graphics } from 'pixi.js';
import type { Solid } from '../sim/types';
import { project } from './isometric';

type Point = [number, number, number];

/** Cargo van with a cab, raked glass and wheel openings, inside the mission footprint. */
export function drawVan(g: Graphics, s: Solid) {
  const point = ([x, y, z]: Point) => project({ x: s.x + x * s.w, y: s.y + y * s.h }, z * s.height);
  const shape = (vertices: Point[], color: number, alpha = 1) =>
    g
      .poly(
        vertices.flatMap((p) => {
          const q = point(p);
          return [q.x, q.y];
        }),
      )
      .fill({ color, alpha });
  const line = (vertices: Point[], color: number, width = 1) =>
    g
      .poly(
        vertices.flatMap((p) => {
          const q = point(p);
          return [q.x, q.y];
        }),
        false,
      )
      .stroke({ color, width });
  const front = (x: number, w: number, low: number, high: number, color: number, y = 0.973) =>
    shape(
      [
        [x, y, low],
        [x + w, y, low],
        [x + w, y, high],
        [x, y, high],
      ],
      color,
    );
  const side = (y: number, h: number, low: number, high: number, color: number) =>
    shape(
      [
        [0.945, y, low],
        [0.945, y + h, low],
        [0.945, y + h, high],
        [0.945, y, high],
      ],
      color,
    );

  shape(
    [
      [0.01, 0.02, 0],
      [0.99, 0.02, 0],
      [0.99, 0.98, 0],
      [0.01, 0.98, 0],
    ],
    0x101b19,
    0.4,
  );
  // Tyres touch z=0. The near body's open arches reveal them instead of painting circles on a box.
  const radius = s.height * 0.18;
  const wheel = (x: number, y: number, r: number, color: number) =>
    shape(
      Array.from({ length: 24 }, (_, i): Point => {
        const a = (i / 24) * Math.PI * 2;
        return [x, y + (Math.cos(a) * r) / s.h, 0.18 + (Math.sin(a) * r) / s.height];
      }),
      color,
    );
  for (const x of [0.065, 0.95])
    for (const y of [0.2, 0.8]) {
      wheel(x, y, radius, 0x101917);
      wheel(x, y, radius * 0.66, 0x26312e);
      wheel(x, y, radius * 0.38, 0x82958a);
      wheel(x, y, radius * 0.13, 0x3a4a42);
    }
  const edge: Point[] = [
    [0.94, 0.04, 0.22],
    [0.94, 0.04, 0.88],
    [0.94, 0.1, 1],
    [0.94, 0.66, 1],
    [0.94, 0.85, 0.65],
    [0.94, 0.97, 0.58],
    [0.94, 0.97, 0.22],
  ];
  const arches: Point[][] = [];
  for (const axle of [0.8, 0.2]) {
    const arch = Array.from({ length: 13 }, (_, i): Point => {
      const a = (i / 12) * Math.PI;
      return [0.94, axle + Math.cos(a) * 0.108, 0.22 + Math.sin(a) * 0.22];
    });
    edge.push(...arch);
    arches.push(arch);
  }
  shape(edge, 0x34665e);
  for (const arch of arches) line(arch, 0x1d3934, 1.6);
  // Rear, roof and its folded edge.
  shape(
    [
      [0.06, 0.04, 0.22],
      [0.94, 0.04, 0.22],
      [0.94, 0.04, 0.88],
      [0.06, 0.04, 0.88],
    ],
    0x284c45,
  );
  shape(
    [
      [0.06, 0.1, 1],
      [0.94, 0.1, 1],
      [0.94, 0.66, 1],
      [0.06, 0.66, 1],
    ],
    0x568e7e,
  );
  shape(
    [
      [0.06, 0.04, 0.88],
      [0.94, 0.04, 0.88],
      [0.94, 0.1, 1],
      [0.06, 0.1, 1],
    ],
    0x487b6d,
  );
  for (const x of [0.18, 0.81])
    line(
      [
        [x, 0.16, 1.005],
        [x, 0.6, 1.005],
      ],
      0x91b2a0,
      1.3,
    );

  // The windscreen slopes down toward a short bonnet and a vertical nose.
  shape(
    [
      [0.06, 0.66, 1],
      [0.94, 0.66, 1],
      [0.94, 0.85, 0.65],
      [0.06, 0.85, 0.65],
    ],
    0x467b6c,
  );
  shape(
    [
      [0.13, 0.687, 0.95],
      [0.87, 0.687, 0.95],
      [0.87, 0.828, 0.69],
      [0.13, 0.828, 0.69],
    ],
    0x172f31,
  );
  shape(
    [
      [0.17, 0.699, 0.93],
      [0.84, 0.699, 0.93],
      [0.84, 0.729, 0.875],
      [0.17, 0.729, 0.875],
    ],
    0x769d96,
  );
  line(
    [
      [0.27, 0.823, 0.7],
      [0.44, 0.777, 0.785],
    ],
    0x121f20,
  );
  line(
    [
      [0.62, 0.823, 0.7],
      [0.79, 0.777, 0.785],
    ],
    0x121f20,
  );
  shape(
    [
      [0.06, 0.85, 0.65],
      [0.94, 0.85, 0.65],
      [0.94, 0.97, 0.58],
      [0.06, 0.97, 0.58],
    ],
    0x578b77,
  );
  front(0.06, 0.88, 0.22, 0.58, 0x42796a);
  front(0.02, 0.96, 0.2, 0.3, 0x243731, 0.985);
  front(0.37, 0.26, 0.35, 0.5, 0x1b302c);
  for (const z of [0.38, 0.43, 0.48]) front(0.39, 0.22, z, z + 0.014, 0x77938a);
  for (const x of [0.12, 0.71]) front(x, 0.17, 0.4, 0.52, 0xe5d8ac);
  for (const x of [0.09, 0.88]) front(x, 0.035, 0.4, 0.51, 0xd4a060);
  front(0.42, 0.16, 0.215, 0.275, 0xb0b9a0, 0.987);

  // Cab glass, door seams, handles, a cargo rail and a wing mirror give scale to the flank.
  shape(
    [
      [0.945, 0.55, 0.91],
      [0.945, 0.65, 0.91],
      [0.945, 0.8, 0.65],
      [0.945, 0.55, 0.65],
    ],
    0x172f31,
  );
  line(
    [
      [0.946, 0.57, 0.88],
      [0.946, 0.64, 0.88],
      [0.946, 0.685, 0.8],
    ],
    0x779f94,
  );
  line(
    [
      [0.946, 0.52, 0.96],
      [0.946, 0.52, 0.3],
      [0.946, 0.68, 0.3],
    ],
    0x21483f,
  );
  line(
    [
      [0.946, 0.83, 0.6],
      [0.946, 0.83, 0.45],
    ],
    0x21483f,
  );
  line(
    [
      [0.946, 0.12, 0.83],
      [0.946, 0.47, 0.83],
      [0.946, 0.47, 0.32],
      [0.946, 0.33, 0.32],
    ],
    0x284f46,
  );
  side(0.12, 0.36, 0.59, 0.61, 0x8ca895);
  side(0.4, 0.065, 0.65, 0.68, 0x16352e);
  side(0.55, 0.065, 0.56, 0.59, 0x172f29);
  side(0.06, 0.032, 0.39, 0.61, 0xa36c53);
  line(
    [
      [0.946, 0.76, 0.7],
      [1, 0.76, 0.7],
    ],
    0x172f29,
    2,
  );
  shape(
    [
      [1, 0.735, 0.68],
      [1, 0.815, 0.68],
      [1, 0.815, 0.78],
      [1, 0.735, 0.78],
    ],
    0x223d37,
  );
}
