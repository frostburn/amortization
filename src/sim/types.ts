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
  kind:
    | 'wall'
    | 'tram'
    | 'crate'
    | 'container'
    | 'building'
    | 'van'
    | 'transport'
    | 'shelves'
    | 'mast'
    | 'server';
  height: number;
}
export type ObjectKind =
  | 'disguise'
  | 'gate'
  | 'relay'
  | 'evidence'
  | 'escort'
  | 'extract'
  | 'alternate'
  | 'release'
  | 'override'
  | 'breach'
  | 'divert'
  | 'dispatch'
  | 'mask'
  | 'upload'
  | 'authorise'
  | 'power-west'
  | 'power-east'
  | 'charge-west'
  | 'charge-east';
export type ChargeTarget = 'charge-west' | 'charge-east';
export type PowerTarget = 'power-west' | 'power-east';
export const isPower = (id: ObjectKind): id is PowerTarget =>
  id === 'power-west' || id === 'power-east';
export const isCharge = (id: ObjectKind): id is ChargeTarget =>
  id === 'charge-west' || id === 'charge-east';
export interface Landmark extends Vec {
  id: ObjectKind;
  tag: string;
  label: string;
  detail: string;
}
export type WeaponKind = 'pistol' | 'carbine' | 'shotgun' | 'automatic' | 'coil';
export interface Armament {
  kind: WeaponKind;
  rounds: number;
  reload: number;
  settle: number;
  charging?: { target: string; remaining: number };
}
export interface GuardTactic {
  role: 'sentry' | 'breacher' | 'marksman';
  posts: Vec[];
}
export interface Mission {
  id:
    | 'depot'
    | 'archive'
    | 'transfer'
    | 'custody'
    | 'broadcast'
    | 'severance'
    | 'clearing'
    | 'mandate';
  number: string;
  title: string;
  location: string;
  objective: 'escort' | 'ledger' | 'case' | 'broadcast' | 'demolition';
  description: string;
  briefing: { lead: string; body: string; routes: { title: string; body: string }[] };
  intro: string;
  evidenceName: string;
  gateOutside: Vec;
  response: { spawns: Vec[]; patrol: Vec[]; specialists?: GuardTactic[] };
  loadout?: [WeaponKind, WeaponKind, WeaponKind, WeaponKind];
  /** Large sites start near the crew at a readable scale, with an optional map overview. */
  trackingCamera?: boolean;
  archive?: { door: Rect; inside: Vec };
  broadcast?: { duration: number; traceTime: number };
  demolition?: { armTime: number; blastRadius: number };
  security?: {
    inspectionTime: number;
    turrets: { position: Vec; angle: number; circuit: PowerTarget; cable: Vec[] }[];
  };
  transfer?: { start: Vec; patrol: Vec[]; checkpoint: Vec; inspection: Vec; junction: Vec };
  escort?: {
    id: string;
    name: string;
    hp: number;
    speed: number;
    locked: boolean;
    vulnerable: boolean;
  };
  width: number;
  height: number;
  solids: Solid[];
  gate: Rect;
  restricted: Rect;
  secure: Rect;
  landmarks: Landmark[];
  guards: { position: Vec; patrol: Vec[]; angle: number; tactic?: GuardTactic }[];
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
  armament?: Armament;
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
  turret?: { circuit: PowerTarget; homeAngle: number; lock: number };
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
  tactics?: GuardTactic & {
    lastHp: number;
    until: number;
    nextMove: number;
    cover: boolean;
    goal: Vec | null;
  };
}
export interface Escort extends Person {
  name: string;
  waiting: boolean;
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
export type SoundEvent = Vec &
  (
    | { kind: 'shot'; weapon: WeaponKind }
    | { kind: 'hit'; metal: boolean; fatal: boolean; friendly: boolean }
    | { kind: 'interact'; action: ObjectKind | 'heal' | 'drop' }
    | { kind: 'alarm' }
    | { kind: 'blast' }
  );
export interface World {
  mission: Mission;
  agents: Operative[];
  guards: Guard[];
  escort: Escort | null;
  escortLocked: boolean;
  extractedAt: 'extract' | 'alternate' | null;
  time: number;
  status: 'playing' | 'won' | 'lost';
  gateOpen: boolean;
  shutterOpen: boolean;
  shutterBreached: boolean;
  overrideBy: string | null;
  relayOff: boolean;
  disguiseTaken: boolean;
  evidence: 'courier' | 'available' | 'carried' | 'extracted';
  evidencePosition: Vec;
  courier: {
    guardId: string;
    phase: 'ready' | 'transit' | 'checkpoint' | 'returning' | 'inspection' | 'secured';
    diverted: boolean;
    wait: number;
    clearance: string | null;
  } | null;
  broadcast?: {
    progress: number;
    trace: number;
    traced: boolean;
    maskBy: string | null;
    uploadBy: string | null;
  };
  demolition?: { armed: ChargeTarget[]; detonatedAt: number | null };
  security?: { isolated: PowerTarget[]; inspectionUntil: number; inspectionUsed: boolean };
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
export const isExtraction = (id: ObjectKind): id is 'extract' | 'alternate' =>
  id === 'extract' || id === 'alternate';
export const people = (w: World): Person[] => [
  ...w.agents,
  ...w.guards,
  ...(w.escort ? [w.escort] : []),
];
