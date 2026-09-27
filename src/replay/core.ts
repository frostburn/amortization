import { missions } from '../content/missions';
import { applyCommand } from '../sim/commands';
import type { Command } from '../sim/commands';
import { STEP, step } from '../sim/step';
import { living } from '../sim/types';
import type { Mission, World } from '../sim/types';
import { createWorld } from '../sim/world';

export const MAX_TICKS = 108_000; // One hour of simulation, independent of planning time.
export const MAX_COMMANDS = 20_000;
export const MAX_FILE_SIZE = 4 * 1024 * 1024;
const CHECK_INTERVAL = 150;
export interface BuildInfo {
  revision: string;
  dirty: boolean;
  simulationHash: string;
}
interface Checkpoint {
  tick: number;
  commands: number;
  hash: string;
}
export interface ReplayBundle {
  format: 'amortization-replay';
  version: 1;
  id: string;
  startedAt: string;
  build: BuildInfo;
  mission: { id: Mission['id']; hash: string; definition: unknown };
  step: number;
  commands: { tick: number; command: Command }[];
  checkpoints: Checkpoint[];
  ticks: number;
  result: ReturnType<typeof outcome>;
  timing: { activeSeconds: number; planningSeconds: number; slowSeconds: number };
  note: string;
  endedBy: 'snapshot' | 'finished' | 'restart' | 'mission-change' | 'limit';
}

/** Stable checksum, not a security signature. Object key order does not affect it. */
export function fingerprint(value: unknown): string {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return v;
  };
  const text = JSON.stringify(canonical(value));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function stateHash(world: World) {
  // Rendering consumes sounds and interpolates previous positions. Neither affects gameplay.
  const ignored = new Set([
    'mission',
    'sounds',
    'traces',
    'notices',
    'message',
    'previous',
    'step',
  ]);
  const clean = (v: unknown): unknown => {
    // Suppress insignificant cross-engine differences in trigonometry.
    if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .filter(([key]) => !ignored.has(key))
          .map(([key, item]) => [key, clean(item)]),
      );
    return v;
  };
  return fingerprint(clean(world));
}

export function outcome(w: World) {
  return {
    status: w.status,
    alive: w.agents.filter(living).length,
    shots: w.shots,
    alarm: w.alarm,
    evidence: w.evidence,
    extractedAt: w.extractedAt,
  };
}

export class Recorder {
  tick = 0;
  note = '';
  readonly commands: ReplayBundle['commands'] = [];
  readonly timing = { activeSeconds: 0, planningSeconds: 0, slowSeconds: 0 };
  private checks: Checkpoint[];
  private frozen: ReplayBundle | null = null;
  private mission: ReplayBundle['mission'];
  constructor(
    readonly world: World,
    readonly build: BuildInfo,
    readonly id: string,
    readonly startedAt: string,
  ) {
    this.mission = {
      id: world.mission.id,
      definition: structuredClone(world.mission),
      hash: fingerprint(world.mission),
    };
    this.checks = [this.checkpoint()];
  }
  get stopped() {
    return this.frozen !== null;
  }
  get limited() {
    return this.frozen?.endedBy === 'limit';
  }
  command(command: Command) {
    if (this.stopped) return;
    if (this.commands.length >= MAX_COMMANDS) {
      this.finish('limit');
      return;
    }
    this.commands.push({ tick: this.tick, command: structuredClone(command) });
  }
  afterStep() {
    if (this.stopped) return;
    this.tick++;
    if (this.tick % CHECK_INTERVAL === 0) this.checks.push(this.checkpoint());
    if (this.world.status !== 'playing') this.finish('finished');
    else if (this.tick >= MAX_TICKS) this.finish('limit');
  }
  account(seconds: number, paused: boolean, slow: boolean) {
    if (this.stopped) return;
    if (paused) this.timing.planningSeconds += seconds;
    else {
      this.timing.activeSeconds += seconds;
      if (slow) this.timing.slowSeconds += seconds;
    }
  }
  private checkpoint(): Checkpoint {
    return { tick: this.tick, commands: this.commands.length, hash: stateHash(this.world) };
  }
  bundle(): ReplayBundle {
    if (this.frozen) return { ...structuredClone(this.frozen), note: this.note };
    const final = this.checkpoint(),
      checks = [...this.checks];
    const last = checks[checks.length - 1];
    if (last.tick === final.tick && last.commands === final.commands)
      checks[checks.length - 1] = final;
    else checks.push(final);
    return {
      format: 'amortization-replay',
      version: 1,
      id: this.id,
      startedAt: this.startedAt,
      build: { ...this.build },
      mission: structuredClone(this.mission),
      step: STEP,
      commands: structuredClone(this.commands),
      checkpoints: checks,
      ticks: this.tick,
      result: outcome(this.world),
      timing: { ...this.timing },
      note: this.note,
      endedBy: 'snapshot',
    };
  }
  finish(reason: ReplayBundle['endedBy']) {
    if (!this.frozen) this.frozen = { ...this.bundle(), endedBy: reason };
    return this.bundle();
  }
}

