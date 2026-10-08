export type MusicMood = 'calm' | 'combat';
export type NodeKind =
  | 'Gain'
  | 'Oscillator'
  | 'BufferSource'
  | 'BiquadFilter'
  | 'Delay'
  | 'ChannelMerger'
  | 'ConstantSource';
export type Command = [
  node: number,
  param: string,
  op: 'start' | 'stop' | 'set' | 'linear' | 'exponential' | 'target' | 'hold',
  time: number,
  value?: number,
  constant?: number,
];
export interface Recipe {
  nodes: { kind: NodeKind; args: number[]; props: Record<string, number | string | boolean> }[];
  edges: [from: number, to: number, param: string, output: number, input: number][];
  on: Command[];
  off: Command[];
  tail: number;
}
export interface Pitch {
  initial: number;
  curves: { offset: number; duration: number; values: number[] }[];
}
export interface ScoreNote {
  beat: number;
  duration: number;
  voice: number;
  pitch?: Pitch;
  fx: boolean;
  mask: number;
}
export interface Score {
  beats: number;
  bpm: Record<MusicMood, number>;
  waves: [number[], number[]][];
  recipes: Recipe[];
  effect: Recipe & { input: number };
  notes: ScoreNote[];
}
