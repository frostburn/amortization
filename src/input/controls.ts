import type { Scene } from '../render/scene';
import type { Hit } from '../render/scene';
import type { Vec, World } from '../sim/types';
import type { Hud, Action } from '../ui/hud';

export interface ControlsTarget {
  world: () => World;
  selection: () => string[];
  select: (ids: string[]) => void;
  order: (hit: Hit) => void;
  action: (action: Action) => void;
  slow: (enabled: boolean) => void;
}
export function bindControls(scene: Scene, hud: Hud, target: ControlsTarget) {
  const stage = hud.stage,
    canvas = scene.app.canvas;
  let start: Vec | null = null,
    last: Vec | null = null,
    button = 0,
    drag = false,
    add = false,
    pointerType = 'mouse';
  const position = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    start = position(e);
    last = start;
    button = e.button;
    drag = false;
    add = e.shiftKey;
    pointerType = e.pointerType;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!start || !last) return;
    const p = position(e);
    if (Math.hypot(p.x - start.x, p.y - start.y) > 5) drag = true;
    if (drag) {
      if (button === 1 || pointerType === 'touch') scene.panBy(p.x - last.x, p.y - last.y);
      else if (button === 0) hud.selectionBox(start, p);
    }
    last = p;
  });
  const cancel = () => {
    start = null;
    last = null;
    hud.selectionBox(null);
  };
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerup', (e) => {
    if (!start) return;
    const p = position(e);
    if (drag && button === 0 && pointerType !== 'touch') {
      const ids = target
        .world()
        .agents.filter((a) => {
          const q = scene.screen(a);
          return (
            a.hp > 0 &&
            q.x >= Math.min(start!.x, p.x) &&
            q.x <= Math.max(start!.x, p.x) &&
            q.y >= Math.min(start!.y, p.y) &&
            q.y <= Math.max(start!.y, p.y)
          );
        })
        .map((a) => a.id);
      target.select(add ? [...new Set([...target.selection(), ...ids])] : ids);
    } else if (!drag && button !== 1) {
      const hit = scene.hit(p.x, p.y);
      if (button === 0 && hit.kind === 'agent')
        target.select(
          add
            ? target.selection().includes(hit.id)
              ? target.selection().filter((id) => id !== hit.id)
              : [...target.selection(), hit.id]
            : [hit.id],
        );
      else target.order(hit);
    }
    cancel();
  });
  stage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      scene.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    },
    { passive: false },
  );
  const mapping: Record<string, Action> = {
    q: 'all',
    g: 'regroup',
    s: 'hold',
    f: 'weapons',
    e: 'interact',
    h: 'heal',
    x: 'drop',
    ' ': 'pause',
    v: 'vision',
    Home: 'home',
  };
  document.addEventListener('keydown', (e) => {
    if (
      hud.modal.open ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      (e.target as HTMLElement).matches('input,textarea')
    )
      return;
    if (e.key === 'Tab') {
      e.preventDefault();
      target.slow(true);
      return;
    }
    if (e.repeat) return;
    if (/^[1-4]$/.test(e.key)) {
      const a = target.world().agents[Number(e.key) - 1];
      if (a.hp > 0)
        target.select(e.shiftKey ? [...new Set([...target.selection(), a.id])] : [a.id]);
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'r' && e.shiftKey) {
      e.preventDefault();
      target.action('restart');
    } else if (mapping[e.key.toLowerCase()] || mapping[e.key]) {
      e.preventDefault();
      target.action(mapping[e.key.toLowerCase()] || mapping[e.key]);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      scene.panBy(
        e.key === 'ArrowLeft' ? 45 : e.key === 'ArrowRight' ? -45 : 0,
        e.key === 'ArrowUp' ? 45 : e.key === 'ArrowDown' ? -45 : 0,
      );
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      target.slow(false);
    }
  });
  window.addEventListener('blur', () => {
    target.slow(false);
    cancel();
  });
}
