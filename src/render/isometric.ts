import type { Vec } from '../sim/types';

export const TILE_X = 26;
export const TILE_Y = 14;
const HEIGHT = 25;

export const project = (p: Vec, z = 0) => ({
  x: (p.x - p.y) * TILE_X,
  y: (p.x + p.y) * TILE_Y - z * HEIGHT,
});
