import { living, people } from '../sim/types';
import type { Person, SoundEvent, Vec, World } from '../sim/types';
import { COIL_CHARGE } from '../sim/weapons';
import { TURRET_LOCK } from '../sim/security';
import { WALK_STRIDE } from '../render/gait';
import type { SoundId } from './palette';

export interface Cue {
  id: SoundId;
  position?: Vec;
  level?: number;
}
export interface Sustained extends Cue {
  key: string;
  rate: number;
}
export function eventCue(event: SoundEvent): Cue {
  const position = { x: event.x, y: event.y };
  if (event.kind === 'shot') return { id: event.weapon, position };
  if (event.kind === 'hit')
    return {
      id: event.metal ? (event.fatal ? 'wreck' : 'metal') : event.fatal ? 'fall' : 'body',
      position,
      level: event.friendly ? 0.8 : 0.45,
    };
  if (event.kind === 'alarm') return { id: 'alarm' };
  if (event.kind === 'blast') return { id: 'blast', position };
  if (event.kind === 'flash') return { id: 'flash', position };
  // Recruiting an escort is mission feedback, independent of camera distance.
  if (
    event.action === 'key-lift' ||
    event.action === 'file-recall' ||
    event.action === 'escort' ||
    event.action === 'rescue-vale' ||
    event.action === 'rescue-rook'
  )
    return { id: 'objective' };
  const id: SoundId =
    event.action === 'relay'
      ? 'relay'
      : event.action === 'power-west' || event.action === 'power-east'
        ? 'breaker'
        : ['gate', 'breach', 'release', 'override'].includes(event.action)
          ? 'door'
          : event.action === 'disguise'
            ? 'cloth'
            : event.action === 'heal'
              ? 'heal'
              : ['evidence', 'drop'].includes(event.action)
                ? 'pickup'
                : ['extract', 'alternate'].includes(event.action)
                  ? 'complete'
                  : 'terminal';
  return { id, ...(id === 'complete' ? {} : { position }) };
}

interface Previous {
  step: number;
  reload: number;
  radio: boolean;
}
/** Observes visual/audio state only. It never writes to people or gameplay clocks. */
export class Director {
  private previous = new Map<string, Previous>();
  private world: World | null = null;
  private status: World['status'] = 'playing';
  reset(world: World) {
    this.world = world;
    this.status = world.status;
    this.previous.clear();
    for (const person of people(world)) this.remember(person);
  }
  private remember(p: Person) {
    this.previous.set(p.id, {
      step: p.step,
      reload: p.armament?.reload ?? 0,
      radio: 'radio' in p && Number(p.radio) > 0,
    });
  }
  update(world: World, running: boolean): { cues: Cue[]; loops: Sustained[] } {
    if (this.world !== world) this.reset(world);
    const cues: Cue[] = [],
      loops: Sustained[] = [];
    const current = people(world);
    const guards = new Map(world.guards.map((g) => [g.id, g]));
    if (world.status === 'lost' && this.status === 'playing') cues.push({ id: 'failed' });
    for (const p of current) {
      const prior = this.previous.get(p.id),
        gun = p.armament;
      if (running && living(p)) {
        if (prior) {
          if (Math.floor(p.step / (WALK_STRIDE / 2)) > Math.floor(prior.step / (WALK_STRIDE / 2)))
            cues.push({ id: 'step', position: { x: p.x, y: p.y }, level: 0.12 });
          if ((gun?.reload ?? 0) > prior.reload)
            cues.push({ id: 'reload', position: p, level: 0.5 });
          if (prior.reload > 0 && gun?.reload === 0)
            cues.push({ id: 'ready', position: p, level: 0.45 });
          if ('radio' in p && Number(p.radio) > 0 && !prior.radio && !world.relayOff)
            cues.push({ id: 'radio', position: p, level: 0.8 });
        }
        if (gun?.charging) {
          const progress = 1 - gun.charging.remaining / COIL_CHARGE;
          loops.push({
            id: 'charge',
            key: `charge:${p.id}:${gun.charging.target}`,
            position: p,
            level: 0.35 + progress * 0.7,
            rate: 0.8 + progress * 1.9,
          });
        }
        const guard = guards.get(p.id);
        if (guard?.turret && guard.target && guard.turret.lock < TURRET_LOCK)
          loops.push({
            id: 'tracking',
            key: `tracking:${p.id}:${guard.target}`,
            position: p,
            level: 1,
            rate: 0.7 + guard.turret.lock / TURRET_LOCK,
          });
      }
      this.remember(p);
    }
    const ids = new Set(current.map((p) => p.id));
    for (const id of this.previous.keys()) if (!ids.has(id)) this.previous.delete(id);
    this.status = world.status;
    return { cues, loops };
  }
}