function requireValue(valid: unknown, message: string): asserts valid {
  if (!valid) throw new Error(message);
}
const integer = (v: unknown, max: number) =>
  Number.isInteger(v) && Number(v) >= 0 && Number(v) <= max;
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
const hash = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}$/.test(v);

/** Imported mission data is archival only. Playback always uses local, trusted mission code. */
export function parseReplay(raw: string): ReplayBundle {
  requireValue(raw.length <= MAX_FILE_SIZE, 'Replay is larger than 4 MiB.');
  try {
    const b = JSON.parse(raw) as ReplayBundle;
    requireValue(
      b?.format === 'amortization-replay' && b.version === 1,
      'Unsupported replay format/version.',
    );
    requireValue(
      text(b.id, 100) && text(b.startedAt, 80) && text(b.note, 4000),
      'Invalid attempt metadata.',
    );
    requireValue(
      text(b.build.revision, 80) &&
        typeof b.build.dirty === 'boolean' &&
        /^[a-f0-9]{64}$/.test(b.build.simulationHash),
      'Invalid build identity.',
    );
    const mission = missions.find((m) => m.id === b.mission.id);
    requireValue(
      mission && hash(b.mission.hash) && fingerprint(b.mission.definition) === b.mission.hash,
      'Invalid mission definition or checksum.',
    );
    const archived = b.mission.definition as Partial<Mission> | null;
    requireValue(
      archived?.id === b.mission.id &&
        Array.isArray(archived.landmarks) &&
        archived.landmarks.length <= 100 &&
        archived.landmarks.every((item) => item && text(item.id, 64)),
      'Invalid archived mission items.',
    );
    requireValue(
      b.step === STEP && integer(b.ticks, MAX_TICKS),
      'Invalid simulation duration or step.',
    );
    requireValue(
      ['snapshot', 'finished', 'restart', 'mission-change', 'limit'].includes(b.endedBy),
      'Invalid end reason.',
    );
    requireValue(
      ['playing', 'won', 'lost'].includes(b.result.status) &&
        integer(b.result.alive, 4) &&
        integer(b.result.shots, 1_000_000) &&
        typeof b.result.alarm === 'boolean' &&
        ['courier', 'available', 'carried', 'extracted'].includes(b.result.evidence) &&
        [null, 'extract', 'alternate'].includes(b.result.extractedAt),
      'Invalid result.',
    );
    for (const field of ['activeSeconds', 'planningSeconds', 'slowSeconds'] as const)
      requireValue(
        Number.isFinite(b.timing[field]) && b.timing[field] >= 0 && b.timing[field] <= 604800,
        'Invalid timing.',
      );
    requireValue(b.timing.slowSeconds <= b.timing.activeSeconds, 'Slow time exceeds active time.');
    requireValue(
      Array.isArray(b.commands) && b.commands.length <= MAX_COMMANDS,
      'Too many commands.',
    );
    let priorTick = 0;
    for (const entry of b.commands) {
      requireValue(
        integer(entry.tick, b.ticks) && entry.tick >= priorTick,
        'Commands are out of tick order.',
      );
      priorTick = entry.tick;
      const c = entry.command;
      requireValue(
        c &&
          [
            'move',
            'interact',
            'attack',
            'hold',
            'weapons',
            'heal',
            'drop',
            'escort-aid',
            'escort-wait',
          ].includes(c.kind),
        'Unknown command.',
      );
      if (c.kind !== 'escort-wait')
        requireValue(
          Array.isArray(c.agents) &&
            c.agents.length <= 4 &&
            new Set(c.agents).size === c.agents.length &&
            c.agents.every((id) => /^agent-[0-3]$/.test(id)),
          'Invalid command recipients.',
        );
      if (c.kind === 'move')
        requireValue(
          c.point &&
            Number.isFinite(c.point.x) &&
            Number.isFinite(c.point.y) &&
            Math.abs(c.point.x) <= 1000 &&
            Math.abs(c.point.y) <= 1000,
          'Invalid movement coordinates.',
        );
      if (c.kind === 'interact')
        requireValue(
          archived.landmarks.some((o) => o.id === c.target),
          'Unknown recorded mission item.',
        );
      if (c.kind === 'attack')
        requireValue(
          typeof c.target === 'string' && /^(guard-\d+|response-\d+-\d+|courier)$/.test(c.target),
          'Invalid attack target.',
        );
    }
    requireValue(
      Array.isArray(b.checkpoints) && b.checkpoints.length > 0 && b.checkpoints.length <= 10000,
      'Invalid checkpoints.',
    );
    let previous: Checkpoint | undefined;
    for (const check of b.checkpoints) {
      requireValue(
        integer(check.tick, b.ticks) &&
          integer(check.commands, b.commands.length) &&
          hash(check.hash),
        'Invalid checkpoint.',
      );
      requireValue(
        !previous ||
          (check.tick >= previous.tick &&
            check.commands >= previous.commands &&
            (check.tick > previous.tick || check.commands > previous.commands)),
        'Checkpoints are out of order.',
      );
      requireValue(
        (check.commands === 0 || b.commands[check.commands - 1].tick <= check.tick) &&
          (check.commands === b.commands.length || b.commands[check.commands].tick >= check.tick),
        'Unreachable checkpoint.',
      );
      previous = check;
    }
    const first = b.checkpoints[0],
      last = b.checkpoints[b.checkpoints.length - 1];
    requireValue(
      first.tick === 0 &&
        first.commands === 0 &&
        last.tick === b.ticks &&
        last.commands === b.commands.length,
      'Replay needs initial and final checkpoints.',
    );
    return b;
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError)
      throw new Error('Invalid replay JSON or missing fields.', { cause: error });
    throw error;
  }
}

