import { canWalk, findPath } from '../sim/navigation';
import { position, distance, living, people } from '../sim/types';
import type { Person, Solid, Vec, World } from '../sim/types';
import { decayPressure } from '../sim/pressure';
import { turnShield } from '../sim/shield';
import { vanDeparture } from './van';

function walk(w: World, p: Person, speed: number, seconds: number) {
  let remaining = speed * seconds;
  while (remaining > 0 && p.path.length) {
    const target = p.path[0],
      length = distance(p, target);
    if (length < 0.001) {
      p.path.shift();
      continue;
    }
    const amount = Math.min(remaining, length),
      next = {
        ...(p.floor ? { floor: p.floor } : {}),
        x: p.x + ((target.x - p.x) * amount) / length,
        y: p.y + ((target.y - p.y) * amount) / length,
      };
    if (!canWalk(w, p, next)) {
      p.path = [];
      break;
    }
    p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    Object.assign(p, next);
    p.step += amount;
    remaining -= amount;
    if (amount === length) p.path.shift();
  }
}

/** Presentation after a result. Never advance the scored or recorded world. */
export class Aftermath {
  readonly world: World;
  readonly boarded = new Set<string>();
  readonly van: Solid | undefined;
  readonly offset: Vec = { x: 0, y: 0 };
  phase: 'boarding' | 'departing' | 'departed' | 'failed';
  private passengers: Person[];
  private door: Vec | null = null;
  private departure = 0;
  private age = 0;
  get resultsReady() {
    return this.age >= 3 && (this.phase === 'departed' || this.phase === 'failed');
  }
  get liftClosed() {
    return Math.min(1, this.departure / 1.4);
  }
  constructor(source: World) {
    this.world = structuredClone(source);
    // Share immutable map geometry and its navigation cache, not actor state.
    this.world.mission = source.mission;
    this.world.sounds = [];
    this.phase = source.status === 'won' ? 'boarding' : 'failed';
    this.passengers =
      source.status === 'won'
        ? [...this.world.agents, ...(this.world.escort ? [this.world.escort] : [])].filter(living)
        : [];
    const exit = source.mission.landmarks.find((o) => o.id === (source.extractedAt ?? 'extract'))!;
    this.van =
      source.status === 'won' && !source.mission.threshold
        ? source.mission.solids
            .filter((s) => s.kind === 'van')
            .sort(
              (a, b) =>
                distance(exit, { x: a.x + a.w / 2, y: a.y + a.h / 2 }) -
                distance(exit, { x: b.x + b.w / 2, y: b.y + b.h / 2 }),
            )[0]
        : undefined;
    if (this.van) {
      const v = this.van;
      // Board from the side facing the extraction ring, never through the body.
      this.door =
        v.h > v.w
          ? { x: exit.x > v.x + v.w / 2 ? v.x + v.w + 0.25 : v.x - 0.25, y: v.y + v.h * 0.48 }
          : { x: v.x + v.w * 0.48, y: exit.y > v.y + v.h / 2 ? v.y + v.h + 0.25 : v.y - 0.25 };
    }
    if (source.status === 'won' && source.mission.threshold)
      this.door = position(source.mission.threshold.door);
    for (const p of people(this.world)) {
      p.previous = position(p);
      p.cooldown = 0;
      if (p.armament) {
        p.armament.charging = undefined;
        p.armament.reload = 0;
      }
      p.path = [];
    }
    for (const a of this.world.agents) {
      a.order = { kind: 'hold' };
      a.weapon = false;
    }
    for (const g of this.world.guards) {
      g.mode = 'patrol';
      g.target = null;
      g.inspection = undefined;
      g.radio = 0;
      g.repath = 0;
    }
    for (const p of this.passengers) if (this.door) p.path = findPath(this.world, p, this.door);
  }
  update(seconds: number) {
    const dt = Math.max(0, Math.min(seconds, 0.1)),
      w = this.world;
    this.age += dt;
    w.time += dt;
    w.traces = w.traces.filter((t) => (t.life -= dt) > 0);
    for (const flash of w.flashGrenades ?? []) flash.age += dt;
    for (const p of people(w)) {
      p.previous = position(p);
      p.disoriented = Math.max(0, (p.disoriented ?? 0) - dt);
      decayPressure(p, dt);
    }
    for (const g of w.guards.filter(living)) {
      if (g.turret || !g.patrol.length) continue;
      g.repath -= dt;
      if (!g.path.length && g.repath <= 0) {
        g.repath = 1.5;
        if (distance(g, g.patrol[g.waypoint]) < 0.3)
          g.waypoint = (g.waypoint + 1) % g.patrol.length;
        g.path = findPath(w, g, g.patrol[g.waypoint]);
        if (!g.path.length) g.waypoint = (g.waypoint + 1) % g.patrol.length;
      }
      walk(w, g, 1.2, dt);
      turnShield(g, dt);
    }
    if (this.phase === 'boarding') {
      for (const p of this.passengers) {
        if (this.boarded.has(p.id)) continue;
        walk(w, p, 3.2, dt);
        if (this.door && distance(p, this.door) < 0.3) this.boarded.add(p.id);
      }
      // A completed extraction is final even for unusual/debug map geometry.
      if (this.age >= 5 || this.passengers.every((p) => this.boarded.has(p.id))) {
        for (const p of this.passengers) this.boarded.add(p.id);
        this.phase = this.van || w.mission.threshold ? 'departing' : 'departed';
      }
    }
    if (this.phase === 'departing' && this.van) {
      this.departure += dt;
      const v = this.van,
        { axis, length, edge, direction } = vanDeparture(v, w.mission);
      this.offset[axis] += direction * Math.min(8, this.departure * 3) * dt;
      if (v[axis] + this.offset[axis] > edge + 4 || v[axis] + length + this.offset[axis] < -4)
        this.phase = 'departed';
    }
    if (this.phase === 'departing' && w.mission.threshold) {
      this.departure += dt;
      if (this.liftClosed === 1) this.phase = 'departed';
    }
  }
}
