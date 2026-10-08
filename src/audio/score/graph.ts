import { hold } from '../mixer';
import type { Command, Recipe, Score } from './types';

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(context: BaseAudioContext) {
  let buffer = noiseCache.get(context);
  if (!buffer) {
    buffer = context.createBuffer(1, Math.round(context.sampleRate * 4.013), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(context, buffer);
  }
  return buffer;
}
const member = (node: AudioNode, key: string) => (node as unknown as Record<string, unknown>)[key];
const parameter = (node: AudioNode, key: string) => member(node, key) as AudioParam;

/** Plays native node/automation recipes produced by SW Patch at authoring time.
 * This is deliberately not a patch-language interpreter or an audio renderer. */
export class Graph {
  readonly nodes: AudioNode[];
  readonly pitch: ConstantSourceNode;
  private sources: AudioScheduledSourceNode[] = [];
  private ended = 0;
  private disposed = false;
  onended = () => {};
  constructor(
    context: BaseAudioContext,
    private recipe: Recipe,
    destination: AudioNode,
    waves: PeriodicWave[],
    when: number,
  ) {
    this.pitch = context.createConstantSource();
    this.pitch.offset.value = 0;
    this.nodes = recipe.nodes.map(({ kind, args, props }) => {
      const node =
        kind === 'Gain'
          ? context.createGain()
          : kind === 'Oscillator'
            ? context.createOscillator()
            : kind === 'BufferSource'
              ? context.createBufferSource()
              : kind === 'BiquadFilter'
                ? context.createBiquadFilter()
                : kind === 'Delay'
                  ? context.createDelay(args[0])
                  : kind === 'ChannelMerger'
                    ? context.createChannelMerger(args[0])
                    : context.createConstantSource();
      for (const [key, value] of Object.entries(props)) {
        if (key === 'wave') (node as OscillatorNode).setPeriodicWave(waves[Number(value)]);
        else if (key === 'buffer') (node as AudioBufferSourceNode).buffer = noise(context);
        else {
          const target = member(node, key);
          if (target && typeof target === 'object' && 'value' in target)
            (target as AudioParam).value = Number(value);
          else (node as unknown as Record<string, unknown>)[key] = value;
        }
      }
      if ('start' in node) {
        const source = node as AudioScheduledSourceNode;
        this.sources.push(source);
        source.onended = () => {
          if (++this.ended === this.sources.length) this.dispose();
        };
      }
      return node;
    });
    const get = (id: number) => (id === -1 ? destination : id === -2 ? this.pitch : this.nodes[id]);
    for (const [from, to, param, output, input] of recipe.edges) {
      if (param) get(from).connect(parameter(get(to), param), output);
      else get(from).connect(get(to), output, input);
    }
    this.pitch.start(when);
    this.commands(recipe.on, when);
  }
  release(when: number) {
    this.commands(this.recipe.off, when);
  }
  stop(when: number) {
    for (const source of this.sources) source.stop(when);
    if (!this.sources.length) this.dispose();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pitch.stop();
    this.pitch.disconnect();
    for (const source of this.sources) {
      source.onended = null;
      source.stop();
    }
    for (const node of this.nodes) node.disconnect();
    this.onended();
  }
  private commands(commands: Command[], base: number) {
    for (const [id, key, op, offset, value, constant] of commands) {
      const node = this.nodes[id],
        when = base + offset;
      if (op === 'start') {
        if (node instanceof AudioBufferSourceNode)
          node.start(when, Math.random() * node.buffer!.duration);
        else (node as AudioScheduledSourceNode).start(when);
      } else if (op === 'stop') (node as AudioScheduledSourceNode).stop(when);
      else {
        const param = parameter(node, key);
        if (op === 'hold') hold(param, when);
        else if (op === 'set') param.setValueAtTime(value!, when);
        else if (op === 'linear') param.linearRampToValueAtTime(value!, when);
        else if (op === 'exponential') param.exponentialRampToValueAtTime(value!, when);
        else param.setTargetAtTime(value!, when, constant!);
      }
    }
  }
}
const waveCache = new WeakMap<BaseAudioContext, WeakMap<Score, PeriodicWave[]>>();
export function createWaves(context: BaseAudioContext, score: Score) {
  let cache = waveCache.get(context);
  if (!cache) {
    cache = new WeakMap();
    waveCache.set(context, cache);
  }
  let waves = cache.get(score);
  if (waves) return waves;
  waves = score.waves.map(([real, imag]) =>
    context.createPeriodicWave(Float32Array.from(real), Float32Array.from(imag)),
  );
  cache.set(score, waves);
  return waves;
}
