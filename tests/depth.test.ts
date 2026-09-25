import { describe, expect, it } from 'vitest';
import { depot } from '../src/content/depot';
import { depthOrder } from '../src/render/depth';
import type { Rect, Vec } from '../src/sim/types';

const actor = (p: Vec) => ({ id: 'actor', footprint: { ...p, w: 0, h: 0 } });
const solid = (id: string, footprint: Rect) => ({ id, footprint });

describe('isometric occlusion', () => {
  it.each([
    ['behind the long foreground wall', 'south-a', { x: 20, y: 19.7 }, true],
    ['in front of the long foreground wall', 'south-a', { x: 10, y: 20.7 }, false],
    ['behind the far end of a tram', 'tram-a', { x: 12.9, y: 16 }, true],
    ['in front of the near side of a tram', 'tram-a', { x: 15.7, y: 8.5 }, false],
    ['behind the kiosk', 'kiosk', { x: 2.2, y: 12.5 }, true],
    ['in front of the kiosk', 'kiosk', { x: 6.3, y: 8.5 }, false],
  ])('%s', (_, id, position, isBehind) => {
    const scenery = depot.solids.map((s) => solid(s.id, s));
    const person = actor(position);
    for (const items of [[...scenery, person], [person, ...scenery].reverse()]) {
      const result = depthOrder(items).map((item) => item.id);
      expect(result.indexOf('actor') < result.indexOf(id)).toBe(isBehind);
    }
  });

  it('occludes a person behind a closed gate and shows them when it opens', () => {
    const person = actor({ x: 24.5, y: 19.7 });
    const gate = solid('gate', depot.gate);
    expect(depthOrder([gate, person]).map((item) => item.id)).toEqual(['actor', 'gate']);
    expect(depthOrder([person])).toEqual([person]);
  });

  it('keeps free-standing people ordered by their feet', () => {
    const near = solid('near', { x: 10, y: 10, w: 0, h: 0 });
    const far = solid('far', { x: 10.1, y: 9.7, w: 0, h: 0 });
    expect(depthOrder([near, far])).toEqual([far, near]);
  });
});
