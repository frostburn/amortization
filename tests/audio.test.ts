import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Director, eventCue } from '../src/audio/director';
import { placement } from '../src/audio/mixer';
import { clockedNoise } from '../src/audio/noise';
import { loopSound, SOUND_IDS, synthesize } from '../src/audio/palette';
import { depot } from '../src/content/depot';
import { mandate } from '../src/content/mandate';
import { parseReplay, ReplayPlayer, stateHash } from '../src/replay/core';
import { shoot } from '../src/sim/combat';
import { completeInteraction } from '../src/sim/orders';
import { TURRET_LOCK } from '../src/sim/security';
import { cancelCharge, COIL_CHARGE, equip } from '../src/sim/weapons';
import { createWorld } from '../src/sim/world';

describe('sound palette and placement', () => {
  it('clocks held and interpolated noise in Hz independently of output sample rate', () => {
    const render = (rate: number, interpolation: 'constant' | 'linear', frequency = 375) => {
      let n = 0;
      const noise = clockedNoise(() => Math.sin(++n * 1234), rate, interpolation);
      return Array.from({ length: rate / 8 }, () => noise(frequency));
    };
    for (const mode of ['constant', 'linear'] as const) {
      expect(render(24000, mode)).toEqual(render(48000, mode).filter((_, i) => i % 2 === 0));
    }
    const held = render(24000, 'constant'),
      linear = render(24000, 'linear'),
      faster = render(24000, 'constant', 750);
    const changes = (samples: number[]) =>
      samples.slice(1).filter((x, i) => x !== samples[i]).length;
    expect(changes(held)).toBe(46);
    expect(changes(faster)).toBe(93);
    expect(Math.max(...linear.map(Math.abs))).toBeLessThanOrEqual(1);
    expect(Math.max(...linear.slice(1).map((x, i) => Math.abs(x - linear[i])))).toBeLessThan(0.04);
  });

  it('keeps footsteps subdued and low-passed across sample rates and variants', () => {
    const w = createWorld(mandate),
      d = new Director();
    d.reset(w);
    w.agents[0].step = 0.6;
    const level = d.update(w, true).cues.find((c) => c.id === 'step')!.level!;
    const energy = (pcm: Float32Array) => pcm.reduce((sum, x) => sum + x * x, 0) / pcm.length;
    for (const rate of [24000, 48000])
      for (let variant = 0; variant < 3; variant++) {
        const step = synthesize('step', rate, variant),
          pistol = synthesize('pistol', rate, variant),
          alpha = 1 - Math.exp((-2 * Math.PI * 1500) / rate);
        let low = 0,
          highEnergy = 0;
        for (const sample of step) {
          low += alpha * (sample - low);
          highEnergy += (sample - low) ** 2;
        }
        // Check the rendered signal and actual cue level, not just filter settings.
        expect(highEnergy / step.length / energy(step)).toBeLessThan(0.01);
        expect(Math.sqrt(energy(step) / energy(pistol)) * level).toBeLessThan(0.05);
      }
  });

  it('renders finite, audible clips with headroom and quiet one-shot endings', () => {
    for (const id of SOUND_IDS) {
      const pcm = synthesize(id, 24000);
      let peak = 0,
        power = 0;
      for (const value of pcm) {
        peak = Math.max(peak, Math.abs(value));
        power += value * value;
      }
      expect(Number.isFinite(power), id).toBe(true);
      expect(peak, id).toBeLessThanOrEqual(0.921);
      expect(Math.sqrt(power / pcm.length), id).toBeGreaterThan(0.001);
      if (!loopSound(id)) expect(Math.abs(pcm.at(-1)!), id).toBe(0);
    }
  });

  it('makes reproducible, distinct weapon timbres and non-identical repeated shots', () => {
    const ids = ['pistol', 'carbine', 'shotgun', 'automatic', 'coil'] as const;
    const fingerprints = ids.map((id) => {
      const pcm = synthesize(id, 24000, 1);
      expect(pcm).toEqual(synthesize(id, 24000, 1));
      expect(pcm).not.toEqual(synthesize(id, 24000, 2));
      return [...pcm.slice(0, 256)].join(',');
    });
    expect(new Set(fingerprints).size).toBe(5);
  });

  it('pans by the isometric screen and attenuates distance independently of zoom', () => {
    const view = { centre: { x: 10, y: 10 }, width: 800, scale: 1 };
    expect(placement({ x: 12, y: 8 }, view).pan).toBeGreaterThan(0);
    expect(placement({ x: 8, y: 12 }, view).pan).toBeLessThan(0);
    expect(placement({ x: 10, y: 10 }, view)).toMatchObject({ pan: 0, gain: 1 });
    const distant = { x: 30, y: 10 },
      quiet = placement(distant, view);
    expect(quiet.gain).toBeLessThan(0.3);
    expect(quiet.cutoff).toBeLessThan(6000);
    expect(placement(distant, { ...view, scale: 3 }).gain).toBe(quiet.gain);
    expect(placement(distant, { ...view, centre: distant }).gain).toBe(1);
  });
});

