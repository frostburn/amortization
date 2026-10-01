import type { GuardTactic, Mission, Solid, Vec } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  height: 1.6,
  kind: 'wall',
});
const patrol = (points: Vec[], angle = Math.PI, tactic?: GuardTactic) => ({
  position: points[0],
  patrol: points,
  angle,
  ...(tactic ? { tactic } : {}),
});

export const clearing: Mission = {
  id: 'clearing',
  number: '07',
  title: 'Margin call',
  location: 'North freight clearinghouse',
  objective: 'ledger',
  loadout: ['pistol', 'pistol', 'automatic', 'coil'],
  trackingCamera: true,
  description: 'Seize the settlement keys. Cross the freight yard and bring the crew out.',
  evidenceName: 'Settlement keys',
  intro:
    'Quill: destroying the backups stopped collection, but the frozen escrow still belongs to them. Bring me the physical KEYS from the north vault. Leave someone on SHUNT, or CUT the shutter. Violet marksmen cover the freight lanes: break their charging line at solid cover.',
  briefing: {
    lead: 'The money has to go somewhere.',
    body: 'The clearinghouse holds the settlement keys needed to return the frozen escrow to its owners. Take KEYS from the north vault and bring every survivor to the north-east VAN. The case occupies both hands and exposes even a disguised carrier. This is a larger site: the camera follows your selection at a readable scale. Select an operative’s card or press 1–4 to switch across the map. Fit map gives an overview; Follow / Home returns to the selected crew.',
    routes: [
      {
        title: 'Remote access, screened withdrawal',
        body: 'Take KIT with Morrow or Vale and disable RADIO by the west entrance. Leave a partner holding SHUNT on the west street. The maintenance route runs north behind the warehouses, then east below the vault. Open GATE before taking KEYS. Keep the carrier behind the long vault screen on the way to the east exit. Once the carrier clears the shutter, release the SHUNT operator and bring them to VAN too. CUT is the eight-second noisy alternative if the team stays together.',
      },
      {
        title: 'Break the firing lane',
        body: 'Violet security marksmen charge each coil shot for 1.25 seconds along a visible line. Solid cover or movement by the shooter cancels the charge; flank their posts or return fire with Sable’s coil rifle. Rook’s compact automatic fires quickly at close range, then needs a frequent reload. Neither new weapon conceals. Stop Sable to charge while Rook and the pistol pair cross between cargo stacks. The two long lanes are separated by warehouses; drawing the whole yard at once is costly.',
      },
    ],
  },
  width: 60,
  height: 42,
  restricted: { x: 9, y: 4, w: 45.35, h: 33.35 },
  secure: { x: 39.35, y: 6.35, w: 11.65, h: 9.65 },
  gate: { x: 54, y: 12, w: 0.35, h: 4 },
  gateOutside: { x: 55.5, y: 14 },
  archive: { door: { x: 44, y: 16, w: 3, h: 0.35 }, inside: { x: 45.5, y: 15 } },
  response: {
    spawns: [
      { x: 57, y: 17 },
      { x: 57, y: 18 },
      { x: 57, y: 19 },
    ],
    patrol: [
      { x: 52.5, y: 14 },
      { x: 52, y: 22 },
      { x: 40, y: 22 },
    ],
    specialists: [
      {
        role: 'marksman',
        posts: [
          { x: 52, y: 22 },
          { x: 48, y: 22 },
          { x: 49.5, y: 27 },
        ],
      },
      {
        role: 'breacher',
        posts: [
          { x: 52, y: 17.5 },
          { x: 38, y: 17.5 },
          { x: 38, y: 26 },
        ],
      },
    ],
  },
  solids: [
    wall('yard-north', 9, 4, 45.35, 0.35),
    wall('yard-west-north', 9, 4, 0.35, 25),
    wall('yard-west-south', 9, 33, 0.35, 4.35),
    wall('yard-south', 9, 37, 45.35, 0.35),
    wall('yard-east-north', 54, 4, 0.35, 8),
    wall('yard-east-south', 54, 16, 0.35, 21.35),
    wall('vault-north', 39, 6, 12.35, 0.35),
    wall('vault-west', 39, 6, 0.35, 10.35),
    wall('vault-east', 51, 6, 0.35, 10.35),
    wall('vault-front-west', 39, 16, 5, 0.35),
    wall('vault-front-east', 47, 16, 4.35, 0.35),
    wall('vault-screen', 39.5, 19, 11.5, 0.35),
    wall('service-screen', 11.5, 20.5, 23.5, 0.35),
    { id: 'west-warehouse', x: 15, y: 24, w: 8, h: 4.5, height: 2.7, kind: 'building' },
    { id: 'north-warehouse', x: 13, y: 7, w: 11, h: 8, height: 3, kind: 'building' },
    { id: 'bonded-warehouse', x: 28, y: 7, w: 7, h: 8, height: 2.8, kind: 'building' },
    { id: 'central-freight', x: 28, y: 24, w: 7, h: 4.5, height: 1.6, kind: 'container' },
    { id: 'east-freight', x: 41, y: 25.5, w: 7, h: 4, height: 1.6, kind: 'container' },
    { id: 'south-stack', x: 25, y: 33.8, w: 5, h: 2, height: 1.3, kind: 'crate' },
    { id: 'crossing-stack', x: 36.5, y: 27.5, w: 2, h: 3, height: 1.2, kind: 'crate' },
    { id: 'vault-racks-west', x: 40.4, y: 10.5, w: 3.2, h: 1.5, height: 1.8, kind: 'server' },
    { id: 'vault-racks-east', x: 47.2, y: 10.5, w: 2.6, h: 1.5, height: 1.8, kind: 'server' },
    { id: 'relay-cabinet', x: 10, y: 25.2, w: 1.2, h: 1.6, height: 1.3, kind: 'server' },
    { id: 'street-office', x: 1.5, y: 26, w: 3, h: 6, height: 2.6, kind: 'building' },
    { id: 'shunt-cabinet', x: 3, y: 21, w: 1.6, h: 1.2, height: 1.1, kind: 'server' },
    { id: 'escape-van', x: 57.8, y: 4, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 6,
      y: 34,
      label: 'Freight maintenance kit',
      detail:
        'Morrow or Vale can conceal their pistol. The automatic and coil rifle remain visible.',
    },
    {
      id: 'override',
      tag: 'SHUNT',
      x: 5.8,
      y: 23,
      label: 'Remote vault shunt',
      detail:
        'Leave a partner holding this control until the carrier is outside the vault. Selection changes preserve the order; Move or Hold releases it.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 11,
      y: 28,
      label: 'Clearinghouse radio relay',
      detail:
        'Stops reinforcement calls. Marksmen still cover their lanes and local guards still investigate.',
    },
    {
      id: 'breach',
      tag: 'CUT',
      x: 45.5,
      y: 17.6,
      label: 'Settlement vault shutter',
      detail: 'Eight seconds of noisy work for permanent access. SHUNT is the quiet alternative.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 52.7,
      y: 14,
      label: 'North-east delivery gate',
      detail: 'Prepare the escape before collecting KEYS. Open quietly from inside.',
    },
    {
      id: 'evidence',
      tag: 'KEYS',
      x: 45.5,
      y: 8.2,
      label: 'Physical settlement keys',
      detail:
        'Required cargo. Both hands occupied and suspicious in uniform. Leave by the screened north route.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      x: 56.5,
      y: 8,
      label: 'North road extraction',
      detail:
        'Bring KEYS and every survivor. Remember the operative holding SHUNT across the site.',
    },
  ],
  spawns: [
    { x: 5, y: 38 },
    { x: 6, y: 38 },
    { x: 5, y: 39 },
    { x: 6, y: 39 },
  ],
  guards: [
    patrol(
      [
        { x: 12, y: 31 },
        { x: 12, y: 35 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 25.5, y: 22.5 },
        { x: 25.5, y: 29.5 },
      ],
      Math.PI / 2,
    ),
    patrol([{ x: 33, y: 32 }], Math.PI, {
      role: 'marksman',
      posts: [
        { x: 33, y: 32 },
        { x: 31.5, y: 29.5 },
        { x: 31.5, y: 35.5 },
      ],
    }),
    patrol(
      [
        { x: 37.5, y: 22 },
        { x: 37.5, y: 17.5 },
      ],
      -Math.PI / 2,
    ),
    patrol([{ x: 48, y: 22 }], Math.PI, {
      role: 'marksman',
      posts: [
        { x: 48, y: 22 },
        { x: 49.5, y: 24 },
        { x: 48.5, y: 30.5 },
      ],
    }),
    patrol(
      [
        { x: 40, y: 32 },
        { x: 50, y: 32 },
      ],
      Math.PI,
      {
        role: 'sentry',
        posts: [
          { x: 40, y: 32 },
          { x: 49.5, y: 30.5 },
          { x: 39, y: 25 },
        ],
      },
    ),
    patrol(
      [
        { x: 56, y: 24 },
        { x: 56, y: 17.5 },
      ],
      -Math.PI / 2,
    ),
  ],
};
