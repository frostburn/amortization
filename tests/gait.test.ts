import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DOMAdapter } from 'pixi.js';
import {
  footfall,
  hipHeight,
  kneePosition,
  LEG_SEGMENT,
  walkPhase,
  WALK_STRIDE,
} from '../src/render/gait';
import { body } from '../src/sim/world';
import { PersonSprite } from '../src/render/person';

const walker = () => ({
  ...body('walker', { x: 2, y: 2 }, 100),
  previous: { x: 1.9, y: 2 },
  step: 0.3,
});

const adapter = DOMAdapter.get();
beforeAll(() =>
  DOMAdapter.set({
    ...adapter,
    // Geometry tests do not create a GPU context; real shader drawing is covered in Chromium.
    createCanvas: () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
  }),
);
afterAll(() => DOMAdapter.set(adapter));

describe('directional character animation', () => {
  it('walks upright with softly bent knees and fixed leg lengths through a full stride', () => {
    for (const phase of [null, ...Array.from({ length: 24 }, (_, i) => i / 24)]) {
      const hip = hipHeight(phase);
      for (const side of [0, 0.5]) {
        const foot = phase === null ? { forward: 0, lift: 0 } : footfall(phase + side);
        const ankle = foot.lift + 0.09;
        const knee = kneePosition(hip, foot.forward, ankle);
        expect(Math.hypot(knee.forward, knee.height - hip)).toBeCloseTo(LEG_SEGMENT);
        expect(Math.hypot(knee.forward - foot.forward, knee.height - ankle)).toBeCloseTo(
          LEG_SEGMENT,
        );
        expect(knee.forward).toBeGreaterThan(foot.forward / 2);
        // Zero is a straight leg. The supporting knee stays nearly straight;
        // the returning leg bends only enough to clear the ground.
        const bend = Math.acos(
          (knee.forward * (foot.forward - knee.forward) +
            (hip - knee.height) * (knee.height - ankle)) /
            LEG_SEGMENT ** 2,
        );
        expect(bend).toBeLessThan(((foot.lift === 0 ? 35 : 55) * Math.PI) / 180);
      }
    }
  });
  it('reuses posed geometry without destroying another visible character during reset', () => {
    const p = walker(),
      first = new PersonSprite(),
      second = new PersonSprite();
    first.pose(p, 1, { appearance: 'guard' });
    second.pose(p, 1, { appearance: 'guard' });
    const geometry = first.geometry;
    const buffer = geometry.getBuffer('aPosition');
    expect(second.geometry).toBe(geometry);
    first.destroy({ children: true });
    expect(buffer.destroyed).toBe(false);
    p.step += 0.12;
    second.pose(p, 1, { appearance: 'guard' });
    const movingGeometry = second.geometry;
    const movingBuffer = movingGeometry.getBuffer('aPosition');
    expect(movingGeometry).not.toBe(geometry);
    second.destroy();
    expect(buffer.destroyed).toBe(true);
    expect(movingBuffer.destroyed).toBe(true);
  });
  it('keeps varied patrol skin tones stable across shared poses, reinforcements and casualties', () => {
    const colors = (sprite: PersonSprite) => {
      const data = sprite.geometry.getBuffer('aColor').data;
      return new Set(
        Array.from({ length: data.length / 3 }, (_, i) =>
          [0, 1, 2].map((j) => Math.round(data[i * 3 + j] * 255)).join(','),
        ),
      );
    };
    const people = Array.from({ length: 12 }, (_, i) => ({
      ...walker(),
      id: i < 6 ? `guard-${i}` : `response-0-${i - 6}`,
    }));
    const before = JSON.stringify(people);
    const sprites = people.map((p) => {
      const sprite = new PersonSprite();
      sprite.pose(p, 1, { appearance: 'guard' });
      return sprite;
    });
    const palettes = sprites.map(colors);
    expect(new Set(sprites.map((s) => s.geometry)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(sprites.map((s) => s.geometry)).size).toBeLessThan(people.length);
    for (const sprite of sprites)
      expect(sprite.geometry.getBuffer('aPosition').data).toEqual(
        sprites[0].geometry.getBuffer('aPosition').data,
      );
    // Find a real skin color difference, then check that same identity after
    // another person uses the cache, after a fall, and after a mission rebuild.
    const skin = [...palettes[0]].find((c) => palettes.some((palette) => !palette.has(c)))!;
    expect(skin).toBeDefined();
    const rebuilt = new PersonSprite();
    rebuilt.pose({ ...people[0] }, 1, { appearance: 'guard' });
    expect(rebuilt.geometry).toBe(sprites[0].geometry);
    expect(JSON.stringify(people)).toBe(before);
    for (const specialist of [undefined, 'shield', 'marksman'] as const) {
      rebuilt.pose({ ...people[0], hp: 0 }, 1, { appearance: 'guard', specialist });
      expect(colors(rebuilt).has(skin)).toBe(true);
    }
    rebuilt.destroy();
    sprites.forEach((s) => s.destroy());
  });
  it('keeps the stance foot fixed in world space and lifts only the returning foot', () => {
    for (const phase of [0.05, 0.15, 0.3]) {
      const distance = 0.05;
      expect(footfall(phase + distance / WALK_STRIDE).forward + distance).toBeCloseTo(
        footfall(phase).forward,
      );
      expect(footfall(phase).lift).toBe(0);
      expect(footfall(phase + 0.5).lift).toBeGreaterThan(0);
    }
  });
  it('interpolates by distance and freezes when movement or life stops', () => {
    const p = walker();
    expect(walkPhase(p, 1)! - walkPhase(p, 0)!).toBeCloseTo(0.1 / WALK_STRIDE);
    p.previous = { x: p.x, y: p.y };
    p.path = [{ x: 10, y: 10 }];
    expect(walkPhase(p, 1)).toBeNull();
    p.previous.x -= 0.1;
    p.hp = 0;
    expect(walkPhase(p, 1)).toBeNull();
  });
  it('turns contact points with the body and keeps a stopped pair centered on the ground', () => {
    const p = walker(),
      sprite = new PersonSprite();
    p.previous = { x: p.x, y: p.y };
    p.angle = 0;
    sprite.pose(p, 1);
    const first = [...sprite.contacts];
    expect(first[0] + first[2]).toBeCloseTo(0);
    expect(first[1] + first[3]).toBeCloseTo(0);
    p.angle = Math.PI / 2;
    sprite.pose(p, 1);
    expect([...sprite.contacts]).not.toEqual(first);
    expect(sprite.scale.x).toBe(1);
    sprite.destroy();
  });
  it('draws a grounded body instead of fading and rotating the standing pose', () => {
    const p = walker(),
      sprite = new PersonSprite();
    p.angle = -Math.PI / 4;
    sprite.pose(p, 1, { appearance: 'sable' });
    const standing = sprite.getLocalBounds().height;
    p.hp = 0;
    sprite.pose(p, 1, { appearance: 'sable' });
    expect(sprite.getLocalBounds().height).toBeLessThan(standing / 2);
    expect(sprite.getLocalBounds().width).toBeGreaterThan(30);
    expect(sprite.alpha).toBe(1);
    expect(sprite.rotation).toBe(0);
    sprite.destroy();
  });
});
