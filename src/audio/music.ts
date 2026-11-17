import type { World } from '../sim/types';
import { controllable, living } from '../sim/types';
import { visualTheme } from '../render/theme';
import type { ScorePlayer } from './score/player';
import type { MusicMood } from './score/types';
export type { MusicMood } from './score/types';

const RELEASE_SECONDS = 10;

/** An alarm can stay latched after a fight. Actual fire and an enemy pursuing a
 * living friendly drive the arrangement; merely investigating a noise does not. */
export class MusicDirector {
  private world: World | null = null;
  private shots = 0;
  private lastFight = -Infinity;
  update(world: World): MusicMood {
    if (this.world !== world) {
      this.world = world;
      this.shots = world.shots;
      this.lastFight = -Infinity;
    }
    const targets = new Set(world.agents.filter(controllable).map((a) => a.id));
    if (world.escort?.recruited && living(world.escort)) targets.add(world.escort.id);
    if (
      world.shots > this.shots ||
      world.guards.some((g) => living(g) && g.mode === 'combat' && targets.has(g.target ?? ''))
    )
      this.lastFight = world.time;
    this.shots = world.shots;
    return world.time - this.lastFight < RELEASE_SECONDS ? 'combat' : 'calm';
  }
}

type ScoreModule = typeof import('./score');

/** Prepare compact synthesis data only for audible night play. A late import
 * cannot restart muted/paused music or an operation with a different theme. */
export class Music {
  private module: ScoreModule | null = null;
  private loading = false;
  private failed = false;
  private player: ScorePlayer | null = null;
  private beat = 0;
  private active = false;
  private desired: MusicMood = 'calm';
  private director = new MusicDirector();
  constructor(
    private context: AudioContext,
    private output: AudioNode,
    private load: () => Promise<ScoreModule> = () => import('./score'),
  ) {}
  retry() {
    this.failed = false;
  }
  reset() {
    this.pause();
    this.beat = 0;
    this.director = new MusicDirector();
    this.retry();
  }
  update(world: World, running: boolean) {
    this.desired = this.director.update(world);
    if (!running || world.status !== 'playing' || visualTheme(world.mission) !== 'night') {
      this.pause();
      return;
    }
    this.active = true;
    if (!this.module && !this.loading && !this.failed) {
      this.loading = true;
      void this.load()
        .then((module) => {
          this.module = module;
          this.sync();
        })
        .catch(() => {
          this.failed = true;
        })
        .finally(() => {
          this.loading = false;
        });
    }
    this.sync();
  }
  private sync() {
    if (!this.active || !this.module || this.failed || this.context.state !== 'running') return;
    try {
      this.player ??= new this.module.ScorePlayer(
        this.context,
        this.output,
        this.module.score,
        this.beat,
        this.desired,
      );
      this.player.setMood(this.desired);
    } catch {
      // Keep existing effects usable if the browser cannot create a music graph.
      this.failed = true;
    }
  }

  pause() {
    this.active = false;
    if (!this.player) return;
    this.beat = this.player.transport.beatAt(this.context.currentTime) % this.module!.score.beats;
    this.player.stop();
    this.player = null;
  }
}
