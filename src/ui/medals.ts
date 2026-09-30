import { controllable, living } from '../sim/types';
import type { Mission, World } from '../sim/types';

export type MedalId =
  | 'custody'
  | 'complete'
  | 'full-crew'
  | 'quiet'
  | 'nonlethal'
  | 'no-kit'
  | 'live-alarm'
  | 'intel'
  | 'light-touch'
  | 'diversion'
  | 'untraced'
  | 'power-down'
  | 'travel-light';

interface Medal {
  id: MedalId;
  name: string;
  rule: string;
  symbol: string;
  available?: (m: Mission) => boolean;
  qualifies: (w: World) => boolean;
}

// Challenge medals require the whole crew. Conditions use facts already
// retained by the simulation; replay state and combat timing stay unchanged.
const medals: Medal[] = [
  {
    id: 'custody',
    name: 'Answerable',
    rule: 'Bring Kestrel out alive in handcuffs and extract all four operatives.',
    symbol:
      '<circle cx="7" cy="13" r="4"/><circle cx="17" cy="13" r="4"/><path d="M11 12h2M5 9V6h4m6 3V6h4"/>',
    available: (m) => !!m.continuity,
    qualifies: (w) => !!w.escort?.recruited && living(w.escort),
  },
  {
    id: 'complete',
    name: 'Settled',
    rule: 'Complete the operation and extract at least one surviving operative.',
    symbol: '<path d="m6 12 4 4 8-9"/>',
    qualifies: () => true,
  },
  {
    id: 'full-crew',
    name: 'Full crew',
    rule: 'Complete the operation and extract all four operatives alive.',
    symbol:
      '<circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><path d="M4 18v-3a4 4 0 0 1 8 0v3m0-3a4 4 0 0 1 8 0v3"/>',
    qualifies: () => true,
  },
  {
    id: 'quiet',
    name: 'Low profile',
    rule: 'Extract all four without ever triggering the site alarm. Local suspicion is allowed.',
    symbol: '<path d="M7 15V9a5 5 0 0 1 10 0v6l2 2H5l2-2m3 5h4M4 4l16 16"/>',
    qualifies: (w) => !w.alarm,
  },
  {
    id: 'nonlethal',
    name: 'Nonlethal',
    rule: 'Extract all four without killing any guards, the courier or a mission target. Destroying unmanned turrets is allowed.',
    symbol: '<path d="M12 20C2 14 3 6 7 6c3 0 5 3 5 3s2-3 5-3c4 0 5 8-5 14Z"/>',
    qualifies: (w) =>
      w.guards.every((g) => !!g.turret || living(g)) &&
      (!w.mission.continuity || (!!w.escort && living(w.escort))),
  },
  {
    id: 'no-kit',
    name: 'No disguise',
    rule: 'Extract all four without taking the maintenance disguise from KIT.',
    symbol: '<path d="m6 5 6 3 6-3v7c0 4-6 7-6 7s-6-3-6-7V5Zm2 7h2m4 0h2M4 3l16 18"/>',
    qualifies: (w) => !w.disguiseTaken,
  },
  {
    id: 'live-alarm',
    name: 'Open channel',
    rule: 'Extract all four with the site alarm triggered, without disabling RADIO at any point.',
    symbol:
      '<path d="M12 12v9M8 21h8M8 7a7 7 0 0 0 0 10m8-10a7 7 0 0 1 0 10M5 4a11 11 0 0 0 0 16M19 4a11 11 0 0 1 0 16"/><circle cx="12" cy="11" r="2"/>',
    qualifies: (w) => w.alarm && !w.relayOff,
  },
  {
    id: 'intel',
    name: 'Due diligence',
    rule: 'Extract all four and bring the optional evidence to the extraction point.',
    symbol: '<path d="M6 3h9l4 4v14H6V3Zm9 0v5h4M9 12h7m-7 4h7"/>',
    available: (m) =>
      ['escort', 'broadcast', 'demolition', 'rescue', 'capture'].includes(m.objective),
    qualifies: (w) => w.evidence === 'extracted',
  },
  {
    id: 'light-touch',
    name: 'Light touch',
    rule: 'Extract all four with the evidence, using SHUNT to enter the archive. Never force CUT.',
    symbol: '<path d="M7 21V3h10v18M4 21h16m-6-9h1"/>',
    available: (m) => !!m.archive && m.objective === 'ledger',
    qualifies: (w) => !w.shutterBreached,
  },
  {
    id: 'diversion',
    name: 'By the book',
    rule: 'Use CALL to divert the courier, recover CASE and extract all four while keeping the courier alive.',
    symbol: '<path d="M5 19V8h10m-4-4 4 4-4 4M8 16h11v5H8z"/>',
    available: (m) => !!m.transfer,
    qualifies: (w) =>
      !!w.courier?.diverted && w.guards.some((g) => g.id === w.courier?.guardId && living(g)),
  },
  {
    id: 'untraced',
    name: 'Off the record',
    rule: 'Extract all four after finishing UPLINK without letting its trace complete. A partner on LOOP masks the upload.',
    symbol: '<path d="M5 8h3l3 8 3-8h5M4 4l16 16"/>',
    available: (m) => !!m.broadcast,
    qualifies: (w) => !w.broadcast!.traced,
  },
  {
    id: 'power-down',
    name: 'Power down',
    rule: 'Isolate both WEST and EAST, then extract all four without destroying any turrets. INSPECT may be used.',
    symbol: '<path d="M12 3v9M7 6a8 8 0 1 0 10 0"/>',
    available: (m) => !!m.security,
    qualifies: (w) =>
      ['power-west', 'power-east'].every((id) => w.security!.isolated.some((p) => p === id)) &&
      w.guards.filter((g) => g.turret).every(living),
  },
  {
    id: 'travel-light',
    name: 'Travel light',
    rule: 'Rescue both prisoners and extract all four without either rescued operative recovering GEAR.',
    symbol: '<path d="M5 9V5h5M5 5l6 6m8 4v4h-5m5 0-6-6"/>',
    available: (m) => !!m.detention,
    qualifies: (w) => w.mission.detention!.cells.every((c) => w.agents[c.agent].disarmed),
  },
];

export const medalsFor = (mission: Mission) =>
  medals.filter((m) => !m.available || m.available(mission));

export function earnedMedals(w: World): MedalId[] {
  if (w.status !== 'won') return [];
  const fullCrew = w.agents.length === 4 && w.agents.every(controllable);
  return medalsFor(w.mission)
    .filter((m) => (m.id === 'complete' || fullCrew) && m.qualifies(w))
    .map((m) => m.id);
}
