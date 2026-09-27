import type { Mission, Solid, Vec } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  height: 1.6,
  kind: 'wall',
});
const patrol = (points: Vec[], angle = Math.PI) => ({ position: points[0], patrol: points, angle });

export const severance: Mission = {
  id: 'severance',
  number: '06',
  title: 'Severance',
  location: 'Recovery vault 12',
  objective: 'demolition',
  demolition: { armTime: 5, blastRadius: 4.5 },
  description: 'Destroy the debt backups. Plant, withdraw, then make it permanent.',
  evidenceName: 'Recovery register',
  intro:
    'Mara: the audit is public. They can still rebuild every fraudulent account from two backup cores. Plant WEST and EAST, clear the marked blast areas, then use Detonate. VAN unlocks after both cores are destroyed.',
  briefing: {
    lead: 'No copy to fall back on.',
    body: 'Two isolated machines hold the recovery keys for the fraudulent debt book. Plant a charge at WEST and EAST, then destroy them remotely. Each placement takes five seconds with free hands and prevents firing. Completed charges stay armed without a timer. Every survivor must leave both marked blast areas before Detonate becomes available. Extract at the north-east VAN afterwards.',
    routes: [
      {
        title: 'Borrow access, choose a window',
        body: 'KIT supplies one maintenance identity. The core halls remain restricted; planting is conspicuous even in uniform. Watch their patrols and use the server racks to break sight. One infiltrator can plant both charges while the rest prepare the escape. RADIO prevents reinforcement calls, including after detonation.',
      },
      {
        title: 'Clear, plant, withdraw',
        body: 'An armed crew can clear the courtyard and cover a planter who cannot shoot. Splitting lets two operatives plant at once. Open GATE from inside and get everyone clear before detonation. The blast areas ignore walls; the control names any operative still inside. The recovery REGISTER is optional and occupies both hands.',
      },
    ],
  },
  width: 40,
  height: 32,
  restricted: { x: 8, y: 3, w: 26.35, h: 25.35 },
  secure: { x: 10, y: 3.35, w: 23.7, h: 8.65 },
  gate: { x: 34, y: 19, w: 0.35, h: 3 },
  gateOutside: { x: 35.4, y: 20.5 },
  response: {
    spawns: [
      { x: 37, y: 19 },
      { x: 37, y: 20 },
      { x: 37, y: 21 },
    ],
    patrol: [
      { x: 32, y: 20.5 },
      { x: 29, y: 14 },
      { x: 19, y: 14 },
    ],
  },
  solids: [
    wall('vault-north', 8, 3, 26.35, 0.35),
    wall('vault-west-a', 8, 3, 0.35, 16),
    wall('vault-west-b', 8, 22, 0.35, 6.35),
    wall('vault-south', 8, 28, 26.35, 0.35),
    wall('vault-east-a', 34, 3, 0.35, 16),
    wall('vault-east-b', 34, 22, 0.35, 6.35),
    wall('west-hall-side', 10, 3.35, 0.35, 8.65),
    wall('west-hall-front', 10, 11.65, 6, 0.35),
    wall('west-hall-door', 19, 11.65, 1.4, 0.35),
    wall('hall-divider', 20, 3.35, 0.35, 8.65),
    wall('east-hall-front', 25.5, 11.65, 8.5, 0.35),
    { id: 'west-core', x: 12, y: 6.8, w: 4, h: 2.2, height: 1.9, kind: 'server' },
    { id: 'east-core', x: 27, y: 6.8, w: 4, h: 2.2, height: 1.9, kind: 'server' },
    { id: 'relay-house', x: 10, y: 13, w: 4.5, h: 3.8, height: 2.4, kind: 'building' },
    { id: 'cooling-a', x: 18, y: 16, w: 5, h: 3.5, height: 1.5, kind: 'container' },
    { id: 'cooling-b', x: 25.5, y: 23, w: 5.8, h: 3, height: 1.5, kind: 'container' },
    { id: 'delivery', x: 10, y: 24.5, w: 3, h: 2, height: 1, kind: 'crate' },
    { id: 'street-office', x: 1.5, y: 13, w: 3, h: 5, height: 2.6, kind: 'building' },
    { id: 'north-van', x: 36, y: 3, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 5.6,
      y: 24,
      label: 'Vault maintenance kit',
      detail: 'One maintenance identity. Core halls and planting remain suspicious.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 10,
      y: 18,
      label: 'Vault radio relay',
      detail: 'Stop reinforcement calls before the explosion. Surviving guards still investigate.',
    },
    {
      id: 'charge-west',
      tag: 'WEST',
      x: 14,
      y: 5.6,
      label: 'West debt backup',
      detail: 'Plant a charge: five seconds with free hands. Use the racks to break sight.',
    },
    {
      id: 'charge-east',
      tag: 'EAST',
      x: 29,
      y: 5.6,
      label: 'East debt backup',
      detail: 'Plant a second charge. Move every survivor clear before using Detonate.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 32.7,
      y: 20.5,
      label: 'East service gate',
      detail: 'Prepare the north-east escape; open from inside to avoid a breach alarm.',
    },
    {
      id: 'evidence',
      tag: 'REGISTER',
      x: 15.4,
      y: 14.5,
      label: 'Recovery register',
      detail:
        'Optional record of the stolen accounts. Both hands occupied; set it down before planting.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      x: 37.7,
      y: 7,
      label: 'North-east extraction',
      detail: 'Destroy both backups, then bring every survivor here.',
    },
  ],
  spawns: [
    { x: 4.5, y: 28.5 },
    { x: 5.5, y: 28.5 },
    { x: 4.5, y: 29.5 },
    { x: 5.5, y: 29.5 },
  ],
  guards: [
    patrol(
      [
        { x: 11.5, y: 20.5 },
        { x: 11.5, y: 23 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 16.5, y: 13.5 },
        { x: 24, y: 13.5 },
      ],
      0,
    ),
    patrol(
      [
        { x: 18, y: 13 },
        { x: 18, y: 5 },
        { x: 11.4, y: 5 },
        { x: 11.4, y: 10.5 },
        { x: 18, y: 10.5 },
        { x: 18, y: 13 },
      ],
      -Math.PI / 2,
    ),
    patrol(
      [
        { x: 24, y: 14.5 },
        { x: 32, y: 14.5 },
      ],
      0,
    ),
    patrol(
      [
        { x: 23, y: 13 },
        { x: 23, y: 5 },
        { x: 32.5, y: 5 },
        { x: 32.5, y: 10.5 },
        { x: 23, y: 10.5 },
        { x: 23, y: 13 },
      ],
      -Math.PI / 2,
    ),
    patrol(
      [
        { x: 24, y: 21 },
        { x: 32.5, y: 21 },
      ],
      0,
    ),
    patrol(
      [
        { x: 36.5, y: 9 },
        { x: 36.5, y: 22.5 },
      ],
      Math.PI / 2,
    ),
  ],
};
