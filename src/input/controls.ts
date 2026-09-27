import type { Scene } from '../render/scene';
import type { Hit } from '../render/scene';
import type { Rect, Vec, World } from '../sim/types';
import type { Hud, Action } from '../ui/hud';

export interface ControlsTarget {
  world: () => World;
  selection: () => string[];
  select: (ids: string[]) => void;
  order: (hit: Hit) => void;
  action: (action: Action) => void;
  slow: (enabled: boolean) => void;
}
function selectionArea(a: Vec, b: Vec): Rect {
  const w = Math.max(12, Math.abs(b.x - a.x)),
    h = Math.max(12, Math.abs(b.y - a.y));
  return { x: (a.x + b.x - w) / 2, y: (a.y + b.y - h) / 2, w, h };
}
export function bindControls(scene: Scene, hud: Hud, target: ControlsTarget) {
  const stage = hud.stage,
    canvas = scene.app.canvas;
  let start: Vec | null = null,
    last: Vec | null = null,
    button = 0,
    pointer: number | null = null,
    drag = false,
    add = false,
    pointerType = 'mouse';
  const position = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || start || e.button > 2) return;
    canvas.focus({ preventScroll: true });
    start = position(e);
    pointer = e.pointerId;
    last = start;
    button = e.button;
    drag = false;
    add = e.shiftKey;
    pointerType = e.pointerType;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!start || !last || e.pointerId !== pointer) return;
    const p = position(e);
    if (Math.hypot(p.x - start.x, p.y - start.y) > 8) drag = true;
    if (drag) {
      if (button === 1 || pointerType === 'touch') scene.panBy(p.x - last.x, p.y - last.y);
      else if (button === 0) {
        const r = selectionArea(start, p);
        hud.selectionBox(r, { x: r.x + r.w, y: r.y + r.h });
      }
    }
    last = p;
  });
  const cancel = () => {
    start = null;
    last = null;
    pointer = null;
    hud.selectionBox(null);
  };
  for (const event of ['pointercancel', 'lostpointercapture'] as const)
    canvas.addEventListener(event, (e) => {
      if (e.pointerId === pointer) cancel();
    });
  canvas.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== pointer) return;
    const p = position(e);
    if (drag && button === 0 && pointerType !== 'touch') {
      const r = selectionArea(start, p);
      const ids = target
        .world()
        .agents.filter((a) => {
          const q = scene.agentBounds(a);
          return (
            a.hp > 0 && q.x + q.w >= r.x && q.x <= r.x + r.w && q.y + q.h >= r.y && q.y <= r.y + r.h
          );
        })
        .map((a) => a.id);
      // A missed box must not leave the crew without an active selection.
      if (ids.length) target.select(add ? [...new Set([...target.selection(), ...ids])] : ids);
    } else if (!drag && button !== 1) {
      const hit = scene.hit(p.x, p.y, button === 2 || pointerType === 'touch');
      if (button === 0 && pointerType !== 'touch' && hit.kind === 'agent')
        target.select(
          add
            ? target.selection().includes(hit.id)
              ? target.selection().filter((id) => id !== hit.id)
              : [...target.selection(), hit.id]
            : target.selection().includes(hit.id)
              ? target.selection()
              : [hit.id],
        );
      else target.order(hit);
    }
    cancel();
  });
  stage.addEventListener(
    'wheel',
    (e) => {
      if ((e.target as HTMLElement).closest('.objective-guide')) return;
      e.preventDefault();
      scene.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    },
    { passive: false },
  );
  const mapping: Record<string, Action> = {
    '?': 'objectives',
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
      (e.target as HTMLElement).matches('input,textarea,select') ||
      (e.target as HTMLElement).closest('[data-playtest]')
    )
      return;
    if (e.key === 'Escape' && hud.guideOpen) {
      e.preventDefault();
      hud.clearGuide(true);
      return;
    }
    // Mission help is keyboard-navigable; gameplay shortcuts keep working after squad clicks.
    const buttonTarget = (e.target as HTMLElement).closest('button');
    if (
      ((e.target as HTMLElement).closest('.objective-actions, .crew-aid') &&
        [' ', 'Enter', 'Tab'].includes(e.key)) ||
      (buttonTarget && e.key === 'Tab' && hud.guideOpen) ||
      ((e.target as HTMLElement).closest('[data-goal], .objective-guide') &&
        [' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key))
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
