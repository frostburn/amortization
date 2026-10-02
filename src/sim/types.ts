export const EXTRACTION_RADIUS = 4;

export interface Vec {
  /** Omitted on existing single-storey sites. */
  floor?: number;
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
  | 'seal-west'
  | 'seal-east'
  | 'key-lift'
  | 'stairs-up'
  | 'stairs-down'
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
  | 'charge-east'
  | AccessTarget
  | RescueTarget
  | 'escape-release'
  | 'equipment'
  | 'file-recall'
  | SettlementTarget;
export type SettlementTarget = 'reconcile' | 'countersign' | 'settle';
export const isSettlement = (id: ObjectKind): id is SettlementTarget =>
  id === 'reconcile' || id === 'countersign' || id === 'settle';
export type AccessTarget = 'access-intake' | 'access-cells';
export type RescueTarget = 'rescue-vale' | 'rescue-rook';
export const isAccess = (id: ObjectKind): id is AccessTarget =>
  id === 'access-intake' || id === 'access-cells';
export const isRescue = (id: ObjectKind): id is RescueTarget =>
  id === 'rescue-vale' || id === 'rescue-rook';
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
export type WeaponKind = 'pistol' | 'carbine' | 'shotgun' | 'automatic' | 'coil' | 'support';
export interface Armament {
  kind: WeaponKind;
  rounds: number;
  reload: number;
  settle: number;
  charging?: { target: string; remaining: number };
}
export interface GuardTactic {
  role: 'sentry' | 'breacher' | 'marksman' | 'inspector' | 'shield' | 'support' | 'marshal';
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
    | 'mandate'
    | 'personnel'
    | 'injunction'
    | 'settlement'
    | 'countermand'
    | 'continuity'
    | 'threshold'
    | 'bench';
  number: string;
  title: string;
  location: string;
  objective:
    | 'escort'
    | 'ledger'
    | 'case'
    | 'broadcast'
    | 'demolition'
    | 'rescue'
    | 'settlement'
    | 'recall'
    | 'capture'
    | 'access';
  /** Local staff clothing; absent means the industrial maintenance cover. */
  disguise?: 'office';
  daylight?: boolean;
  /** Presentation palette; does not extend sight ranges. */
  palette?: 'sunset';
  threshold?: {
    keyTime: number;
    arrivalTime: number;
    reserve: { guard: number; patrol: Vec[] }[];
    door: Vec;
  };
  finale?: {
    dacre: number;
    retinue: number[];
    door: Rect;
    inside: Vec;
    chamber: Rect;
    sealTime: number;
    helicopter: Vec;
    boarding: Vec;
  };
  building?: { footprint: Rect; upper: Rect; stairs: [Vec, Vec] };
  /** Kestrel controls alternating wired circuits until removed. */
  continuity?: { cycle: number };
  settlement?: { reconcileTime: number; duration: number };
  recall?: { filingTime: number };
  description: string;
  briefing: { lead: string; body: string; routes: { title: string; body: string }[] };
  intro: string;
  evidenceName: string;
  gateOutside: Vec;
  gateInsideOnly?: boolean;
  /** Extraction from the public street should stay outside the restricted perimeter. */
  perimeterExtraction?: boolean;
  response: { spawns: Vec[]; patrol: Vec[]; specialists?: GuardTactic[] };
  loadout?: [WeaponKind, WeaponKind, WeaponKind, WeaponKind];
  /** Large sites start near the crew at a readable scale, with an optional map overview. */
  trackingCamera?: boolean;
  flashGrenades?: boolean;
  relayTime?: number;
  detention?: {
    gates: { id: AccessTarget; door: Rect }[];
    cells: { id: RescueTarget; agent: number; door: Rect }[];
  };
  archive?: { door: Rect; inside: Vec; name?: string };
  broadcast?: {
    duration: number;
    traceTime: number;
    subject?: string;
    completed?: string;
    guidance?: string;
    dispatchOnTrace?: boolean;
  };
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
  disoriented?: number;
  /** Bounded fire pressure; absent unless a support gun has applied it. */
  pressure?: number;
}
export interface Operative extends Person {
  flashes?: number;
  captive?: boolean;
  disarmed?: boolean;
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
  marshal?: { remaining: number; target: Vec | null; readyAt: number; lastHp: number };
  commandMove?: { goal: Vec; until: number };
  /** Unseen incoming fire; source is a snapshot, never a live target position. */
  incoming?: { source: Vec; until: number; nextMove: number; goal: Vec | null };
  /** Actual body/shield bearing; angle remains the AI's desired bearing. */
  shield?: { angle: number };
  inspection?: { target: string; progress: number };
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
    | { kind: 'flash' }
  );
export interface World {
  threshold?: { calledAt: number | null; announced: boolean };
  flashGrenades?: { thrower: string; from: Vec; to: Vec; age: number }[];
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
  detention?: {
    operator: string | null;
    circuit: AccessTarget | null;
    open: AccessTarget[];
    released: boolean;
  };
  settlement?: {
    reconciled: boolean;
    progress: number;
    signer: string | null;
    clerk: string | null;
  };
  recall?: { filed: boolean };
  finale?: {
    open: boolean;
    progress: number;
    westBy: string | null;
    eastBy: string | null;
    defeated: boolean;
    interrupted: number;
  };
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
export const floorOf = (p: Vec) => p.floor ?? 0;
export const sameFloor = (a: Vec, b: Vec) => floorOf(a) === floorOf(b);
/** Copy only position; old recordings retain exactly their original state shape. */
export const position = (p: Vec): Vec => ({
  x: p.x,
  y: p.y,
  ...(p.floor ? { floor: p.floor } : {}),
});
export const distance = (a: Vec, b: Vec) =>
  sameFloor(a, b) ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
export const inside = (p: Vec, r: Rect) =>
  p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
export const living = (p: Person) => p.hp > 0;
export const disoriented = (p: Person) => (p.disoriented ?? 0) > 0;
export const controllable = (p: Operative) => living(p) && !p.captive;
/** Keep briefing, guidance and boarding aligned about the physical cargo. */
export const requiresCargo = (m: Mission) =>
  ['ledger', 'case', 'settlement', 'recall', 'access'].includes(m.objective);
export const isExtraction = (id: ObjectKind): id is 'extract' | 'alternate' =>
  id === 'extract' || id === 'alternate';
export const people = (w: World): Person[] => [
  ...w.agents,
  ...w.guards,
  ...(w.escort ? [w.escort] : []),
];
