import type { Mission, Solid, Vec } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  kind: 'wall',
  height: 1.5,
});
const patrol = (points: Vec[], angle = Math.PI) => ({ position: points[0], patrol: points, angle });

export const archive: Mission = {
  id: 'archive',
  number: '02',
  title: 'Material breach',
  location: 'Records annex 02',
  objective: 'ledger',
  description: 'Recover the original debt ledger.',
  evidenceName: 'Debt ledger',
  intro:
    'Voss: the paper original is in the archive. Assign someone to SHUNT, send another inside. The van is on the east road.',
  briefing: {
    lead: 'The debt is public. The evidence is not.',
    body: 'Voss traced the fraudulent contracts to a paper ledger in the records annex. Bring the ledger and every survivor to the van on the east road. A copy will not satisfy the client.',
    routes: [
      {
        title: 'Two people, one borrowed identity',
        body: 'KIT grants maintenance access. Assign a second operative to SHUNT outside the west wall: their standing order holds the archive shutter open. Selection changes do not release it; moving or Hold does.',
      },
      {
        title: 'Prepare the withdrawal',
        body: 'Open GATE from inside for a short exit. The ledger needs both hands and is visibly stolen, even in uniform. Disable RADIO, watch patrols, and position the crew before collecting it. CUT forces the shutter in eight seconds, but draws guards.',
      },
    ],
  },
  width: 34,
  height: 28,
  restricted: { x: 8, y: 3, w: 22.35, h: 18.35 },
  secure: { x: 23.15, y: 4.85, w: 5.8, h: 7.15 },
  gate: { x: 30, y: 16, w: 0.35, h: 3 },
  gateOutside: { x: 31.25, y: 17.5 },
  archive: { door: { x: 24.8, y: 12, w: 2.7, h: 0.35 }, inside: { x: 26.1, y: 11.15 } },
  response: {
    spawns: [
      { x: 32, y: 21 },
      { x: 32, y: 21.8 },
      { x: 32, y: 22.6 },
    ],
    patrol: [
      { x: 28.5, y: 17.5 },
      { x: 26, y: 13.8 },
      { x: 17, y: 12 },
    ],
  },
  solids: [
    wall('annex-north', 8, 3, 22.35, 0.35),
    wall('annex-west-a', 8, 3, 0.35, 8),
    wall('annex-west-b', 8, 13, 0.35, 8.35),
    wall('annex-east-a', 30, 3, 0.35, 13),
    wall('annex-east-b', 30, 19, 0.35, 2.35),
    wall('annex-front', 8, 21, 22.35, 0.35),
    wall('vault-north', 22.8, 4.5, 6.5, 0.35),
    wall('vault-west', 22.8, 4.5, 0.35, 7.85),
    wall('vault-east', 28.95, 4.5, 0.35, 7.85),
    wall('vault-south-a', 22.8, 12, 2, 0.35),
    wall('vault-south-b', 27.5, 12, 1.8, 0.35),
    { ...wall('archive-screen', 24, 14.2, 4.8, 0.35), height: 1.2 },
    { id: 'annex-office', x: 10.5, y: 5, w: 5.5, h: 4, height: 2.6, kind: 'building' },
    { id: 'filing-bank', x: 18.5, y: 5.5, w: 2, h: 6.5, height: 1.8, kind: 'shelves' },
    { id: 'vault-files-a', x: 23.8, y: 8, w: 1.8, h: 1.4, height: 1.5, kind: 'shelves' },
    { id: 'vault-files-b', x: 26.6, y: 8, w: 1.8, h: 1.4, height: 1.5, kind: 'shelves' },
    { id: 'paper-pallets', x: 11.5, y: 14, w: 5, h: 2.2, height: 1, kind: 'crate' },
    { id: 'loading-pallets', x: 19.5, y: 16, w: 5, h: 1.8, height: 0.8, kind: 'crate' },
    { id: 'gate-cover', x: 26, y: 18.8, w: 2.5, h: 1.4, height: 1.2, kind: 'crate' },
    { id: 'street-block', x: 0.7, y: 3, w: 4.8, h: 4.5, height: 3, kind: 'building' },
    { id: 'fire-panel', x: 4.2, y: 8.4, w: 1.8, h: 0.7, height: 0.8, kind: 'shelves' },
    { id: 'archive-van', x: 28, y: 24, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 4.5,
      y: 18.5,
      label: 'Maintenance kit',
      detail: 'One staff uniform. No permission to carry the ledger.',
    },
    {
      id: 'override',
      tag: 'SHUNT',
      x: 4.8,
      y: 10.2,
      label: 'Fire control shunt',
      detail:
        'Assign an operative here to hold the archive shutter open. Move or Hold releases it.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 10,
      y: 10.3,
      label: 'Annex radio relay',
      detail: 'Disable reinforcement calls. Local guards remain active.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 28.6,
      y: 17.4,
      label: 'East delivery gate',
      detail: 'Open quietly from inside, or breach from the east road.',
    },
    {
      id: 'breach',
      tag: 'CUT',
      x: 26.1,
      y: 13.55,
      label: 'Archive shutter',
      detail: 'Cut the lock: eight seconds. Permanent access, noisy.',
    },
    {
      id: 'evidence',
      tag: 'LEDGER',
      x: 26.1,
      y: 6.4,
      label: 'Original debt ledger',
      detail: 'Required. Both hands occupied; carrying it attracts suspicion even in uniform.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      x: 30.7,
      y: 24.8,
      label: 'East road extraction',
      detail: 'Bring the ledger and every surviving operative here.',
    },
  ],
  spawns: [
    { x: 4, y: 22.5 },
    { x: 5, y: 22.5 },
    { x: 4, y: 23.5 },
    { x: 5, y: 23.5 },
  ],
  guards: [
    patrol([
      { x: 10, y: 12 },
      { x: 10, y: 18 },
    ]),
    patrol(
      [
        { x: 17, y: 12 },
        { x: 17, y: 5 },
      ],
      -Math.PI / 2,
    ),
    patrol(
      [
        { x: 21.6, y: 13.8 },
        { x: 21.6, y: 18.8 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 28.3, y: 15.5 },
        { x: 25, y: 15.5 },
      ],
      Math.PI,
    ),
    patrol(
      [
        { x: 32, y: 8.5 },
        { x: 32, y: 17.5 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 13, y: 19 },
        { x: 19, y: 19 },
      ],
      0,
    ),
  ],
};
