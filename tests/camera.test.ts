import { expect, it } from 'vitest';
import { clearing } from '../src/content/clearing';
import { followOffset, selectionFocus } from '../src/render/camera';
import { createWorld } from '../src/sim/world';

it('tracks interpolated team movement and switches to a distant selected operative', () => {
  const w = createWorld(clearing),
    ids = w.agents.map((a) => a.id);
  expect(selectionFocus(w, ids, 1)).toMatchObject({ x: 5.5, y: 38.5 });
  const a = w.agents[0];
  Object.assign(a, { x: 45, y: 17, previous: { x: 43, y: 17 } });
  expect(selectionFocus(w, [a.id], 0.5)).toMatchObject({ x: 44, y: 17 });
  expect(selectionFocus(w, ids, 1)).toMatchObject({ x: 17 / 3, y: 116 / 3 });
  a.hp = 0;
  expect(selectionFocus(w, [a.id], 1)).toBeNull();
});

it('keeps the first selected operative active when equally sized groups split', () => {
  const w = createWorld(clearing);
  w.agents.slice(0, 2).forEach((a) => Object.assign(a, { x: 45, y: 17 }));
  const ids = w.agents.map((a) => a.id);
  expect(selectionFocus(w, ids, 1)).toMatchObject({ x: 45, y: 17 });
  expect(selectionFocus(w, [...ids].reverse(), 1)).toMatchObject({ x: 5.5, y: 39 });
});

it('anticipates the local route, prioritizes movement over backwards aim, and uses facing at rest', () => {
  const w = createWorld(clearing),
    a = w.agents[0];
  a.angle = Math.PI; // Firing west while an eastbound order remains active.
  a.path = [
    { x: a.x + 3, y: a.y },
    { x: a.x + 3, y: a.y - 10 },
  ];
  a.order = { kind: 'move', target: a.path[1] };
  expect(selectionFocus(w, [a.id], 1)!.lookAhead).toEqual({ x: 2.5, y: 0 });
  // Reaching the bend looks north along the route, not towards the old heading.
  a.path.shift();
  a.x += 3;
  a.previous = { x: a.x, y: a.y };
  expect(selectionFocus(w, [a.id], 1)!.lookAhead).toEqual({ x: 0, y: -2.5 });
  a.path = [];
  a.order = { kind: 'hold' };
  expect(selectionFocus(w, [a.id], 1)!.lookAhead.x).toBeCloseTo(-1.2);
});

it('ignores remote and fallen headings and cancels opposing local directions', () => {
  const w = createWorld(clearing),
    [a, b, c, d] = w.agents;
  a.angle = 0;
  b.angle = Math.PI;
  c.x = c.y = 30;
  d.hp = 0;
  const focus = selectionFocus(
    w,
    w.agents.map((p) => p.id),
    1,
  )!;
  expect(Math.hypot(focus.lookAhead.x, focus.lookAhead.y)).toBeLessThan(1e-8);
  b.path = [{ x: b.x, y: b.y - 5 }];
  // One operative settling into formation must not pull the whole team's view at full strength.
  expect(selectionFocus(w, [a.id, b.id], 1)!.lookAhead).toEqual({ x: 0, y: -1.25 });
});

it('leads smoothly through reversals at different frame rates without losing the operative', () => {
  const view = { width: 800, height: 600 };
  const pan = followOffset({ x: 300, y: 318 }, { x: -100, y: 0 }, view, 1 / 60);
  expect(pan.x).toBeGreaterThan(0);
  expect(pan.x).toBeLessThan(25); // A reversal must not snap across the full 200-pixel lead.
  const settle = (fps: number) => {
    const point = { x: 300, y: 318 };
    for (let i = 0; i < fps / 2; i++) {
      const offset = followOffset(point, { x: -100, y: 0 }, view, 1 / fps);
      point.x += offset.x;
      point.y += offset.y;
    }
    return point;
  };
  expect(Math.abs(settle(30).x - settle(120).x)).toBeLessThan(2);
  const phone = { width: 390, height: 400 },
    far = { x: 1500, y: -300 };
  const recovered = followOffset(far, { x: 700, y: -500 }, phone, 1 / 60);
  expect(far.x + recovered.x).toBeLessThan(phone.width * 0.85);
  expect(far.y + recovered.y).toBeGreaterThan(phone.height * 0.17);
  const selected = followOffset(far, { x: 700, y: -500 }, phone, 0, true);
  expect(far.x + selected.x).toBeCloseTo(phone.width * 0.35);
  expect(far.y + selected.y).toBeCloseTo(phone.height * 0.68);
  const wideGroup = followOffset(
    { x: 195, y: 200 },
    { x: 150, y: 0 },
    { ...phone, inset: { x: 155, y: 50 } },
    0,
    true,
  );
  expect(195 + wideGroup.x).toBeGreaterThanOrEqual(155); // Lead must not clip the rear operative.
});

it('keeps small formation and aim changes still and bounds larger visible corrections', () => {
  const view = { width: 800, height: 600 };
  for (const lead of [
    { x: 18, y: 10 },
    { x: -18, y: -10 },
    { x: 0, y: 0 },
  ]) {
    const pan = followOffset({ x: 400, y: 318 }, lead, view, 1 / 60);
    expect(Math.hypot(pan.x, pan.y)).toBe(0);
  }
  const correction = followOffset({ x: 80, y: 85 }, { x: -100, y: 50 }, view, 1 / 60);
  expect(Math.hypot(correction.x, correction.y)).toBeLessThanOrEqual(3.000001);
  expect(Math.hypot(correction.x, correction.y)).toBeGreaterThan(0);
});

it('keeps pace at close zoom without repeated off-screen recovery jumps', () => {
  const view = { width: 390, height: 450, scale: 3 };
  const point = { x: 150, y: 220 };
  for (let i = 0; i < 180; i++) {
    point.x += 6; // 360 screen pixels/second at close zoom.
    expect(point.x).toBeLessThan(view.width);
    const pan = followOffset(point, { x: 150, y: 0 }, view, 1 / 60);
    expect(Math.hypot(pan.x, pan.y)).toBeLessThanOrEqual(9.000001);
    point.x += pan.x;
    point.y += pan.y;
  }
});
