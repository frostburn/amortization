// Execute SW Patch's own interpreter against a recording AudioContext. The result
// is a native node graph plus onset/release automation, not another patch parser.
// Unsupported nodes fail compilation instead of silently changing an instrument.
export function tracePatch() {
  const nodes = [],
    edges = [],
    on = [],
    off = [];
  let commands = on;
  const paramNames = {
    Oscillator: { frequency: 440, detune: 0 },
    Gain: { gain: 1 },
    BiquadFilter: { frequency: 350, Q: 1, detune: 0, gain: 0 },
    Delay: { delayTime: 0 },
    ConstantSource: { offset: 1 },
    BufferSource: { playbackRate: 1, detune: 0 },
    ChannelMerger: {},
  };
  const node = (kind, args = [], external) => {
    if (!(kind in paramNames)) throw new Error(`Unsupported music node: ${kind}`);
    const id = external ?? nodes.length;
    const spec = { kind, args, props: {} };
    if (external === undefined) nodes.push(spec);
    const result = {
      id,
      connect(target, output = 0, input = 0) {
        edges.push([id, target.id, target.param ?? '', output, input]);
        return target;
      },
      disconnect() {},
      addEventListener() {},
      removeEventListener() {},
      start(when = 0) {
        commands.push([id, '', 'start', Number(when)]);
      },
      stop(when = 0) {
        commands.push([id, '', 'stop', Number(when)]);
      },
      setPeriodicWave(wave) {
        spec.props.wave = wave;
      },
    };
    for (const [name, initial] of Object.entries(paramNames[kind])) {
      let value = initial;
      result[name] = {
        id,
        param: name,
        get value() {
          return value;
        },
        set value(v) {
          value = Number(v);
          spec.props[name] = value;
        },
        setValueAtTime(v, time) {
          commands.push([id, name, 'set', time, v]);
        },
        linearRampToValueAtTime(v, time) {
          commands.push([id, name, 'linear', time, v]);
        },
        exponentialRampToValueAtTime(v, time) {
          commands.push([id, name, 'exponential', time, v]);
        },
        setTargetAtTime(v, time, constant) {
          commands.push([id, name, 'target', time, v, constant]);
        },
        cancelAndHoldAtTime(time) {
          commands.push([id, name, 'hold', time]);
        },
      };
    }
    for (const name of ['type', 'loop', 'buffer'])
      Object.defineProperty(result, name, {
        get: () => spec.props[name],
        set: (value) => {
          spec.props[name] = name === 'buffer' ? 'noise' : value;
        },
      });
    return result;
  };
  const context = {
    currentTime: 0,
    sampleRate: 100, // Noise is a marker only; generated at the player's sample rate.
    audioWorklet: { addModule: async () => {} },
    createPeriodicWave: (real, imag) => [Array.from(real), Array.from(imag)],
    createBuffer: (_channels, length) => ({
      duration: length / 100,
      getChannelData: () => new Float32Array(length),
    }),
  };
  for (const kind of Object.keys(paramNames))
    context[`create${kind}`] = (...args) => node(kind, args);
  const destination = node('Gain', [], -1);
  const pitch = node('ConstantSource', [], -2);
  return {
    context,
    destination,
    pitch,
    release(callback) {
      commands = off;
      const tail = Number(callback(0));
      return tail;
    },
    recipe: (tail = 0) => ({ nodes, edges, on, off, tail }),
  };
}
