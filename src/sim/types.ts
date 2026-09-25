export const EXTRACTION_RADIUS = 4;

export interface Vec {
  x: number;
  y: number;
}
export interface Rect extends Vec {
  w: number;
  h: number;
}
export interface Solid extends Rect {
  id: string;
  kind: 'wall' | 'tram' | 'crate' | 'building' | 'van' | 'shelves';
  height: number;
}
export type ObjectKind =
  'disguise' | 'gate' | 'relay' | 'evidence' | 'engineer' | 'extract' | 'override' | 'breach';
export interface Landmark extends Vec {
  id: ObjectKind;
  tag: string;
  label: string;
  detail: string;
}
export interface Mission {
  id: 'depot' | 'archive';
  number: string;
  title: string;
  location: string;
  objective: 'escort' | 'ledger';
  description: string;
  briefing: { lead: string; body: string; routes: { title: string; body: string }[] };
  intro: string;
  evidenceName: string;
  gateOutside: Vec;
  response: { spawns: Vec[]; patrol: Vec[] };
  archive?: { door: Rect; inside: Vec };
  width: number;
  height: number;
  solids: Solid[];
  gate: Rect;
  restricted: Rect;
  secure: Rect;
  landmarks: Landmark[];
  guards: { position: Vec; patrol: Vec[]; angle: number }[];
  spawns: Vec[];
}
export type Order =
  | { kind: 'hold' }
  | { kind: 'move'; target: Vec }
  | { kind: 'interact'; target: ObjectKind }
  | { kind: 'attack'; target: string };
export interface Person extends Vec {
  id: string;
  previous: Vec;
  hp: number;
  maxHp: number;
  angle: number;
  path: Vec[];
  cooldown: number;
  step: number;
}
export interface Operative extends Person {
  name: string;
  role: string;
  index: number;
  weapon: boolean;
  disguised: boolean;
  exposed: boolean;
  order: Order;
  medkit: boolean;
  carrying: boolean;
  interaction: number;
}
export interface Guard extends Person {
  patrol: Vec[];
  waypoint: number;
  suspicion: Record<string, number>;
  known: string[];
  mode: 'patrol' | 'challenge' | 'combat';
  radio: number;
  reported: boolean;
  target: string | null;
  lastSeen: Vec | null;
  searchTime: number;
  repath: number;
}
export interface Engineer extends Person {
  leader: string | null;
  recruited: boolean;
  repath: number;
}
export interface Trace {
  from: Vec;
  to: Vec;
  life: number;
  hostile: boolean;
}
export interface Notice {
  time: number;
  text: string;
  kind: 'info' | 'warning';
}
export interface SoundEvent {
  kind: 'shot' | 'alarm' | 'interact' | 'hit';
  x: number;
}
export interface World {
  mission: Mission;
  agents: Operative[];
  guards: Guard[];
  engineer: Engineer | null;
  time: number;
  status: 'playing' | 'won' | 'lost';
  gateOpen: boolean;
  shutterOpen: boolean;
  shutterBreached: boolean;
  overrideBy: string | null;
  relayOff: boolean;
  disguiseTaken: boolean;
  evidence: 'available' | 'carried' | 'extracted';
  evidencePosition: Vec;
  alarm: boolean;
  alarmTime: number;
  waves: number;
  known: string[];
  traces: Trace[];
  notices: Notice[];
  sounds: SoundEvent[];
  shots: number;
  casualties: number;
  message: string;
}
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const inside = (p: Vec, r: Rect) =>
  p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
export const living = (p: Person) => p.hp > 0;
export const people = (w: World): Person[] => [
  ...w.agents,
  ...w.guards,
  ...(w.engineer ? [w.engineer] : []),
];
