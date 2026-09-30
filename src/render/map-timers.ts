import type { Rect, Vec } from '../sim/types';
import type { GuideTarget } from '../ui/objectives';
import type { MapTimer } from '../ui/map-timers';
import './map-timers.css';

const WIDTH = 118;
const headerHeight = 27,
  rowHeight = 27;
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + 6 && a.x + a.w + 6 > b.x && a.y < b.y + b.h + 6 && a.y + a.h + 6 > b.y;

/** Screen-space labels remain crisp and the same readable size at every zoom. */
export class MapTimers {
  private layer = document.createElement('div');
  private cards = new Map<GuideTarget, { root: HTMLElement; signature: string }>();
  constructor(host: HTMLElement) {
    this.layer.className = 'map-timers';
    this.layer.setAttribute('aria-hidden', 'true');
    host.appendChild(this.layer);
  }
  clear() {
    this.layer.replaceChildren();
    this.cards.clear();
  }
  has(id: GuideTarget) {
    return this.cards.has(id);
  }
  draw(
    timers: MapTimer[],
    project: (id: GuideTarget) => Vec | null,
    width: number,
    height: number,
  ) {
    const shown = new Set<GuideTarget>();
    const placed: Rect[] = [];
    for (const timer of timers) {
      const anchor = project(timer.target);
      // Never pin a timer to an unrelated edge of the map. The goal locators
      // and sidebar provide off-screen guidance independently.
      if (!anchor || anchor.x < 0 || anchor.x > width || anchor.y < 0 || anchor.y > height)
        continue;
      const h = headerHeight + timer.rows.length * rowHeight;
      const box: Rect = {
        x: Math.max(4, Math.min(width - WIDTH - 4, anchor.x - WIDTH / 2)),
        y: anchor.y - h - 15,
        w: WIDTH,
        h,
      };
      const candidates = [
        box.y,
        anchor.y + 18,
        ...placed.flatMap((p) => [p.y - h - 7, p.y + p.h + 7]),
      ];
      const y = candidates.find(
        (y) => y >= 4 && y + h <= height - 4 && !placed.some((p) => overlaps({ ...box, y }, p)),
      );
      if (y === undefined) continue;
      box.y = y;
      placed.push(box);
      shown.add(timer.target);
      let card = this.cards.get(timer.target);
      if (!card) {
        const root = document.createElement('div');
        root.className = 'map-timer';
        root.dataset.target = timer.target;
        root.innerHTML =
          '<i class="timer-leader"></i><strong></strong><div class="timer-rows"></div>';
        this.layer.appendChild(root);
        card = { root, signature: '' };
        this.cards.set(timer.target, card);
      }
      const { root } = card;
      root.style.transform = `translate(${box.x}px, ${box.y}px)`;
      const leader = root.firstElementChild as HTMLElement;
      const base = anchor.y >= box.y + h ? h : 0;
      const dx = anchor.x - (box.x + WIDTH / 2),
        dy = anchor.y - box.y - base;
      leader.style.top = `${base}px`;
      leader.style.height = `${Math.max(0, Math.hypot(dx, dy) - 10)}px`;
      leader.style.transform = `rotate(${Math.atan2(-dx, dy)}rad)`;
      const signature = `${timer.tag}/${timer.rows.map((r) => r.label).join('/')}`;
      if (signature !== card.signature) {
        root.querySelector('strong')!.textContent = timer.tag;
        const rows = root.querySelector('.timer-rows')!;
        rows.replaceChildren(
          ...timer.rows.map((row) => {
            const element = document.createElement('div');
            element.className = 'map-timer-row';
            element.innerHTML = '<span></span><b></b><i class="timer-track"><i></i></i>';
            element.firstElementChild!.textContent = row.label;
            return element;
          }),
        );
        card.signature = signature;
      }
      timer.rows.forEach((row, i) => {
        const element = root.querySelector('.timer-rows')!.children[i] as HTMLElement;
        element.dataset.tone = row.tone;
        element.classList.toggle('is-paused', !!row.paused);
        const value = row.paused
          ? 'Paused'
          : row.remaining === undefined
            ? ''
            : `${(Math.ceil(row.remaining * 10) / 10).toFixed(1)}s`;
        const text = element.querySelector('b')!;
        if (text.textContent !== value) text.textContent = value;
        (element.querySelector('.timer-track > i') as HTMLElement).style.transform =
          `scaleX(${row.fraction})`;
      });
    }
    for (const [id, card] of this.cards)
      if (!shown.has(id)) {
        card.root.remove();
        this.cards.delete(id);
      }
  }
}
