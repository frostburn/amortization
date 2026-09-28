import { expect, it } from 'vitest';
import { clearing } from '../src/content/clearing';
import { selectionFocus } from '../src/render/camera';
import { createWorld } from '../src/sim/world';

it('tracks interpolated team movement and switches to a distant selected operative', () => {
  const w = createWorld(clearing),
    ids = w.agents.map((a) => a.id);
  expect(selectionFocus(w, ids, 1)).toEqual({ x: 5.5, y: 38.5 });
  const a = w.agents[0];
  Object.assign(a, { x: 45, y: 17, previous: { x: 43, y: 17 } });
  expect(selectionFocus(w, [a.id], 0.5)).toEqual({ x: 44, y: 17 });
  expect(selectionFocus(w, ids, 1)).toEqual({ x: 17 / 3, y: 116 / 3 });
  a.hp = 0;
  expect(selectionFocus(w, [a.id], 1)).toBeNull();
});

it('keeps the first selected operative active when equally sized groups split', () => {
  const w = createWorld(clearing);
  w.agents.slice(0, 2).forEach((a) => Object.assign(a, { x: 45, y: 17 }));
  const ids = w.agents.map((a) => a.id);
  expect(selectionFocus(w, ids, 1)).toEqual({ x: 45, y: 17 });
  expect(selectionFocus(w, [...ids].reverse(), 1)).toEqual({ x: 5.5, y: 39 });
});
