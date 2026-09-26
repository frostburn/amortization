import { describe, expect, it } from 'vitest';
import { poseWalker, WALK_STRIDE } from '../src/render/gait';
import { body } from '../src/sim/world';
import { Texture, TextureSource } from 'pixi.js';
import { PersonSprite } from '../src/render/person';

const rest = new Float32Array([18, 39, 26, 39, 22, 9]);
const walker = () => ({ ...body('walker', { x: 2, y: 2 }, 100), previous: { x: 1.9, y: 2 } });

describe('walking cycle', () => {
  it('keeps atlas-sized textures in a person-sized mesh, including disguise changes', () => {
    const texture = new Texture({ source: new TextureSource({ width: 640, height: 640 }) });
    const uniform = new Texture({ source: new TextureSource({ width: 640, height: 640 }) });
    const sprite = new PersonSprite(texture);
    const p = walker();
    p.previous = { x: p.x, y: p.y };
    for (const variant of [0, 1, 2, 3, 0]) {
      sprite.setArt(variant === 1 ? uniform : texture, variant);
      sprite.pose(p, 1);
      expect(sprite.getLocalBounds().width).toBeCloseTo(43);
      expect(sprite.getLocalBounds().height).toBeCloseTo(43);
      expect(sprite.contacts[0] + sprite.contacts[2]).toBeCloseTo(0);
      expect(sprite.contacts[1] + sprite.contacts[3]).toBeCloseTo(0);
    }
    sprite.destroy();
    texture.destroy(true);
    uniform.destroy(true);
  });

  it('alternates the feet while keeping the upper body steady', () => {
    const p = walker(),
      first = rest.slice(),
      second = rest.slice();
    p.step = WALK_STRIDE / 4;
    poseWalker(rest, first, p, 1);
    p.step += WALK_STRIDE / 2;
    poseWalker(rest, second, p, 1);
    expect((first[0] - rest[0]) * (first[2] - rest[2])).toBeLessThan(0);
    expect((first[0] - rest[0]) * (second[0] - rest[0])).toBeLessThan(0);
    expect(Math.abs(first[0] - second[0])).toBeGreaterThan(4);
    expect(Math.abs(first[5] - rest[5])).toBeLessThan(0.5);
  });

  it('keeps the planted sole on its contact shadow while the other foot lifts', () => {
    const p = walker(),
      boots = rest.slice(),
      shadows = rest.slice();
    p.step = WALK_STRIDE / 8;
    poseWalker(rest, boots, p, 1);
    poseWalker(rest, shadows, p, 1, true);
    expect(boots[1]).toBeCloseTo(shadows[1]);
    expect(boots[3]).toBeLessThan(shadows[3] - 1);
    expect(boots[0]).toBeCloseTo(shadows[0]);
    expect(boots[2]).toBeCloseTo(shadows[2]);
  });

  it('interpolates by distance, freezes at the same simulation state, and stands still without movement', () => {
    const p = walker(),
      before = rest.slice(),
      after = rest.slice(),
      paused = rest.slice();
    p.step = 0.28;
    poseWalker(rest, before, p, 0);
    poseWalker(rest, after, p, 1);
    expect(after).not.toEqual(before);
    poseWalker(rest, paused, p, 1);
    expect(paused).toEqual(after);
    p.previous = { x: p.x, y: p.y };
    p.path = [{ x: 10, y: 10 }];
    poseWalker(rest, after, p, 1);
    expect(after).toEqual(rest);
    p.previous.x -= 0.1;
    p.hp = 0;
    poseWalker(rest, after, p, 1);
    expect(after).toEqual(rest);
  });
});