describe('gameplay audio cues', () => {
  it('announces recruiting Voss as centred mission feedback', () => {
    const w = createWorld(depot),
      a = w.agents[0];
    a.x = w.escort!.x;
    a.y = w.escort!.y;
    completeInteraction(w, a, 'escort');
    expect(w.escort!.recruited).toBe(true);
    const event = w.sounds.find((s) => s.kind === 'interact' && s.action === 'escort')!;
    // No world position: the cue remains clear with a distant/split-team camera.
    expect(eventCue(event)).toEqual({ id: 'objective' });
  });

  it('identifies the actual weapon and material hit, including fatal hits', () => {
    const w = createWorld(structuredClone(mandate));
    w.mission.solids = [];
    w.gateOpen = true;
    const shooter = w.agents[0],
      turret = w.guards.find((g) => g.turret)!;
    Object.assign(shooter, { x: 2, y: 2, armament: equip('shotgun') });
    Object.assign(turret, { x: 3, y: 2, hp: 10 });
    expect(shoot(w, shooter, turret, false)).toBe(true);
    expect(w.sounds.map(eventCue)).toEqual([
      { id: 'shotgun', position: { x: 2, y: 2 } },
      { id: 'wreck', position: { x: 3, y: 2 }, level: 0.45 },
    ]);
    expect(w.shots).toBe(1);
    expect(w.casualties).toBe(1);
  });

  it('uses walking distance, emits reload transitions once, and avoids a resume backlog', () => {
    const w = createWorld(mandate),
      d = new Director(),
      a = w.agents[0];
    d.reset(w);
    a.step = 0.6;
    expect(d.update(w, true).cues.map((c) => c.id)).toEqual(['step']);
    expect(d.update(w, true).cues).toEqual([]);
    a.armament!.reload = 1.2;
    expect(d.update(w, true).cues.map((c) => c.id)).toEqual(['reload']);
    expect(d.update(w, true).cues).toEqual([]);
    a.armament!.reload = 0;
    expect(d.update(w, true).cues.map((c) => c.id)).toEqual(['ready']);
    a.step = 20;
    expect(d.update(w, false)).toEqual({ cues: [], loops: [] });
    expect(d.update(w, true).cues).toEqual([]);
  });

  it('follows coil progress, cancellation, pause and target changes without mutating the world', () => {
    const w = createWorld(mandate),
      d = new Director(),
      a = w.agents[3];
    d.reset(w);
    a.armament!.charging = { target: 'guard-0', remaining: COIL_CHARGE };
    const before = stateHash(w),
      first = d.update(w, true).loops[0];
    expect(stateHash(w)).toBe(before);
    a.armament!.charging.remaining = 0.2;
    const later = d.update(w, true).loops[0];
    expect(later.rate).toBeGreaterThan(first.rate);
    expect(d.update(w, false).loops).toEqual([]);
    expect(d.update(w, true).loops[0].rate).toBe(later.rate);
    a.armament!.charging.target = 'guard-1';
    expect(d.update(w, true).loops[0].key).not.toBe(first.key);
    cancelCharge(a);
    expect(d.update(w, true).loops).toEqual([]);
  });

  it('stops a sentry acquisition sound when tracking is broken or completes', () => {
    const w = createWorld(mandate),
      d = new Director(),
      g = w.guards.find((p) => p.turret)!;
    d.reset(w);
    g.target = 'agent-0';
    g.turret!.lock = 0.3;
    expect(d.update(w, true).loops[0].id).toBe('tracking');
    g.turret!.lock = TURRET_LOCK;
    expect(d.update(w, true).loops).toEqual([]);
    g.turret!.lock = 0.2;
    g.target = null;
    expect(d.update(w, true).loops).toEqual([]);
  });

  it('does not replay old death and reload cues when changing worlds', () => {
    const d = new Director(),
      w = createWorld(mandate);
    d.reset(w);
    w.status = 'lost';
    expect(d.update(w, false).cues.map((c) => c.id)).toEqual(['failed']);
    expect(d.update(w, false).cues).toEqual([]);
    const next = createWorld(mandate);
    next.agents[0].armament!.reload = 0.5;
    expect(d.update(next, false)).toEqual({ cues: [], loops: [] });
    expect(d.update(next, true).cues).toEqual([]);
  });

  it('preserves sounds for normal-speed viewing without changing replay state', () => {
    const bundle = parseReplay(
      readFileSync('tests/replays/mandate-full-crew-rally-ad0da662.replay.json', 'utf8'),
    );
    const audible = new ReplayPlayer(bundle, bundle.build, true),
      silent = new ReplayPlayer(bundle, bundle.build, true);
    let shots = 0;
    for (let i = 0; i < 270; i++) {
      audible.advance(true);
      silent.advance();
      shots += audible.world.sounds.filter((s) => s.kind === 'shot').length;
      audible.world.sounds.length = 0;
      expect(silent.world.sounds).toEqual([]);
    }
    expect(shots).toBeGreaterThan(0);
    expect(stateHash(audible.world)).toBe(stateHash(silent.world));
  });
});
