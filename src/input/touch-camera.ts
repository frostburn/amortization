import type { Vec } from '../sim/types';
import type { Scene } from '../render/scene';

/** Once a second finger lands, the entire gesture belongs to the camera, including the last lift. */
export function bindTouchCamera(
  canvas: HTMLCanvasElement,
  scene: Scene,
  position: (e: PointerEvent) => Vec,
  cancelOrder: () => void,
) {
  const fingers = new Map<number, Vec>();
  let navigating = false;
  function pair() {
    const [a, b] = fingers.values();
    if (!a || !b) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, span: Math.hypot(a.x - b.x, a.y - b.y) };
  }
  function consume(e: PointerEvent) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'touch') return;
      fingers.set(e.pointerId, position(e));
      if (fingers.size < 2) return;
      if (!navigating) {
        navigating = true;
        cancelOrder();
        scene.setPointerActive(true);
      }
      canvas.setPointerCapture(e.pointerId);
      consume(e);
    },
    true,
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (!fingers.has(e.pointerId)) return;
      const before = navigating ? pair() : null;
      fingers.set(e.pointerId, position(e));
      if (!navigating) return;
      const after = pair();
      if (before && after) {
        if (before.span >= 8 && after.span >= 8 && before.span !== after.span)
          scene.zoomBy(after.span / before.span, before);
        scene.panBy(after.x - before.x, after.y - before.y);
      }
      consume(e);
    },
    true,
  );
  const end = (e: PointerEvent) => {
    if (!fingers.delete(e.pointerId) || !navigating) return;
    if (!fingers.size) {
      navigating = false;
      scene.setPointerActive(false);
    }
    consume(e);
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
    canvas.addEventListener(type, end, true);
  return () => {
    fingers.clear();
    navigating = false;
  };
}
