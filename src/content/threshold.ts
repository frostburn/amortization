import type { GuardTactic, Mission, Solid, Vec } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number, height = 1.8): Solid => ({
  id,
  x,
  y,
  w,
  h,
  height,
  kind: 'wall',
});
const post = (x: number, y: number, angle: number, role?: GuardTactic['role'], patrol?: Vec[]) => {
  const position = { x, y },
    route = patrol ?? [position];
  return { position, patrol: route, angle, ...(role ? { tactic: { role, posts: route } } : {}) };
};

export const threshold: Mission = {
  id: 'threshold',
  number: '14',
  title: 'Threshold',
  location: 'Crown Interchange / tower approach · 19:40',
  objective: 'access',
  palette: 'sunset',
  trackingCamera: true,
  flashGrenades: true,
  loadout: ['pistol', 'pistol', 'automatic', 'coil'],
  threshold: {
    keyTime: 5,
    arrivalTime: 18,
    door: { x: 48, y: 6.3 },
    // After investigating the bell, these officers keep watch over the lobby.
    // Waiting out the incident must not send all three back to the far concourse.
    reserve: [
      {
        guard: 5,
        patrol: [
          { x: 44, y: 8.5 },
          { x: 51.5, y: 8.5 },
          { x: 51.5, y: 12 },
          { x: 44.5, y: 12 },
        ],
      },
      {
        guard: 6,
        patrol: [
          { x: 44, y: 7 },
          { x: 43.5, y: 10.5 },
          { x: 44.5, y: 12 },
        ],
      },
      {
        guard: 7,
        patrol: [
          { x: 52.8, y: 9 },
          { x: 48.5, y: 7 },
          { x: 45, y: 8.5 },
          { x: 51.5, y: 12 },
        ],
      },
    ],
  },
  evidenceName: 'Tower service key',
  relayTime: 5,
  description: 'Secure a way into the tower before Dacre closes the executive floors.',
  intro:
    'Voss: the service lift has an independent key. Recover it, work LINK, then bring the crew to LIFT. Calling the car rings the lobby bell; RADIO cannot silence that.',
  briefing: {
    lead: 'The last street before the tower.',
    body: 'Recover KEY from dispatch, use its carrier at LINK for five seconds, then board LIFT with the key and every survivor. The car takes eighteen seconds to arrive. The wired bell calls the reserve, who then keep patrolling the lobby even with RADIO disabled.',
    routes: [
      {
        title: 'Dispatch access',
        body: 'One partner can hold SHUNT on the west street while a disguised runner collects KEY. CUT forces the dispatch shutter permanently, but its noise draws nearby guards. RADIO is inside dispatch. Keep SHUNT held until the runner is outside, or cut from within.',
      },
      {
        title: 'Across the interchange',
        body: 'The northern staff walk is screened from the concourse. The stopped tram and southern planters split the armed approach into shorter lanes. A credential inspector works the centre; the south platform has a marksman. Sunset uses night sight ranges, not the longer daylight ranges.',
      },
      {
        title: 'The lift bell',
        body: 'LINK requires the physical KEY carrier and five uninterrupted seconds. Progress resets if the carrier moves away, but a completed call is permanent. The three reserve guards on the east concourse investigate LINK, then patrol the lift approaches instead of returning to their old posts. They do not know your unseen position. Prepare the crew before calling, time the patrol gaps or use a flash to cross; force can clear the route. RADIO only prevents outside reinforcements.',
      },
      {
        title: 'Keep the original',
        body: 'Carry KEY into LIFT. If its carrier falls, recover it from that position; the call remains active. The lift stays available once it arrives. You choose when to board, and every survivor must be in the extraction ring. This operation ends at the tower, not back at the van.',
      },
    ],
  },
  width: 60,
  height: 42,
  restricted: { x: 10, y: 4, w: 45.35, h: 32.35 },
  secure: { x: 14.4, y: 6.4, w: 11.2, h: 11.2 },
  gate: { x: 55, y: 28, w: 0.35, h: 5 },
  gateOutside: { x: 56.5, y: 30.5 },
  gateInsideOnly: true,
  archive: {
    door: { x: 20, y: 18, w: 3, h: 0.4 },
    inside: { x: 21.5, y: 16.8 },
    name: 'dispatch office',
  },
  response: {
    spawns: [
      { x: 57, y: 29 },
      { x: 57, y: 30 },
      { x: 57, y: 31 },
    ],
    patrol: [
      { x: 53, y: 30 },
      { x: 40, y: 30 },
      { x: 35, y: 23 },
    ],
    specialists: [
      {
        role: 'sentry',
        posts: [
          { x: 51, y: 27 },
          { x: 40, y: 30 },
        ],
      },
      {
        role: 'breacher',
        posts: [
          { x: 35, y: 23 },
          { x: 28, y: 27 },
        ],
      },
    ],
  },
  solids: [
    wall('perimeter-north', 10, 4, 33, 0.35),
    wall('perimeter-west-top', 10, 4, 0.35, 19),
    wall('perimeter-west-foot', 10, 32, 0.35, 4.35),
    wall('perimeter-south', 10, 36, 45.35, 0.35),
    wall('perimeter-east-top', 55, 6, 0.35, 22),
    wall('perimeter-east-foot', 55, 33, 0.35, 3.35),
    wall('dispatch-north', 14, 6, 12, 0.4),
    wall('dispatch-west', 14, 6, 0.4, 12.4),
    wall('dispatch-east', 25.6, 6, 0.4, 12.4),
    wall('dispatch-front-west', 14, 18, 6, 0.4),
    wall('dispatch-front-east', 23, 18, 3, 0.4),
    { id: 'key-rack', x: 19.5, y: 10.5, w: 2.4, h: 0.8, height: 1.7, kind: 'shelves' },
    { id: 'dispatch-relay', x: 23, y: 7.2, w: 1.5, h: 0.8, height: 1.3, kind: 'server' },
    wall('staff-walk-screen', 29, 8, 10, 0.4, 1.5),
    { id: 'stopped-tram', x: 30.5, y: 19, w: 2.4, h: 11, height: 1.6, kind: 'tram' },
    wall('platform-screen', 35, 24, 8, 0.5, 1.4),
    wall('crosswalk-screen', 39, 13, 0.5, 7, 1.7),
    wall('lobby-approach-screen', 43, 14, 9, 0.4, 1.8),
    wall('lobby-screen', 46, 10, 4, 0.35, 1.6),
    { id: 'service-link', x: 42.3, y: 11, w: 0.8, h: 1.4, height: 1.2, kind: 'server' },
    { id: 'crown-tower', x: 43, y: 0, w: 12, h: 6, height: 14, kind: 'building' },
    { id: 'reserve-shelter', x: 48, y: 27, w: 4, h: 1.1, height: 1.6, kind: 'shelves' },
    { id: 'south-planter', x: 19, y: 31.5, w: 6, h: 1.2, height: 1.1, kind: 'crate' },
    { id: 'street-kiosk', x: 3, y: 24, w: 3, h: 5, height: 2.5, kind: 'building' },
    { id: 'arrival-van', x: 3, y: 36, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 7,
      y: 30,
      label: 'Dispatch supervisor identity',
      detail: 'One maintenance identity. Only Morrow or Vale can conceal a pistol.',
    },
    {
      id: 'override',
      tag: 'SHUNT',
      x: 8,
      y: 13,
      label: 'Dispatch shutter override',
      detail:
        'Hold to open the dispatch shutter. A partner must stay here until the runner leaves; CUT is the permanent alternative.',
    },
    {
      id: 'breach',
      tag: 'CUT',
      x: 21.5,
      y: 19.4,
      label: 'Dispatch shutter lock',
      detail:
        'Eight seconds with free hands permanently opens the shutter. Nearby guards hear it; works from either side.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 23.5,
      y: 9,
      label: 'Interchange radio switch',
      detail:
        'Five seconds. Prevents outside reinforcements. The wired lift bell still calls the existing lobby reserve.',
    },
    {
      id: 'evidence',
      tag: 'KEY',
      x: 17.5,
      y: 9,
      label: 'Tower service key',
      detail:
        'Required original key module. Carry it to LINK, then take it into LIFT. Both hands are occupied.',
    },
    {
      id: 'key-lift',
      tag: 'LINK',
      x: 44.5,
      y: 12,
      label: 'Key the service lift',
      detail:
        'KEY carrier only, five seconds. Calls the lift and draws three reserve guards here; they keep patrolling the lobby afterwards. The car arrives after eighteen seconds and stays available.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 53.5,
      y: 30.5,
      label: 'East delivery gate',
      detail: 'Open from inside. This is not the extraction point; the crew leaves through LIFT.',
    },
    {
      id: 'extract',
      tag: 'LIFT',
      x: 48,
      y: 8.5,
      label: 'Tower service lift',
      detail:
        'Call from LINK first. Once the car arrives, bring KEY and every survivor into the ring and order boarding.',
    },
  ],
  spawns: [
    { x: 7, y: 37 },
    { x: 8, y: 37 },
    { x: 7, y: 38 },
    { x: 8, y: 38 },
  ],
  guards: [
    post(24, 12, -Math.PI / 2),
    post(17, 28, 0, undefined, [
      { x: 17, y: 28 },
      { x: 23, y: 28 },
    ]),
    post(28, 21, -Math.PI / 2, 'inspector', [
      { x: 28, y: 21 },
      { x: 28, y: 14 },
    ]),
    post(45, 31, Math.PI, 'marksman'),
    post(35, 11, Math.PI, 'sentry', [
      { x: 35, y: 11 },
      { x: 36, y: 17 },
    ]),
    post(46, 20, Math.PI, 'shield'),
    post(50, 24, Math.PI, 'support'),
    post(50, 30, -Math.PI / 2, 'breacher'),
  ],
};
