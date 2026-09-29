import { UPDATE_PRIORITY } from 'pixi.js';
import type { Scene } from '../render/scene';
import type { Hit } from '../render/scene';
import { living } from '../sim/types';
import type { Rect, Vec, World } from '../sim/types';
import type { Hud, Action } from '../ui/hud';
import { armedSelection, attackPreview, objectRequirement } from '../ui/interactions';

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
    pressed: Hit | null = null,
    button = 0,
    pointer: number | null = null,
    drag = false,
    add = false,
    pointerType = 'mouse';
  let mouse: Vec | null = null;
  let flash: { id: string; until: number } | null = null;
  let pointerWorld = target.world();
  const marker = document.createElement('div');
  marker.className = 'combat-target';
  marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true');
  stage.appendChild(marker);
  const position = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const inspect = (hit: Hit | null) => {
    hud.inspectGuard(hit?.kind === 'guard' ? hit.id : null);
    hud.inspectObject(hit?.kind === 'object' ? hit.id : null);
  };
  const updatePointer = () => {
    const w = target.world(),
      selected = target.selection();
    if (w !== pointerWorld) {
      pointerWorld = w;
      flash = null;
    }
    const overMap = mouse && document.elementFromPoint(mouse.x, mouse.y) === canvas;
    const bounds = canvas.getBoundingClientRect();
    const hit = start
      ? pressed
      : overMap
        ? scene.hit(mouse!.x - bounds.left, mouse!.y - bounds.top)
        : null;
    const active = !hud.modal.open && w.status === 'playing';
    const guard =
      active && !drag
        ? w.guards.find(
            (g) =>
              living(g) &&
              (hit?.kind === 'guard'
                ? g.id === hit.id
                : !mouse && flash && performance.now() < flash.until && g.id === flash.id),
          )
        : undefined;
    const preview = guard ? attackPreview(w, selected, guard) : null;
    let cursor = active && armedSelection(w, selected).some((a) => a.weapon) ? 'combat' : 'default';
    if (active) {
      if (start && button === 1) cursor = 'pan';
      else if (drag) cursor = pointerType === 'touch' ? 'pan' : 'box';
      else if (hit?.kind === 'guard' && preview) cursor = preview.kind;
      else if (hit?.kind === 'agent') cursor = 'select';
      else if (hit?.kind === 'object')
        cursor = objectRequirement(w, hit.id, selected) ? 'locked' : 'interact';
    }
    if (canvas.dataset.cursor !== cursor) canvas.dataset.cursor = cursor;
    // Re-hit a stationary mouse after camera, selection and weapon changes.
    // A held press retains its original target until release, just like orders.
    if (mouse && !drag) inspect(active ? hit : null);
    marker.hidden = !guard || !!drag || (start !== null && button === 1);
    if (guard && preview) {
      const box = scene.agentBounds(guard);
      marker.dataset.target = guard.id;
      marker.dataset.state = preview.kind;
      marker.style.transform = `translate(${box.x - 4}px, ${box.y - 4}px)`;
      marker.style.width = `${box.w + 8}px`;
      marker.style.height = `${box.h + 8}px`;
    }
  };
  // Follow the current rendered camera, not its position before the gameplay tick.
  scene.app.ticker.add(updatePointer, undefined, UPDATE_PRIORITY.LOW);
  canvas.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'touch') mouse = { x: e.clientX, y: e.clientY };
    updatePointer();
  });
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
    mouse = pointerType === 'touch' ? null : { x: e.clientX, y: e.clientY };
    flash = null;
    pressed = scene.hit(start.x, start.y, button === 2 || pointerType === 'touch');
    scene.setPointerActive(true);
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    updatePointer();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') mouse = { x: e.clientX, y: e.clientY };
    if (!start) {
      updatePointer();
      return;
    }
    if (!last || e.pointerId !== pointer) return;
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
    updatePointer();
  });
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'touch') {
      mouse = null;
      if (!start) inspect(null);
      updatePointer();
    }
  });
  const cancel = () => {
    scene.setPointerActive(false);
    start = null;
    last = null;
    pressed = null;
    pointer = null;
    drag = false;
    hud.selectionBox(null);
    updatePointer();
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
            !a.captive &&
            a.hp > 0 &&
            q.x + q.w >= r.x &&
            q.x <= r.x + r.w &&
            q.y + q.h >= r.y &&
            q.y <= r.y + r.h
          );
        })
        .map((a) => a.id);
      // A missed box must not leave the crew without an active selection.
      if (ids.length) target.select(add ? [...new Set([...target.selection(), ...ids])] : ids);
    } else if (!drag && button !== 1 && pressed) {
      // Honour what was pressed, even if a character moves before release.
      const hit = pressed;
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
      else {
        inspect(hit);
        target.order(hit);
        if (pointerType === 'touch' && hit.kind === 'guard')
          flash = { id: hit.id, until: performance.now() + 800 };
      }
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
    Home: 'follow',
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
      ((e.target as HTMLElement).closest('.objective-actions, .crew-aid, summary') &&
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
    mouse = null;
    flash = null;
    inspect(null);
    cancel();
  });
}
