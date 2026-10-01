import { Graphics } from 'pixi.js';
import { interactionPoint } from '../sim/orders';
import { FLASH_FLIGHT } from '../sim/flash';
import { disoriented, distance, living } from '../sim/types';
import type { Operative, Vec, World } from '../sim/types';
import { project } from './isometric';

export interface CuttingSite {
  worker: Operative;
  point: Vec;
  angle: number;
}

/** CUT's actual work state, including the alternative approach from inside a door. */
export function cuttingSite(w: World, a: Operative): CuttingSite | null {
  if (
    w.status !== 'playing' ||
    !living(a) ||
    disoriented(a) ||
    a.carrying ||
    w.flashGrenades?.some((g) => g.thrower === a.id && g.age < FLASH_FLIGHT) ||
    a.order.kind !== 'interact' ||
    a.order.target !== 'breach' ||
    a.interaction <= 0 ||
    a.path.length ||
    distance(a, interactionPoint(w, a, 'breach')) >= 1.15
  )
    return null;
  const surface =
    w.mission.finale?.door ??
    w.mission.archive?.door ??
    w.mission.solids.find((s) => s.kind === 'transport');
  if (!surface) return null;
  const point = {
    ...(surface.floor ? { floor: surface.floor } : {}),
    x: Math.max(surface.x, Math.min(surface.x + surface.w, a.x)),
    y: Math.max(surface.y, Math.min(surface.y + surface.h, a.y)),
  };
  const angle = Math.atan2(point.y - a.y, point.x - a.x);
  // Keep the arc on the visible face, rather than buried inside the shutter.
  point.x -= Math.cos(angle) * 0.035;
  point.y -= Math.sin(angle) * 0.035;
  return { worker: a, point, angle };
}

interface Emitter {
  root: Graphics;
  site: CuttingSite;
  since: number;
  last: number;
  active: boolean;
  seed: number;
}
const LIFETIME = 0.7;
const RATE = 36;
const noise = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Bounded, deterministic visual particles. Pausing freezes them; stopping leaves a short tail. */
export class CuttingEffects {
  private emitters = new Map<string, Emitter>();
  private time = -1;
  clear() {
    for (const e of this.emitters.values()) e.root.destroy();
    this.emitters.clear();
    this.time = -1;
  }
  update(sites: CuttingSite[], time: number) {
    if (time < this.time) this.clear();
    const previousTime = this.time;
    this.time = time;
    for (const e of this.emitters.values()) e.active = false;
    for (const site of sites) {
      let emitter = this.emitters.get(site.worker.id);
      if (!emitter) {
        emitter = {
          root: new Graphics(),
          site,
          since: time,
          last: time,
          active: true,
          seed: [...site.worker.id].reduce((n, c) => n * 31 + c.charCodeAt(0), 0) % 997,
        };
        this.emitters.set(site.worker.id, emitter);
      }
      if (emitter.last < previousTime) emitter.since = time;
      emitter.site = site;
      emitter.last = time;
      emitter.active = true;
    }
    const result = [];
    for (const [id, e] of this.emitters) {
      if (time - e.last > LIFETIME) {
        e.root.destroy();
        this.emitters.delete(id);
        continue;
      }
      this.draw(e, time);
      result.push({ root: e.root, footprint: { ...e.site.point, w: 0, h: 0 } });
    }
    return result;
  }
  private draw(e: Emitter, time: number) {
    const {
      root: g,
      site: { point, worker, angle },
    } = e;
    g.clear();
    g.position.copyFrom(project(point));
    const tip = project({ x: 0, y: 0 }, 1.02);
    if (e.active) {
      const source = project(
        {
          x: worker.x + Math.cos(angle) * 0.59 - point.x,
          y: worker.y + Math.sin(angle) * 0.59 - point.y,
        },
        1.04,
      );
      g.moveTo(source.x, source.y)
        .lineTo(tip.x, tip.y)
        .stroke({ color: 0x83cbd4, width: 1.4, alpha: 0.55 });
      g.circle(tip.x, tip.y, 7).fill({ color: 0xf0b45e, alpha: 0.12 });
      g.circle(tip.x, tip.y, 2.3 + noise(Math.floor(time * 18)) * 1.2).fill(0xfff0c1);
    }
    const last = Math.floor(e.last * RATE);
    for (
      let n = Math.max(Math.ceil(e.since * RATE), Math.floor((time - LIFETIME) * RATE));
      n <= last;
      n++
    ) {
      const age = time - n / RATE;
      if (age < 0 || age > LIFETIME) continue;
      const seed = n + e.seed;
      const direction = angle + Math.PI + (noise(seed) - 0.5) * 2.2;
      const speed = 0.6 + noise(seed + 7) * 2;
      const lift = 0.15 + noise(seed + 19) * 1.2;
      const impact = (lift + Math.sqrt(lift * lift + 19.2 * 1.02)) / 9.6;
      const at = (t: number) => {
        const bounce = Math.max(0, t - impact);
        const travel = Math.min(t, impact) + bounce * 0.35;
        const z =
          bounce > 0
            ? Math.max(0.02, (9.6 * impact - lift) * 0.23 * bounce - 4.8 * bounce * bounce)
            : 1.02 + lift * t - 4.8 * t * t;
        return project(
          { x: Math.cos(direction) * speed * travel, y: Math.sin(direction) * speed * travel },
          z,
        );
      };
      const p = at(age),
        tail = at(Math.max(0, age - 0.045));
      const fade = 1 - age / LIFETIME;
      g.moveTo(tail.x, tail.y)
        .lineTo(p.x, p.y)
        .stroke({ color: age < 0.18 ? 0xffedac : 0xe99b4b, width: 0.7 + fade * 0.8, alpha: fade });
      if (age < 0.25) g.circle(p.x, p.y, 0.65).fill({ color: 0xfff6d5, alpha: fade });
    }
  }
}
