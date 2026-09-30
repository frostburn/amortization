import { floorOf } from '../sim/types';
import type { Vec } from '../sim/types';

export const TILE_X = 26;
export const TILE_Y = 14;
export const HEIGHT = 25;
export const FLOOR_HEIGHT = 3.4;

export const project = (p: Vec, z = 0) => ({
  x: (p.x - p.y) * TILE_X,
  y: (p.x + p.y) * TILE_Y - (z + floorOf(p) * FLOOR_HEIGHT) * HEIGHT,
});
