import type { World } from '../sim/types';
import { Director, eventCue } from './director';
import type { Cue } from './director';
import { centred, Mixer, placement } from './mixer';
import type { ListeningView, Voice } from './mixer';
import { loopSound, SOUND_IDS } from './palette';
import type { TypingSound } from './typing';

const VOLUME_KEY = 'amortization.volume.v1';
const ENABLED_KEY = 'amortization.sound.v1';
export class Sound {
  private context: AudioContext | null = null;
  private mixer: Mixer | null = null;
  private director = new Director();
  private loops = new Map<string, Voice>();
  private typing = new Set<Voice>();
  private world: World | null = null;
  private revision = 0;
  private loudness = 0.65;
  private pending: { revision: number; promise: Promise<void> } | null = null;
  enabled = false;
  constructor() {
    try {
      const saved = localStorage.getItem(VOLUME_KEY),
        value = Number(saved);
      if (saved !== null && Number.isFinite(value)) this.loudness = Math.max(0, Math.min(1, value));
      this.enabled = localStorage.getItem(ENABLED_KEY) === 'true';
    } catch {
      /* Storage is optional. */
    }
  }
  get volume() {
    return this.loudness;
  }
  setVolume(value: number) {
    if (!Number.isFinite(value)) return;
    this.loudness = Math.max(0, Math.min(1, value));
    this.mixer?.volume(this.enabled ? this.loudness : 0);
    try {
      localStorage.setItem(VOLUME_KEY, String(this.loudness));
    } catch {
      /* Storage is optional. */
    }
  }
  private saveEnabled() {
    try {
      localStorage.setItem(ENABLED_KEY, String(this.enabled));
    } catch {
      /* Storage is optional. */
    }
  }
  async toggle() {
    this.enabled = !this.enabled;
    ++this.revision;
    this.saveEnabled();
    if (!this.enabled) {
      this.silence();
      this.mixer?.volume(0);
      return;
    }
    await this.unlock(true);
  }
  /** Restore the preference on a user gesture, without autoplay on page load. */
  unlock(confirm = false): Promise<void> {
    if (!this.enabled || (!confirm && this.context?.state === 'running')) return Promise.resolve();
    const revision = this.revision;
    if (this.pending?.revision === revision) return this.pending.promise;
    const promise = this.activate(revision, confirm);
    this.pending = { revision, promise };
    void promise.finally(() => {
      if (this.pending?.promise === promise) this.pending = null;
    });
    return promise;
  }
  private async activate(revision: number, confirm: boolean) {
    try {
      this.context ??= new AudioContext();
      this.mixer ??= new Mixer(this.context);
      await this.context.resume();
      if (revision !== this.revision || !this.enabled) return;
      this.mixer.volume(this.loudness);
      if (confirm) this.mixer.play('confirm');
      void this.warm(revision).catch(() => {
        /* Preparation is optional; keep the live mixer usable. */
      });
    } catch {
      if (revision === this.revision) {
        this.enabled = false;
        this.silence();
        this.saveEnabled();
      }
    }
  }
  private async warm(revision: number) {
    // Spread preparation across turns. Subsequent fire uses cached PCM even
    // during busy fights.
    for (let variant = 0; variant < 3; variant++)
      for (const id of SOUND_IDS) {
        // Optional dialogue keys are tiny and cached on first use, not warmed
        // for players who only open the tactical game.
        if (id.startsWith('key-')) continue;
        if (revision !== this.revision || !this.enabled || !this.mixer) return;
        if (variant && loopSound(id)) continue;
        this.mixer.buffer(id, variant);
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
  }
  silence() {
    this.mixer?.silence();
    this.loops.clear();
    this.typing.clear();
  }
  type(id: TypingSound) {
    if (!this.enabled || !this.mixer || this.context?.state !== 'running' || document.hidden)
      return;
    for (const voice of this.typing)
      if (voice.stopped || voice.end <= this.context.currentTime) this.typing.delete(voice);
    const voice = this.mixer.play(id);
    if (voice) this.typing.add(voice);
  }
  stopTyping() {
    for (const voice of this.typing) this.mixer?.stop(voice);
    this.typing.clear();
  }
  reset(world: World) {
    this.silence();
    this.world = world;
    this.director.reset(world);
    world.sounds.length = 0;
  }
  update(world: World, view: ListeningView, running: boolean, audible = true) {
    if (this.world !== world) this.reset(world);
    const observed = this.director.update(world, running && audible);
    const events = world.sounds.splice(0);
    if (!this.enabled || !audible || !this.mixer || this.context?.state !== 'running') {
      this.silence();
      return;
    }
    const mixer = this.mixer;
    const locate = (cue: Cue) => (cue.position ? placement(cue.position, view) : centred);
    for (const event of events) {
      const cue = eventCue(event);
      mixer.play(cue.id, locate(cue), { level: cue.level });
    }
    // Footsteps are tied to planted feet, but a four-person formation should
    // not sound like twenty-four equally loud boots per second.
    let footsteps = 0;
    for (const cue of observed.cues.sort((a, b) => locate(b).gain - locate(a).gain)) {
      const where = locate(cue);
      if (cue.id === 'step' && (where.gain < 0.5 || footsteps++ >= 2)) continue;
      mixer.play(cue.id, where, { level: cue.level });
    }
    const desired = observed.loops;
    const wanted = new Set(desired.map((loop) => loop.key));
    for (const [key, voice] of this.loops)
      if (!wanted.has(key) || voice.stopped) {
        mixer.stop(voice);
        this.loops.delete(key);
      }
    for (const loop of desired) {
      const where = locate(loop),
        existing = this.loops.get(loop.key);
      if (existing) mixer.position(existing, where, loop.level, loop.rate);
      else {
        const voice = mixer.play(loop.id, where, { level: loop.level, rate: loop.rate });
        if (voice) this.loops.set(loop.key, voice);
      }
    }
  }
}