export function compatibility(bundle: ReplayBundle, build: BuildInfo): string[] {
  const issues: string[] = [];
  if (bundle.build.simulationHash !== build.simulationHash)
    issues.push('Simulation code differs from the recording.');
  if (bundle.mission.hash !== fingerprint(missions.find((m) => m.id === bundle.mission.id)))
    issues.push('Mission configuration differs from the recording.');
  return issues;
}

export class ReplayPlayer {
  readonly world: World;
  tick = 0;
  error: string | null = null;
  done = false;
  private cursor = 0;
  private check = 0;
  constructor(
    readonly bundle: ReplayBundle,
    build: BuildInfo,
    readonly currentRules = false,
  ) {
    const mission = missions.find((m) => m.id === bundle.mission.id)!;
    this.world = createWorld(mission);
    const issues = compatibility(bundle, build);
    if (!currentRules && issues.length)
      throw new Error(
        `${issues.join(' ')} Check out the recorded revision or choose Try current rules.`,
      );
    this.boundary();
  }
  private fail(message: string) {
    this.error = `Tick ${this.tick}, command ${this.cursor}: ${message}`;
    this.done = true;
  }
  private checkState() {
    const check = this.bundle.checkpoints[this.check];
    if (check?.tick !== this.tick || check.commands !== this.cursor) return;
    if (!this.currentRules && check.hash !== stateHash(this.world))
      this.fail('simulation state diverged.');
    this.check++;
  }
  private boundary() {
    this.checkState();
    while (
      !this.error &&
      this.bundle.commands[this.cursor]?.tick === this.tick &&
      (!this.currentRules || this.world.status === 'playing')
    ) {
      if (this.world.status !== 'playing') {
        this.fail('command arrived after the mission ended.');
        return;
      }
      applyCommand(this.world, this.bundle.commands[this.cursor++].command);
      this.checkState();
    }
    if (this.error) return;
    if (this.tick === this.bundle.ticks || this.world.status !== 'playing') {
      this.done = true;
      if (this.currentRules) {
        if (this.world.status !== this.bundle.result.status)
          this.fail(
            `current outcome is ${this.world.status}; recorded outcome was ${this.bundle.result.status}.`,
          );
      } else if (
        this.tick !== this.bundle.ticks ||
        this.check !== this.bundle.checkpoints.length ||
        fingerprint(outcome(this.world)) !== fingerprint(this.bundle.result)
      )
        this.fail('final result differs.');
    }
  }
  advance() {
    if (this.done) return;
    step(this.world);
    this.tick++;
    this.boundary();
    this.world.sounds.length = 0;
  }
}

export function verifyReplay(bundle: ReplayBundle, build: BuildInfo, currentRules = false) {
  const player = new ReplayPlayer(bundle, build, currentRules);
  while (!player.done) player.advance();
  return { tick: player.tick, error: player.error, result: outcome(player.world), currentRules };
}
