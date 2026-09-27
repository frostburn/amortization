import { describe, expect, it } from 'vitest';
import { footfall, walkPhase, WALK_STRIDE } from '../src/render/gait';
import { body } from '../src/sim/world';
import { PersonSprite } from '../src/render/person';

const walker = () => ({
  ...body('walker', { x: 2, y: 2 }, 100),
  previous: { x: 1.9, y: 2 },
  step: 0.3,
});

describe('directional character animation', () => {
  it('reuses posed geometry without destroying another visible character during reset', () => {
    const p = walker(),
      first = new PersonSprite(),
      second = new PersonSprite();
    first.pose(p, 1, { appearance: 'guard' });
    second.pose(p, 1, { appearance: 'guard' });
    const context = first.context;
    expect(second.context).toBe(context);
    first.destroy({ children: true });
    expect(context.destroyed).toBe(false);
    p.step += 0.12;
    second.pose(p, 1, { appearance: 'guard' });
    const movingContext = second.context;
    expect(movingContext).not.toBe(context);
    second.destroy();
    expect(context.destroyed).toBe(true);
    expect(movingContext.destroyed).toBe(true);
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
